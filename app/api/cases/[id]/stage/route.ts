/**
 * Case Stage API
 *
 * GET  /api/cases/[id]/stage — Devuelve etapa actual + historial
 * POST /api/cases/[id]/stage — Avanza/cambia la etapa procesal
 *                              body: { proceso_tipo, stage_slug, notas?, dry_run? }
 */
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkCasePermission } from '@/lib/utils/access-control'
import { advanceStage } from '@/lib/workflow/advance-stage'
import { getStageRules, getStageRule, type ProcesoPipo } from '@/lib/workflow/stage-rules'

const VALID_PROCESO_TIPOS: ProcesoPipo[] = [
  'ordinario', 'abreviado', 'ejecutivo', 'laboral', 'familia', 'otro',
]

function isValidProcesoPipo(v: unknown): v is ProcesoPipo {
  return typeof v === 'string' && VALID_PROCESO_TIPOS.includes(v as ProcesoPipo)
}

/** GET — etapa actual + historial + etapas disponibles para el tipo de proceso */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: caseId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const canView = await checkCasePermission(supabase, user.id, caseId, 'can_view')
  if (!canView) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

  const { data: caseData } = await supabase
    .from('cases')
    .select('etapa_actual, proceso_tipo, etapa_updated_at, etapa_updated_by')
    .eq('id', caseId)
    .single()

  const { data: history } = await supabase
    .from('case_stage_history')
    .select('id, etapa, etapa_label, notas, created_by, created_at, profiles(full_name)')
    .eq('case_id', caseId)
    .order('created_at', { ascending: false })
    .limit(20)

  const procesoPipo = (caseData?.proceso_tipo ?? 'otro') as ProcesoPipo
  const stages = getStageRules(procesoPipo).map((s) => ({
    slug: s.slug,
    label: s.label,
    order: s.order,
    description: s.description,
    autoTaskCount: s.autoTasks.length,
    lexiaDocType: s.lexiaDocType,
  }))

  return NextResponse.json({
    current: caseData?.etapa_actual ?? null,
    proceso_tipo: procesoPipo,
    stages,
    history: history ?? [],
  })
}

/** POST — avanza la etapa, crea tareas y vencimientos */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: caseId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const canEdit = await checkCasePermission(supabase, user.id, caseId, 'can_edit')
  if (!canEdit) return NextResponse.json({ error: 'Sin permisos de edición' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const { proceso_tipo, stage_slug, notas, dry_run } = body as {
    proceso_tipo?: unknown
    stage_slug?: unknown
    notas?: unknown
    dry_run?: unknown
  }

  if (!isValidProcesoPipo(proceso_tipo)) {
    return NextResponse.json({ error: 'proceso_tipo inválido' }, { status: 400 })
  }
  if (typeof stage_slug !== 'string' || !stage_slug) {
    return NextResponse.json({ error: 'stage_slug requerido' }, { status: 400 })
  }
  if (!getStageRule(proceso_tipo, stage_slug)) {
    return NextResponse.json({ error: `Etapa desconocida: ${stage_slug}` }, { status: 400 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  if (!profile?.organization_id) {
    return NextResponse.json({ error: 'Sin organización' }, { status: 403 })
  }

  // Si proceso_tipo cambió, actualizarlo en el caso
  if (!dry_run) {
    await supabase
      .from('cases')
      .update({ proceso_tipo })
      .eq('id', caseId)
  }

  const result = await advanceStage(supabase, {
    caseId,
    organizationId: profile.organization_id,
    procesoPipo: proceso_tipo,
    newStageSlug: stage_slug,
    notas: typeof notas === 'string' ? notas : undefined,
    userId: user.id,
    dryRun: dry_run === true,
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }

  return NextResponse.json({
    stage: { slug: result.stage.slug, label: result.stage.label },
    createdTasks: result.createdTasks,
    createdDeadlines: result.createdDeadlines,
    dry_run: dry_run === true,
  })
}
