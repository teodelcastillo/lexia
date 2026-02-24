/**
 * SAC Manual Sync API
 *
 * POST /api/sac/sync/[caseId]
 *
 * Triggers an immediate SAC synchronization for a single case.
 */
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { checkCasePermission } from '@/lib/utils/access-control'
import { syncSacCase } from '@/lib/sac/sync'

export const maxDuration = 60

export async function POST(
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

    const { data: caseData } = await supabase
      .from('cases')
      .select(
        'id, case_number, title, organization_id, sac_expediente_number, sac_anio, sac_fuero, sac_responsible_lawyer_id'
      )
      .eq('id', caseId)
      .single()

    if (!caseData) {
      return NextResponse.json({ error: 'Caso no encontrado' }, { status: 404 })
    }

    if (!caseData.sac_expediente_number || !caseData.sac_responsible_lawyer_id) {
      return NextResponse.json(
        { error: 'Este caso no tiene un expediente SAC vinculado' },
        { status: 400 }
      )
    }

    const admin = createAdminClient()
    const result = await syncSacCase({
      caseId: caseData.id,
      caseNumber: caseData.case_number,
      caseTitle: caseData.title,
      expedienteNumber: caseData.sac_expediente_number,
      anio: caseData.sac_anio || '',
      fuero: caseData.sac_fuero || undefined,
      lawyerId: caseData.sac_responsible_lawyer_id,
      organizationId: caseData.organization_id,
      supabase: admin,
      triggeredBy: user.id,
    })

    return NextResponse.json(result)
  } catch (err) {
    console.error('[SAC sync]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error de sincronización' },
      { status: 500 }
    )
  }
}
