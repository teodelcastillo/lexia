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
import { notifyDeadlineCompleted } from '@/lib/services/notifications'
import { checkCasePermission } from '@/lib/utils/access-control'

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
      .maybeSingle()

    if (!deadline) {
      return NextResponse.json(
        { error: 'Vencimiento no encontrado' },
        { status: 404 }
      )
    }

    if (deadline.case_id) {
      const canEdit = await checkCasePermission(
        supabase,
        user.id,
        deadline.case_id,
        'can_edit'
      )
      if (!canEdit) {
        return NextResponse.json(
          { error: 'Sin permisos para completar este vencimiento' },
          { status: 403 }
        )
      }
    }

    const { error, data: updated } = await supabase
      .from('deadlines')
      .update({
        status: 'completed',
        is_completed: true,
        completed_at: new Date().toISOString(),
        completed_by: user.id,
      })
      .eq('id', id)
      .select('id')

    if (error) {
      console.error('[Deadline Complete]', error)
      return NextResponse.json(
        { error: error.message || 'No se pudo marcar como completado' },
        { status: 500 }
      )
    }

    if (!updated || updated.length === 0) {
      return NextResponse.json(
        { error: 'Vencimiento no encontrado o sin permisos para actualizar' },
        { status: 404 }
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

    await notifyDeadlineCompleted(
      id,
      title,
      deadline?.case_id ?? null,
      user.id
    )

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[Deadline Complete]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error al completar' },
      { status: 500 }
    )
  }
}
