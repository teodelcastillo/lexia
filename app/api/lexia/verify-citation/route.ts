/**
 * POST /api/lexia/verify-citation
 *
 * Verifica una lista de citas (normativa / jurisprudencia / doctrina).
 *
 * Estrategia (MVP v1):
 *   1. Heurística local: valida forma, detecta referencias obviamente erroneas.
 *   2. Juez LLM escéptico: se le pide que marque como:
 *        - "verified"     si está seguro que existe tal y como se cita
 *        - "warning"      si la referencia es plausible pero no puede confirmar
 *        - "invalid"      si hay motivos fuertes para pensar que no existe,
 *                         es una alucinación o la referencia está mal formada
 *        y que aporte `explanation` y `suggestedLabel` cuando corresponda.
 *
 * El cliente usa la respuesta para pintar los chips de las citas (verde /
 * amarillo / rojo) y para mostrar al abogado por qué.
 */

import { generateObject } from 'ai'
import { z } from 'zod'

import { createClient } from '@/lib/supabase/server'
import { resolveModel } from '@/lib/ai/resolver'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

const PRIMARY_MODEL = 'openai/gpt-4o-mini'
const FALLBACK_MODEL = 'openai/gpt-4o'

// -----------------------------------------------------------------------------
// Schemas
// -----------------------------------------------------------------------------

const CitationKind = z.enum(['norma', 'jurisprudencia', 'doctrina'])

const InputCitationSchema = z.object({
  label: z.string().min(1).max(400),
  kind: CitationKind.default('norma'),
  quote: z.string().max(2000).optional(),
})

const RequestSchema = z.object({
  citations: z.array(InputCitationSchema).min(1).max(20),
})

const VerdictEnum = z.enum(['verified', 'warning', 'invalid'])

const VerdictItemSchema = z.object({
  index: z.number().int().nonnegative(),
  status: VerdictEnum,
  confidence: z.number().min(0).max(1).default(0.5),
  explanation: z.string().min(1),
  suggestedLabel: z.string().optional(),
  source: z.string().optional(),
})

const VerdictPayloadSchema = z.object({
  verdicts: z.array(VerdictItemSchema),
})

// -----------------------------------------------------------------------------
// Heurísticas locales (baratas, rápidas, antes de llamar al modelo)
// -----------------------------------------------------------------------------

/** Patrones razonables para normativa argentina: CCyCN art. 123, Ley 27.401 art. 7, CPCC Córdoba art. 80. */
const NORMA_PATTERN = /\b(art(?:\.|ículo)?|ley|decreto|ccycn|cn|cpcc|cpccn|cpcya)\b/i

/** Patrones para fallos: CSJN Fallos 340:1695, TSJ Córdoba, Sala I, etc. */
const JURIS_PATTERN = /\b(fallos|csjn|tsj|sala|cam(?:\.|ara)|cncom|cnciv|cfed)\b/i

function heuristicCheck(
  c: z.infer<typeof InputCitationSchema>
): { status: 'verified' | 'warning' | 'invalid'; reason: string } | null {
  const label = c.label.trim()
  if (label.length < 5) {
    return { status: 'invalid', reason: 'Referencia demasiado corta para ser una cita válida.' }
  }

  if (c.kind === 'norma' && !NORMA_PATTERN.test(label)) {
    return {
      status: 'warning',
      reason: 'La referencia no contiene marcadores típicos de normativa (art., Ley, Decreto, CCyCN…).',
    }
  }
  if (c.kind === 'jurisprudencia' && !JURIS_PATTERN.test(label)) {
    return {
      status: 'warning',
      reason: 'No se detectó marcador típico de fallo (CSJN, Fallos, Sala, Cám., etc.).',
    }
  }
  return null
}

// -----------------------------------------------------------------------------
// Juez LLM (prompt escéptico)
// -----------------------------------------------------------------------------

