/**
 * Mark Deadline as Complete
 *
 * POST /api/deadlines/[id]/complete
 *
 * Updates status to 'completed', is_completed to true, and sets completed_at/completed_by.
 */
import { createClient } from '@/lib/supabase/server'
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

    const { error } = await supabase
      .from('deadlines')
      .update({
        status: 'completed',
        is_completed: true,
        completed_at: new Date().toISOString(),
        completed_by: user.id,
      })
      .eq('id', id)

    if (error) {
      console.error('[Deadline Complete]', error)
      return NextResponse.json(
        { error: error.message || 'No se pudo marcar como completado' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[Deadline Complete]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error al completar' },
      { status: 500 }
    )
  }
}
