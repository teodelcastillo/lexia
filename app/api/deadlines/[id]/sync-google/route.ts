/**
 * Sync Deadline to Google Calendar
 *
 * POST /api/deadlines/[id]/sync-google
 *
 * Creates or updates the deadline in the user's Google Calendar (idempotent).
 * Requires user to have connected Google Calendar (google_connections).
 */
import { createClient } from '@/lib/supabase/server'
import {
  createCalendarEvent,
  updateCalendarEvent,
} from '@/lib/google/calendar'
import { ensureValidTokens } from '@/lib/google/client'
import { NextResponse } from 'next/server'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { data: deadline, error: deadlineError } = await supabase
      .from('deadlines')
      .select('id, title, description, due_date, google_calendar_event_id')
      .eq('id', id)
      .single()

    if (deadlineError || !deadline) {
      return NextResponse.json({ error: 'Vencimiento no encontrado' }, { status: 404 })
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

    const startDate = new Date(deadline.due_date)
    const endDate = new Date(startDate.getTime() + 60 * 60 * 1000) // +1h

    let tokens = {
      access_token: connection.access_token,
      refresh_token: connection.refresh_token,
      expiry_date: connection.token_expires_at
        ? new Date(connection.token_expires_at).getTime()
        : null,
    }
    const validTokens = await ensureValidTokens(tokens)
    tokens = validTokens
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

    const params = {
      title: deadline.title,
      description: deadline.description ?? undefined,
      startDate,
      endDate,
    }

    if (deadline.google_calendar_event_id) {
      const ok = await updateCalendarEvent(tokens, deadline.google_calendar_event_id, params)
      if (!ok) {
        return NextResponse.json(
          { error: 'No se pudo actualizar el evento en Google Calendar' },
          { status: 500 }
        )
      }
      return NextResponse.json({ success: true, eventId: deadline.google_calendar_event_id })
    }

    const eventId = await createCalendarEvent(tokens, params)

    const { error: updateError } = await supabase
      .from('deadlines')
      .update({ google_calendar_event_id: eventId })
      .eq('id', id)

    if (updateError) {
      console.error('[Sync Google] Update deadline error:', updateError)
      return NextResponse.json(
        { error: 'Evento creado pero no se pudo guardar la referencia' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, eventId })
  } catch (err) {
    console.error('[Sync Google]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error al sincronizar' },
      { status: 500 }
    )
  }
}
