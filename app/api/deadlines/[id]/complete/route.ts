/**
 * Mark Deadline as Complete
 *
 * POST /api/deadlines/[id]/complete
 *
 * Updates status to 'completed', is_completed to true, and sets completed_at/completed_by.
 */
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { logActivity } from '@/lib/services/activity-log'

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

    const { data: deadline } = await supabase
      .from('deadlines')
      .select('title, case_id')
      .eq('id', id)
      .single()

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

    const title = deadline?.title || 'Evento'
    await logActivity({
      supabase,
      userId: user.id,
      actionType: 'completed',
      entityType: 'deadline',
      entityId: id,
      caseId: deadline?.case_id ?? null,
      description: `completó el evento "${title}"`,
      newValues: { status: 'completed' },
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[Deadline Complete]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error al completar' },
      { status: 500 }
    )
  }
}
