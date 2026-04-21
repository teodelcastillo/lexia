/**
 * POST /api/lexia/counter-argue
 *
 * "Cuestionar" mode: dado un fragmento del documento que está redactando el
 * abogado, Lexia ataca el argumento como lo haría la contraparte y devuelve:
 *   - attacks   : objeciones concretas y fuertes contra el fragmento
 *   - weaknesses: debilidades estructurales del texto (no argumentales,
 *                 sino de redacción / prueba / técnica jurídica)
 *   - defenses  : cómo podría blindarse el argumento frente a los ataques
 *   - suggestedRewrite : redacción alternativa más robusta (opcional)
 *
 * Objetivo: que el abogado pueda "stress-testear" cada párrafo antes de
 * firmar. No se aplica nada al documento automáticamente.
 */

import { streamObject } from 'ai'
import { z } from 'zod'

import { createClient } from '@/lib/supabase/server'
import { checkCasePermission } from '@/lib/utils/access-control'
import { resolveModel } from '@/lib/ai/resolver'
import { getDocument, buildCaseContext } from '@/lib/lexia/workspace'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const PRIMARY_MODEL = 'anthropic/claude-sonnet-4-20250514'
const FALLBACK_MODEL = 'openai/gpt-4o'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const RequestSchema = z.object({
  documentId: z.string().regex(UUID_REGEX),
  fragment: z.string().min(20).max(4000),
  /** Optional: role the lawyer represents; we attack from the opposite side. */
  clientRole: z.enum(['actor', 'demandado', 'recurrente', 'recurrido']).optional(),
  /** Optional curated context (docs + personas). Defaults to doc.activeContext. */
  context: z
    .object({
      documentIds: z.array(z.string().regex(UUID_REGEX)).default([]),
      personIds: z.array(z.string().regex(UUID_REGEX)).default([]),
    })
    .optional(),
})

const AttackSchema = z.object({
  title: z.string().min(1).max(140),
  argument: z.string().min(1).max(1200),
  /** Citation label the adversary could invoke (norm or case). */
  citation: z.string().optional(),
  severity: z.enum(['low', 'medium', 'high']).default('medium'),
})

const CounterArgueResult = z.object({
  attacks: z.array(AttackSchema).min(1).max(5),
  weaknesses: z.array(z.string()).max(5).default([]),
  defenses: z.array(z.string()).max(5).default([]),
  suggestedRewrite: z.string().optional(),
})

function oppositeRole(role?: string): string {
  switch (role) {
    case 'actor':
      return 'la parte DEMANDADA'
    case 'demandado':
      return 'la parte ACTORA'
    case 'recurrente':
      return 'la parte RECURRIDA'
    case 'recurrido':
      return 'la parte RECURRENTE'
    default:
      return 'la parte contraria'
  }
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  const parsed = RequestSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json(
      { error: 'Parámetros inválidos', details: parsed.error.flatten() },
      { status: 400 }
    )
  }
  const { documentId, fragment, clientRole, context } = parsed.data

  const doc = await getDocument(supabase, documentId)
  if (!doc) return Response.json({ error: 'Documento no encontrado' }, { status: 404 })
  if (doc.caseId) {
    const canView = await checkCasePermission(supabase, user.id, doc.caseId, 'can_view')
    if (!canView) return Response.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const effectiveRole = clientRole ?? doc.clientRole ?? undefined
  const adversary = oppositeRole(effectiveRole ?? undefined)

  // Pull real document text/people if a case is associated.
  const effectiveContext = context ?? doc.activeContext ?? { documentIds: [], personIds: [] }
  const contextResult = doc.caseId
    ? await buildCaseContext(supabase, {
        caseId: doc.caseId,
        documentIds: effectiveContext.documentIds,
        personIds: effectiveContext.personIds,
        totalDocsBudget: 18000,
      })
    : { text: '', documents: [], people: [] }

  const system = [
    'Sos LEXIA en modo STRESS-TEST. Tu tarea es destruir argumentativamente el fragmento que redactó el abogado, como lo haría',
    `${adversary} en sede judicial argentina (Córdoba / nación).`,
    '',
    'REGLAS:',
    `- Atacás desde el rol de ${adversary}. Nunca te ablandes. Nunca pidas aclaraciones.`,
    '- Cada ataque debe ser concreto, cortante y plausible: menciona la regla, principio, norma o fallo que usarías.',
    '- Si citás normativa o fallos, escribilos con referencia completa. Si no estás seguro, NO cites.',
    '- Indicá severidad ("high" cuando podría tumbar el argumento entero; "low" cuando es menor).',
    '- "weaknesses": errores técnicos del texto del abogado (no argumentales): ambigüedad, carga probatoria mal puesta, falta de pedido concreto, etc.',
    '- "defenses": cómo blindar el argumento frente a cada ataque principal.',
    '- "suggestedRewrite" (opcional): una versión reforzada del fragmento, en texto plano, sin markdown.',
    '- Respondé íntegramente en español formal propio del derecho argentino.',
  ].join('\n')

  const prompt = [
    '--- FRAGMENTO A CUESTIONAR ---',
    fragment.trim(),
    '',
    effectiveRole
      ? `El abogado representa al ${effectiveRole.toUpperCase()}. Atacá desde ${adversary}.`
      : 'Atacá desde la parte contraria (sin rol explícito).',
    '',
    contextResult.text
      ? `--- CONTEXTO DEL CASO (tenelo en cuenta para que tus ataques no contradigan documentos) ---\n${contextResult.text.slice(0, 18000)}`
      : '(Sin contexto adicional del caso)',
    '',
    'Generá el objeto CounterArgueResult.',
  ].join('\n')

  let model
  try {
    model = resolveModel(PRIMARY_MODEL)
  } catch {
    model = resolveModel(FALLBACK_MODEL)
  }

  const result = streamObject({
    model,
    schema: CounterArgueResult,
    system,
    prompt,
    temperature: 0.5,
  })

  return result.toTextStreamResponse()
}
