/**
 * SAC Case Link API
 *
 * POST /api/sac/cases/[caseId]/link
 *
 * Links a Lexia case to a SAC expediente by setting the sac_* fields
 * and designating the responsible lawyer.
 */
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkCasePermission } from '@/lib/utils/access-control'
import type { SacLinkPayload } from '@/lib/sac/types'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ caseId: string }> }
) {
  try {
    const { caseId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const canEdit = await checkCasePermission(supabase, user.id, caseId, 'can_edit')
    if (!canEdit) {
      return NextResponse.json({ error: 'Sin permisos para editar este caso' }, { status: 403 })
    }

    const body = (await request.json()) as SacLinkPayload
    const { sac_expediente_number, sac_anio, sac_fuero, sac_responsible_lawyer_id } = body

    if (!sac_expediente_number?.trim() || !sac_anio?.trim() || !sac_responsible_lawyer_id) {
      return NextResponse.json(
        { error: 'Número de expediente, año y abogado responsable son requeridos' },
        { status: 400 }
      )
    }

    if (!/^\d+$/.test(sac_expediente_number.trim())) {
      return NextResponse.json(
        { error: 'El número de expediente debe contener solo dígitos' },
        { status: 400 }
      )
    }

    if (!/^\d{4}$/.test(sac_anio.trim())) {
      return NextResponse.json(
        { error: 'El año debe tener 4 dígitos' },
        { status: 400 }
      )
    }

    // Verify the lawyer is assigned to this case
    const { data: assignment } = await supabase
      .from('case_assignments')
      .select('id')
      .eq('case_id', caseId)
      .eq('user_id', sac_responsible_lawyer_id)
      .single()

    if (!assignment) {
      return NextResponse.json(
        { error: 'El abogado seleccionado no está asignado a este caso' },
        { status: 400 }
      )
    }

    // Verify the lawyer has active SAC credentials
    const { data: creds } = await supabase
      .from('lawyer_sac_credentials')
      .select('id, is_active')
      .eq('profile_id', sac_responsible_lawyer_id)
      .single()

    if (!creds || !creds.is_active) {
      return NextResponse.json(
        { error: 'El abogado seleccionado no tiene credenciales SAC activas' },
        { status: 400 }
      )
    }

    const { error } = await supabase
      .from('cases')
      .update({
        sac_expediente_number: sac_expediente_number.trim(),
        sac_anio: sac_anio.trim(),
        sac_fuero: sac_fuero || null,
        sac_responsible_lawyer_id,
      })
      .eq('id', caseId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[SAC link]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error al vincular expediente' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/sac/cases/[caseId]/link
 *
 * Unlinks the SAC expediente from a case.
 */
export async function DELETE(
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

    const canEdit = await checkCasePermission(supabase, user.id, caseId, 'can_edit')
    if (!canEdit) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const { error } = await supabase
      .from('cases')
      .update({
        sac_expediente_number: null,
        sac_anio: null,
        sac_fuero: null,
        sac_responsible_lawyer_id: null,
        sac_estado_actual: null,
        sac_last_sync: null,
        sac_caratula: null,
        sac_juzgado: null,
        sac_secretaria: null,
      })
      .eq('id', caseId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[SAC unlink]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error al desvincular' },
      { status: 500 }
    )
  }
}