const JUDGE_SYSTEM = [
  'Eres un verificador experto de citas jurídicas del derecho argentino (nación y provincia de Córdoba).',
  'Tu única tarea es evaluar si cada cita que recibes existe y está bien formada.',
  '',
  'REGLAS DE VEREDICTO:',
  '- "verified" SOLO si estás razonablemente seguro que existe exactamente esa referencia.',
  '  (Normativa nacional vigente muy conocida: CCyCN, CN, LCT, Ley 24.240, Ley 27.401, CPCCN; o fallos CSJN citables por tomo:página si son clásicos).',
  '- "warning" si la referencia es plausible pero no podés confirmar con certeza',
  '  (doctrina, fallos provinciales, artículos específicos que podrían haberse renumerado, etc.).',
  '- "invalid" si la referencia está mal formada, no existe, es anacrónica, o',
  '  tiene fuertes indicios de alucinación (por ejemplo "CCyCN art. 9999" cuando el código no llega a ese número).',
  '',
  'SIEMPRE preferí "warning" sobre "verified" si tenés cualquier duda real.',
  'NUNCA inventes fuentes. Si no conocés la cita, usá "warning" o "invalid" según corresponda.',
  'Respondé SOLO en español, formal y breve.',
].join('\n')

function buildJudgeUserPrompt(items: Array<z.infer<typeof InputCitationSchema>>): string {
  const lines: string[] = [
    'Evaluá las siguientes citas y devolvé un veredicto por cada una (conservando el índice).',
    '',
  ]
  items.forEach((c, i) => {
    lines.push(`#${i} [${c.kind}] ${c.label}`)
    if (c.quote) lines.push(`    cita textual: "${c.quote.slice(0, 400)}"`)
  })
  lines.push('')
  lines.push(
    'Para cada una incluí: index, status (verified|warning|invalid), confidence (0-1), explanation (2-4 oraciones), suggestedLabel (si conviene corregir el formato), source (breve, opcional).'
  )
  return lines.join('\n')
}

// -----------------------------------------------------------------------------
// Handler
// -----------------------------------------------------------------------------

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
  const { citations } = parsed.data

  // Primero corremos heurísticas. Si son claras, no llamamos al modelo para ellas.
  const heuristics = citations.map((c) => heuristicCheck(c))
  const needLLM: Array<{ origIndex: number; c: z.infer<typeof InputCitationSchema> }> = []
  citations.forEach((c, i) => {
    if (heuristics[i]?.status !== 'invalid') {
      needLLM.push({ origIndex: i, c })
    }
  })

  type Verdict = z.infer<typeof VerdictItemSchema>
  const results: Verdict[] = citations.map((_, i) => ({
    index: i,
    status: heuristics[i]?.status ?? 'warning',
    confidence: 0.3,
    explanation: heuristics[i]?.reason ?? 'Pendiente de revisión automática.',
  }))

  if (needLLM.length > 0) {
    let model
    try {
      model = resolveModel(PRIMARY_MODEL)
    } catch {
      model = resolveModel(FALLBACK_MODEL)
    }

    try {
      const judge = await generateObject({
        model,
        schema: VerdictPayloadSchema,
        system: JUDGE_SYSTEM,
        prompt: buildJudgeUserPrompt(needLLM.map((x) => x.c)),
        temperature: 0.1,
      })

      const byLocalIndex = new Map<number, Verdict>()
      for (const v of judge.object.verdicts) byLocalIndex.set(v.index, v)

      needLLM.forEach(({ origIndex }, localIndex) => {
        const v = byLocalIndex.get(localIndex)
        if (!v) return
        // Si la heurística ya había marcado warning y el modelo dice verified,
        // lo dejamos en "warning" como piso de seguridad.
        const heuristic = heuristics[origIndex]
        const status: Verdict['status'] =
          heuristic?.status === 'warning' && v.status === 'verified' ? 'warning' : v.status

        results[origIndex] = {
          index: origIndex,
          status,
          confidence: v.confidence,
          explanation:
            heuristic && status === 'warning'
              ? `${heuristic.reason} ${v.explanation}`.trim()
              : v.explanation,
          suggestedLabel: v.suggestedLabel,
          source: v.source,
        }
      })
    } catch (err) {
      console.error('[verify-citation] judge failed:', err)
      // En caso de error, dejamos todo como warning con explicación genérica.
      needLLM.forEach(({ origIndex }) => {
        if (results[origIndex].status !== 'invalid') {
          results[origIndex] = {
            index: origIndex,
            status: 'warning',
            confidence: 0.2,
            explanation:
              'No se pudo verificar automáticamente. Revisá la cita manualmente antes de confiar en ella.',
          }
        }
      })
    }
  }

  return Response.json({ verdicts: results })
}
