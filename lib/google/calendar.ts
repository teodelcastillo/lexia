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
