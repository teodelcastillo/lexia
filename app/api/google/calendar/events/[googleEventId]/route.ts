/**
 * Google Calendar Event - PATCH (edit) and DELETE
 *
 * PATCH /api/google/calendar/events/[googleEventId]
 * DELETE /api/google/calendar/events/[googleEventId]
 *
 * Edits or deletes an event in Google Calendar and updates local DB.
 */
import { createClient } from '@/lib/supabase/server'
import {
  updateCalendarEvent,
  deleteCalendarEvent,
} from '@/lib/google/calendar'
import { NextResponse } from 'next/server'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ googleEventId: string }> }
) {
  try {
    const { googleEventId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { data: localEvent } = await supabase
      .from('google_calendar_events')
      .select('id, user_id, google_event_id')
      .eq('user_id', user.id)
      .eq('google_event_id', googleEventId)
      .single()

    if (!localEvent) {
      return NextResponse.json({ error: 'Evento no encontrado' }, { status: 404 })
    }

    const { data: connection } = await supabase
      .from('google_connections')
      .select('access_token, refresh_token, token_expires_at')
      .eq('user_id', user.id)
      .eq('service', 'calendar')
      .single()

    if (!connection) {
      return NextResponse.json(
        { error: 'Cuenta de Google desconectada' },
        { status: 400 }
      )
    }

    const body = await request.json().catch(() => ({}))
    const tokens = {
      access_token: connection.access_token,
      refresh_token: connection.refresh_token,
      expiry_date: connection.token_expires_at
        ? new Date(connection.token_expires_at).getTime()
        : null,
    }

    const eventParams: {
      title?: string
      description?: string
      startDate?: Date
      endDate?: Date
      location?: string
    } = {}
    if (body.summary != null) eventParams.title = body.summary
    if (body.description != null) eventParams.description = body.description
    if (body.location != null) eventParams.location = body.location
    if (body.start_at) eventParams.startDate = new Date(body.start_at)
    if (body.end_at) eventParams.endDate = new Date(body.end_at)

    const ok = await updateCalendarEvent(tokens, googleEventId, eventParams)
    if (!ok) {
      return NextResponse.json(
        { error: 'No se pudo actualizar el evento en Google Calendar' },
        { status: 500 }
      )
    }

    const updated = {
      ...(body.summary != null && { summary: body.summary }),
      ...(body.description != null && { description: body.description }),
      ...(body.location != null && { location: body.location }),
      ...(body.start_at && { start_at: body.start_at }),
      ...(body.end_at && { end_at: body.end_at }),
      google_updated_at: new Date().toISOString(),
    }

    await supabase
      .from('google_calendar_events')
      .update(updated)
      .eq('id', localEvent.id)

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[Google Calendar PATCH]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error al actualizar' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ googleEventId: string }> }
) {
  try {
    const { googleEventId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { data: localEvent } = await supabase
      .from('google_calendar_events')
      .select('id, user_id')
      .eq('user_id', user.id)
      .eq('google_event_id', googleEventId)
      .single()

    if (!localEvent) {
      return NextResponse.json({ error: 'Evento no encontrado' }, { status: 404 })
    }

    const { data: connection } = await supabase
      .from('google_connections')
      .select('access_token, refresh_token, token_expires_at')
      .eq('user_id', user.id)
      .eq('service', 'calendar')
      .single()

    if (!connection) {
      return NextResponse.json(
        { error: 'Cuenta de Google desconectada' },
        { status: 400 }
      )
    }

    const tokens = {
      access_token: connection.access_token,
      refresh_token: connection.refresh_token,
      expiry_date: connection.token_expires_at
        ? new Date(connection.token_expires_at).getTime()
        : null,
    }

    const ok = await deleteCalendarEvent(tokens, googleEventId)
    if (!ok) {
      return NextResponse.json(
        { error: 'No se pudo eliminar el evento en Google Calendar' },
        { status: 500 }
      )
    }

    await supabase
      .from('google_calendar_events')
      .delete()
      .eq('id', localEvent.id)

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[Google Calendar DELETE]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error al eliminar' },
      { status: 500 }
    )
  }
}
