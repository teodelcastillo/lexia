/**
 * SAC Movements API
 *
 * GET /api/sac/cases/[caseId]/movements
 *
 * Fetches SAC movements for a case. Also marks movements as "seen" (is_new = false).
 *
 * PATCH /api/sac/cases/[caseId]/movements
 *
 * Marks all movements as read (is_new = false).
 */
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkCasePermission } from '@/lib/utils/access-control'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ caseId: string }> }
) {
  try {
    const { caseId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const canView = await checkCasePermission(supabase, user.id, caseId, 'can_view')
    if (!canView) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const { data: movements, error } = await supabase
      .from('sac_movements')
      .select('*')
      .eq('case_id', caseId)
      .order('fecha', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ movements: movements || [] })
  } catch (err) {
    console.error('[SAC movements GET]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ caseId: string }> }
) {
  try {
    const { caseId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const canView = await checkCasePermission(supabase, user.id, caseId, 'can_view')
    if (!canView) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const { error } = await supabase
      .from('sac_movements')
      .update({ is_new: false })
      .eq('case_id', caseId)
      .eq('is_new', true)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[SAC movements PATCH]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error' },
      { status: 500 }
    )
  }
}
