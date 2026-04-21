/**
 * POST /api/lexia/documents/[id]/agent/execute
 *
 * Ejecuta UN paso del plan del modo agente. El cliente llama esta ruta N
 * veces (una por paso) y aplica cada resultado sobre el editor Tiptap.
 *
 * Respuesta streamed: objeto estructurado AgentStepResult. Cada paso se
 * registra en lexia_document_edits con mode='agent' y metadata del plan
 * para trazabilidad completa.
 */

import { streamObject } from 'ai'

import { createClient } from '@/lib/supabase/server'
import { checkCasePermission } from '@/lib/utils/access-control'
import { resolveModel } from '@/lib/ai/resolver'
import {
  getDocument,
  buildCaseContext,
  docToOutline,
  AgentStepResultSchema,
  AgentExecuteRequestSchema,
  type AgentStep,
  type AgentPlan,
} from '@/lib/lexia/workspace'

export const dynamic = 'force-dynamic'
export const maxDuration = 90

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const PRIMARY_MODEL = 'anthropic/claude-sonnet-4-20250514'
const FALLBACK_MODEL = 'openai/gpt-4o'

function stepInstruction(step: AgentStep, plan: AgentPlan, totalSteps: number, idx: number): string {
  const kindHint: Record<AgentStep['kind'], string> = {
    draft_section:
      'Vas a CREAR una sección nueva. Devolvé heading + contenido. headingLevel recomendado: 2.',
    replace_section:
      'Vas a REEMPLAZAR el contenido de la sección indicada por targetHeading. No repitas el heading.',
    insert_after_heading:
      'Vas a AGREGAR párrafos debajo del heading indicado. No repitas el heading ni toques el contenido previo.',
    rewrite_entire:
      'Vas a REESCRIBIR todo el documento. Usá headings (###) y párrafos separados por doble newline en "content".',
  }
  const heading =
    step.kind === 'draft_section'
      ? (step.targetHeading ?? step.title)
      : (step.targetHeading ?? '(no aplica)')

  return [
    `Paso ${idx + 1} de ${totalSteps}: "${step.title}"`,
    `Tipo: ${step.kind}`,
    `Heading objetivo: ${heading}`,
    `Descripción: ${step.description}`,
    step.expectedWords ? `Longitud aproximada: ${step.expectedWords} palabras.` : '',
    '',
    kindHint[step.kind],
    '',
    `Plan global: ${plan.summary}`,
  ]
    .filter(Boolean)
    .join('\n')
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  if (!UUID_REGEX.test(id)) {
    return Response.json({ error: 'ID invalido' }, { status: 400 })
  }

  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const parsed = AgentExecuteRequestSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json(
      { error: 'Parámetros inválidos', details: parsed.error.flatten() },
      { status: 400 }
    )
  }
  const { plan, stepIndex, previousResults, context, planRunId } = parsed.data
  const step = plan.steps[stepIndex]
  if (!step) {
    return Response.json({ error: 'stepIndex fuera de rango' }, { status: 400 })
  }

  const doc = await getDocument(supabase, id)
  if (!doc) return Response.json({ error: 'Documento no encontrado' }, { status: 404 })
  if (doc.caseId) {
    const canEdit = await checkCasePermission(supabase, user.id, doc.caseId, 'can_edit')
    if (!canEdit) return Response.json({ error: 'Sin permisos' }, { status: 403 })
  }

  let caseNumber: string | null = null
  let caseTitle: string | null = null
  if (doc.caseId) {
    const { data } = await supabase
      .from('cases')
      .select('case_number, title')
      .eq('id', doc.caseId)
      .maybeSingle()
    caseNumber = (data as { case_number?: string } | null)?.case_number ?? null
    caseTitle = (data as { title?: string } | null)?.title ?? null
  }

  const contextResult = doc.caseId
    ? await buildCaseContext(supabase, {
        caseId: doc.caseId,
        documentIds: context?.documentIds ?? [],
        personIds: context?.personIds ?? [],
        totalDocsBudget: 22000,
      })
    : { text: '', documents: [], people: [] }

  const outline = docToOutline(doc.content) || '(documento vacío)'

  const system = [
    'Sos LEXIA en modo AGENTE — ejecutor de un paso del plan.',
    `Tipo de documento: ${doc.documentType.toUpperCase()}.`,
    doc.clientRole ? `Representás al ${doc.clientRole.toUpperCase()}.` : 'Sin rol definido.',
    caseNumber && caseTitle ? `Caso: ${caseNumber} — "${caseTitle}".` : 'Sin caso asociado.',
    '',
    'REGLAS IRRENUNCIABLES:',
    '- NO inventes hechos, fechas, montos o identidades. Si faltan datos → caveats.',
    '- Formato de "content": texto plano, párrafos separados por DOBLE newline. Nada de markdown.',
    '- Si el paso crea una sección nueva, poné el heading en "heading" y NO lo repitas dentro de "content".',
    '- Coherencia: integrá lo que produjeron los pasos anteriores (te los paso abajo como referencia).',
    '- "reasoning": 2-5 oraciones en primera persona explicando qué hiciste y por qué.',
    '- "citations": sólo las que efectivamente usaste en el texto. Label exacto.',
    '- Tono formal propio del derecho argentino.',
  ].join('\n')

  const previousBlock =
    previousResults.length > 0
      ? '--- PASOS YA EJECUTADOS (para mantener coherencia) ---\n' +
        previousResults
          .map((r, i) => {
            const head = r.heading ? `[${r.heading}]` : `[paso ${i + 1}]`
            return `${head} ${r.content.slice(0, 800)}${r.content.length > 800 ? '…' : ''}`
          })
          .join('\n\n')
      : '(aún no se ejecutaron pasos previos)'

  const userPrompt = [
    stepInstruction(step, plan, plan.steps.length, stepIndex),
    '',
    `--- OUTLINE ACTUAL DEL DOCUMENTO ---\n${outline}`,
    '',
    `--- DOCUMENTO ACTUAL (texto plano) ---\n${doc.contentText.slice(0, 10000) || '(vacío)'}`,
    '',
    previousBlock,
    '',
    contextResult.text
      ? `--- CONTEXTO DEL CASO ---\n${contextResult.text}`
      : '(Sin contexto adicional del caso)',
    '',
    'Generá el AgentStepResult para este paso.',
  ].join('\n')

  // Persist the attempt for audit (mode='agent').
  const { data: editRow } = await supabase
    .from('lexia_document_edits')
    .insert({
      document_id: id,
      user_id: user.id,
      instruction: `[agent] ${step.title}`,
      mode: 'agent',
      context: {
        ...(context ?? {}),
        agent: {
          plan_run_id: planRunId ?? null,
          step_id: step.id,
          step_index: stepIndex,
          step_kind: step.kind,
          target_heading: step.targetHeading ?? null,
          plan_summary: plan.summary,
        },
        resolved: {
          documents: contextResult.documents,
          people: contextResult.people,
        },
      },
      model_used: PRIMARY_MODEL,
      status: 'pending',
    })
    .select('id')
    .maybeSingle()

  const editId = (editRow as { id?: string } | null)?.id ?? null

  let model
  try {
    model = resolveModel(PRIMARY_MODEL)
  } catch {
    model = resolveModel(FALLBACK_MODEL)
  }

  const result = streamObject({
    model,
    schema: AgentStepResultSchema,
    system,
    prompt: userPrompt,
    temperature: 0.4,
    onFinish: async ({ object, usage }) => {
      if (!editId) return
      try {
        await supabase
          .from('lexia_document_edits')
          .update({
            reasoning: object?.reasoning ?? null,
            replacement: object?.content ?? null,
            citations: object?.citations ?? [],
            tokens_used: usage?.totalTokens ?? 0,
          })
          .eq('id', editId)
      } catch (err) {
        console.error('[agent/execute] failed to record:', err)
      }
    },
  })

  const response = result.toTextStreamResponse()
  if (editId) response.headers.set('x-lexia-edit-id', editId)
  return response
}
