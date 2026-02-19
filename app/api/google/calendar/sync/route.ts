/**
 * Google Calendar Sync - Pull events from Google into Lexia
 *
 * POST /api/google/calendar/sync
 * Query: ?full=true to force full sync (ignore sync_token)
 *
 * Initial sync: timeMin/timeMax (-30d to +180d) in UTC
 * Incremental: uses syncToken from google_calendar_sync_state
 */
import { createClient } from '@/lib/supabase/server'
import { listCalendarEvents } from '@/lib/google/calendar'
import { ensureValidTokens } from '@/lib/google/client'
import { NextResponse } from 'next/server'

function parseEventDate(
  start: { dateTime?: string; date?: string } | undefined,
  end: { dateTime?: string; date?: string } | undefined
): { startAt: string; endAt: string; allDay: boolean } {
  const allDay = !!start?.date && !start?.dateTime
  const startAt = start?.dateTime ?? start?.date ?? new Date().toISOString()
  const endAt = end?.dateTime ?? end?.date ?? startAt
  return { startAt, endAt, allDay }
}

export async function POST(request: Request) {
  try {
    const url = new URL(request.url)
    const forceFullSync = url.searchParams.get('full') === 'true'

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { data: connection } = await supabase
      .from('google_connections')
      .select('access_token, refresh_token, token_expires_at')
      .eq('user_id', user.id)
      .eq('service', 'calendar')
      .single()

    if (!connection) {
      return NextResponse.json(
        { error: 'Conecte su cuenta de Google Calendar en Perfil > Integraciones' },
        { status: 400 }
      )
    }

    let tokens = {
      access_token: connection.access_token,
      refresh_token: connection.refresh_token,
      expiry_date: connection.token_expires_at
        ? new Date(connection.token_expires_at).getTime()
        : null,
    }
    const validTokens = await ensureValidTokens(tokens)
    tokens = {
      access_token: validTokens.access_token,
      refresh_token: validTokens.refresh_token ?? null,
      expiry_date: validTokens.expiry_date ?? null,
    }
    if (validTokens.wasRefreshed) {
      await supabase
        .from('google_connections')
        .update({
          access_token: validTokens.access_token,
          token_expires_at: validTokens.expiry_date
            ? new Date(validTokens.expiry_date).toISOString()
            : null,
        })
        .eq('user_id', user.id)
        .eq('service', 'calendar')
    }

    const calendarId = 'primary'

    const { data: syncState } = await supabase
      .from('google_calendar_sync_state')
      .select('sync_token')
      .eq('user_id', user.id)
      .eq('calendar_id', calendarId)
      .single()

    let timeMin: Date | undefined
    let timeMax: Date | undefined
    let syncToken: string | undefined

    if (forceFullSync && syncState?.sync_token) {
      await supabase
        .from('google_calendar_sync_state')
        .delete()
        .eq('user_id', user.id)
        .eq('calendar_id', calendarId)
      console.log('[Google Calendar Sync] Forced full sync - cleared sync_token')
    }

    if (forceFullSync || !syncState?.sync_token) {
      const now = new Date()
      timeMin = new Date(now)
      timeMin.setDate(timeMin.getDate() - 30)
      timeMin.setHours(0, 0, 0, 0)
      timeMax = new Date(now)
      timeMax.setDate(timeMax.getDate() + 180)
      timeMax.setHours(23, 59, 59, 999)
      console.log('[Google Calendar Sync] Initial sync', { timeMin: timeMin.toISOString(), timeMax: timeMax.toISOString() })
    } else {
      syncToken = syncState.sync_token
      console.log('[Google Calendar Sync] Incremental sync with syncToken')
    }

    const { events, nextSyncToken } = await listCalendarEvents(tokens, {
      calendarId,
      timeMin,
      timeMax,
      syncToken,
      singleEvents: true,
      showDeleted: true,
    })

    let upserted = 0
    let deleted = 0

    for (const event of events) {
      const googleEventId = event.id
      if (!googleEventId) continue

      const status = event.status ?? 'confirmed'
      const { startAt, endAt, allDay } = parseEventDate(event.start, event.end)

      if (status === 'cancelled') {
        const { error: delErr } = await supabase
          .from('google_calendar_events')
          .delete()
          .eq('user_id', user.id)
          .eq('calendar_id', calendarId)
          .eq('google_event_id', googleEventId)
        if (!delErr) deleted++
        continue
      }

      const { error: upsertErr } = await supabase
        .from('google_calendar_events')
        .upsert(
          {
            user_id: user.id,
            calendar_id: calendarId,
            google_event_id: googleEventId,
            etag: event.etag ?? null,
            google_updated_at: event.updated ? new Date(event.updated).toISOString() : null,
            status,
            summary: event.summary ?? null,
            description: event.description ?? null,
            location: event.location ?? null,
            start_at: startAt,
            end_at: endAt,
            all_day: allDay,
          },
          { onConflict: 'user_id,calendar_id,google_event_id' }
        )
      if (!upsertErr) upserted++
    }

    if (nextSyncToken) {
      await supabase
        .from('google_calendar_sync_state')
        .upsert(
          {
            user_id: user.id,
            calendar_id: calendarId,
            sync_token: nextSyncToken,
            last_synced_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,calendar_id' }
        )
    }

    console.log('[Google Calendar Sync] Done', { total: events.length, upserted, deleted, nextSyncToken: !!nextSyncToken })

    return NextResponse.json({
      success: true,
      upserted,
      deleted,
      total: events.length,
      nextSyncToken: !!nextSyncToken,
    })
  } catch (err) {
    console.error('[Google Calendar Sync]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error al sincronizar' },
      { status: 500 }
    )
  }
}
