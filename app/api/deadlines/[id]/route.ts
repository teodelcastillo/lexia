/**
 * Deadline - DELETE with Google Calendar unsync
 *
 * DELETE /api/deadlines/[id]
 *
 * Deletes the deadline and removes the event from Google Calendar if synced.
 */
import { createClient } from '@/lib/supabase/server'
import { deleteCalendarEvent } from '@/lib/google/calendar'
import { NextResponse } from 'next/server'

export async function DELETE(
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

    const { data: deadline, error: fetchErr } = await supabase
      .from('deadlines')
      .select('id, google_calendar_event_id')
      .eq('id', id)
      .single()

    if (fetchErr || !deadline) {
      return NextResponse.json({ error: 'Vencimiento no encontrado' }, { status: 404 })
    }

    if (deadline.google_calendar_event_id) {
      const { data: connection } = await supabase
        .from('google_connections')
        .select('access_token, refresh_token, token_expires_at')
        .eq('user_id', user.id)
        .eq('service', 'calendar')
        .single()

      if (connection) {
        const tokens = {
          access_token: connection.access_token,
          refresh_token: connection.refresh_token,
          expiry_date: connection.token_expires_at
            ? new Date(connection.token_expires_at).getTime()
            : null,
        }
        await deleteCalendarEvent(tokens, deadline.google_calendar_event_id)
      }
    }

    const { error: deleteErr } = await supabase
      .from('deadlines')
      .delete()
      .eq('id', id)

    if (deleteErr) {
      return NextResponse.json(
        { error: deleteErr.message ?? 'Error al eliminar' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[Deadline DELETE]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error al eliminar' },
      { status: 500 }
    )
  }
}
