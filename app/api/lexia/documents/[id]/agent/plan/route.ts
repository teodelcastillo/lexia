/**
 * POST /api/lexia/documents/[id]/agent/plan
 *
 * Fase 3 — Modo Agente. Dado un objetivo alto nivel (ej: "redactá la
 * demanda completa a partir de estos documentos") devuelve un plan
 * estructurado de pasos que el cliente puede revisar y ejecutar.
 *
 * El agente NO muta el documento. Sólo propone un plan. La ejecución paso
 * a paso ocurre en /agent/execute.
 */

import { streamObject } from 'ai'

import { createClient } from '@/lib/supabase/server'
import { checkCasePermission } from '@/lib/utils/access-control'
import { resolveModel } from '@/lib/ai/resolver'
import {
  getDocument,
  buildCaseContext,
  docToOutline,
  AgentPlanSchema,
  AgentPlanRequestSchema,
} from '@/lib/lexia/workspace'

export const dynamic = 'force-dynamic'
export const maxDuration = 45

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const PRIMARY_MODEL = 'anthropic/claude-sonnet-4-20250514'
const FALLBACK_MODEL = 'openai/gpt-4o'

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
  const parsed = AgentPlanRequestSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json(
      { error: 'Parámetros inválidos', details: parsed.error.flatten() },
      { status: 400 }
    )
  }
  const { objective, context } = parsed.data

  const doc = await getDocument(supabase, id)
  if (!doc) return Response.json({ error: 'Documento no encontrado' }, { status: 404 })
  if (doc.caseId) {
    const canEdit = await checkCasePermission(supabase, user.id, doc.caseId, 'can_edit')
    if (!canEdit) return Response.json({ error: 'Sin permisos de edición' }, { status: 403 })
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
        totalDocsBudget: 20000,
      })
    : { text: '', documents: [], people: [] }

  const outline = docToOutline(doc.content) || '(documento vacío)'

  const system = [
    'Sos LEXIA en modo AGENTE. Tu trabajo es diseñar un plan, no redactar el contenido final.',
    `Tipo de documento objetivo: ${doc.documentType.toUpperCase()}.`,
    doc.clientRole ? `Representás al ${doc.clientRole.toUpperCase()}.` : 'Sin rol definido.',
    caseNumber && caseTitle ? `Caso: ${caseNumber} — "${caseTitle}".` : 'Sin caso asociado.',
    '',
    'REGLAS DEL PLAN:',
    '- Devolvé entre 2 y 8 pasos concretos. Cada paso debe ser accionable y atómico.',
    '- Cada paso tiene un KIND que determina cómo se aplicará al documento:',
    '    * draft_section       → creá una sección nueva (agregá el heading en el paso)',
    '    * replace_section     → reemplazá el contenido de una sección existente (requiere targetHeading exacto del outline)',
    '    * insert_after_heading→ agregá párrafos debajo de un heading existente (requiere targetHeading)',
    '    * rewrite_entire      → reescribí todo el documento (usalo SOLO si el abogado lo pide explícito)',
    '- NO incluyas pasos que sean sólo "revisar" o "verificar": eso lo hace el abogado al final.',
    '- Los pasos deben ordenarse de arriba hacia abajo respecto a la estructura final del documento.',
    '- Si faltan datos críticos, poné el supuesto en "risks" en vez de inventar.',
    '- `id` de cada paso debe ser kebab-case estable ("hechos-1", "derecho-reclamo-dano-moral").',
    '- Respondé siempre en español formal argentino.',
  ].join('\n')

  const userPrompt = [
    `OBJETIVO DEL ABOGADO: "${objective.trim()}"`,
    '',
    `--- ESTRUCTURA ACTUAL DEL DOCUMENTO ---\n${outline}`,
    '',
    `--- DOCUMENTO ACTUAL (texto plano, para entender qué hay) ---\n${doc.contentText.slice(0, 12000) || '(vacío)'}`,
    '',
    contextResult.text
      ? `--- CONTEXTO DEL CASO (documentos y personas elegidos por el abogado) ---\n${contextResult.text}`
      : '(Sin contexto adicional del caso)',
    '',
    'Generá un AgentPlan con pasos accionables para cumplir el objetivo.',
  ].join('\n')

  let model
  try {
    model = resolveModel(PRIMARY_MODEL)
  } catch {
    model = resolveModel(FALLBACK_MODEL)
  }

  const result = streamObject({
    model,
    schema: AgentPlanSchema,
    system,
    prompt: userPrompt,
    temperature: 0.3,
  })

  return result.toTextStreamResponse()
}
