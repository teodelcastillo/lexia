/**
 * Google Calendar API Service
 *
 * Creates events in Google Calendar from deadlines.
 */
import { google } from 'googleapis'
import type { calendar_v3 } from 'googleapis'
import { createAuthenticatedClient } from './client'

export interface CreateCalendarEventParams {
  title: string
  description?: string
  startDate: Date
  endDate?: Date
  location?: string
}

/**
 * Creates a calendar event and returns the event ID
 */
export async function createCalendarEvent(
  tokens: { access_token: string; refresh_token?: string | null; expiry_date?: number | null },
  params: CreateCalendarEventParams
): Promise<string | null> {
  try {
    const auth = createAuthenticatedClient(tokens)
    const calendar = google.calendar({ version: 'v3', auth })

    const endDate = params.endDate ?? new Date(params.startDate.getTime() + 60 * 60 * 1000) // +1h default

    const event: calendar_v3.Schema$Event = {
      summary: params.title,
      description: params.description ?? undefined,
      location: params.location ?? undefined,
      start: {
        dateTime: params.startDate.toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      end: {
        dateTime: endDate.toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
    }

    const { data } = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: event,
    })

    return data.id ?? null
  } catch (err) {
    console.error('[Google Calendar] createEvent error:', err)
    return null
  }
}

/**
 * Updates an existing calendar event
 */
export async function updateCalendarEvent(
  tokens: { access_token: string; refresh_token?: string | null; expiry_date?: number | null },
  eventId: string,
  params: Partial<CreateCalendarEventParams>
): Promise<boolean> {
  try {
    const auth = createAuthenticatedClient(tokens)
    const calendar = google.calendar({ version: 'v3', auth })

    const event: calendar_v3.Schema$Event = {}
    if (params.title) event.summary = params.title
    if (params.description !== undefined) event.description = params.description
    if (params.location !== undefined) event.location = params.location
    if (params.startDate) {
      event.start = {
        dateTime: params.startDate.toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      }
    }
    if (params.endDate) {
      event.end = {
        dateTime: params.endDate.toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      }
    }

    await calendar.events.patch({
      calendarId: 'primary',
      eventId,
      requestBody: event,
    })
    return true
  } catch (err) {
    console.error('[Google Calendar] updateEvent error:', err)
    return false
  }
}

/**
 * Lists calendar events (for sync Google → App)
 * Supports initial sync (timeMin/timeMax) and incremental (syncToken)
 */
export async function listCalendarEvents(
  tokens: { access_token: string; refresh_token?: string | null; expiry_date?: number | null },
  options: {
    calendarId?: string
    timeMin?: Date
    timeMax?: Date
    syncToken?: string
    singleEvents?: boolean
    showDeleted?: boolean
  } = {}
): Promise<{ events: calendar_v3.Schema$Event[]; nextSyncToken?: string }> {
  try {
    const auth = createAuthenticatedClient(tokens)
    const calendar = google.calendar({ version: 'v3', auth })
    const calendarId = options.calendarId ?? 'primary'

    const params: calendar_v3.Params$Resource$Events$List = {
      calendarId,
      singleEvents: options.singleEvents ?? true,
      showDeleted: options.showDeleted ?? true,
    }
    if (options.syncToken) {
      params.syncToken = options.syncToken
    } else if (options.timeMin || options.timeMax) {
      if (options.timeMin) params.timeMin = options.timeMin.toISOString()
      if (options.timeMax) params.timeMax = options.timeMax.toISOString()
    }

    const { data } = await calendar.events.list(params)
    const events = data.items ?? []
    const nextSyncToken = data.nextSyncToken ?? undefined
    return { events, nextSyncToken }
  } catch (err) {
    console.error('[Google Calendar] listEvents error:', err)
    return { events: [] }
  }
}

/**
 * Gets a single event by ID (for PATCH/DELETE verification)
 */
export async function getCalendarEvent(
  tokens: { access_token: string; refresh_token?: string | null; expiry_date?: number | null },
  eventId: string,
  calendarId: string = 'primary'
): Promise<calendar_v3.Schema$Event | null> {
  try {
    const auth = createAuthenticatedClient(tokens)
    const calendar = google.calendar({ version: 'v3', auth })
    const { data } = await calendar.events.get({ calendarId, eventId })
    return data
  } catch {
    return null
  }
}

/**
 * Deletes a calendar event
 */
export async function deleteCalendarEvent(
  tokens: { access_token: string; refresh_token?: string | null; expiry_date?: number | null },
  eventId: string
): Promise<boolean> {
  try {
    const auth = createAuthenticatedClient(tokens)
    const calendar = google.calendar({ version: 'v3', auth })
    await calendar.events.delete({
      calendarId: 'primary',
      eventId,
    })
    return true
  } catch (err) {
    console.error('[Google Calendar] deleteEvent error:', err)
    return false
  }
}
