/**
 * POST /api/lexia/documents/[id]/stress-test
 *
 * Fase 3 — "Stress-test" automático del borrador.
 *
 * Segmenta el documento por sección (headings), selecciona los párrafos de
 * mayor peso argumentativo (los que tienen longitud significativa), y para
 * cada uno le pide al modelo un informe estructurado desde la perspectiva
 * de la contraparte: ataques, debilidades, defensas y un rewrite opcional.
 *
 * Devuelve un StressReport completo con findings ordenados por severidad.
 */

import { generateObject } from 'ai'
import { z } from 'zod'

import { createClient } from '@/lib/supabase/server'
import { checkCasePermission } from '@/lib/utils/access-control'
import { resolveModel } from '@/lib/ai/resolver'
import {
  getDocument,
  StressReportSchema,
  StressFindingSchema,
  type TiptapDoc,
} from '@/lib/lexia/workspace'

export const dynamic = 'force-dynamic'
export const maxDuration = 90

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const PRIMARY_MODEL = 'anthropic/claude-sonnet-4-20250514'
const FALLBACK_MODEL = 'openai/gpt-4o'

// Small cap: stress-testing every paragraph would be expensive. We focus on
// the N heaviest paragraphs, measured by length. Lawyers generally care about
// the meatier sections first.
const MAX_CHUNKS = 8
const MIN_CHARS = 200

// -----------------------------------------------------------------------------
// Helpers: segment the Tiptap doc into (section, paragraph) pairs
// -----------------------------------------------------------------------------

interface Segment {
  section: string
  paragraph: string
}

interface AnyNode {
  type: string
  attrs?: Record<string, unknown>
  content?: AnyNode[]
  text?: string
}

function collectText(node: AnyNode): string {
  if (node.type === 'text') return node.text ?? ''
  if (!node.content) return ''
  return node.content.map(collectText).join('')
}

function segmentDoc(doc: TiptapDoc): Segment[] {
  const segments: Segment[] = []
  let currentSection = 'Documento'
  const walk = (n: AnyNode) => {
    if (n.type === 'heading') {
      const t = (n.content ?? [])
        .map((c) => (c.type === 'text' ? (c.text ?? '') : ''))
        .join('')
        .trim()
      if (t) currentSection = t
      return
    }
    if (n.type === 'paragraph') {
      const text = collectText(n).trim()
      if (text && text.length >= MIN_CHARS) {
        segments.push({ section: currentSection, paragraph: text })
      }
      return
    }
    for (const child of n.content ?? []) walk(child)
  }
  walk(doc as AnyNode)
  return segments
}

function pickChunks(segments: Segment[]): Segment[] {
  return segments
    .slice()
    .sort((a, b) => b.paragraph.length - a.paragraph.length)
    .slice(0, MAX_CHUNKS)
}

function oppositeRole(role?: string | null): string {
  if (!role) return 'la contraparte'
  const r = role.toLowerCase()
  if (r.includes('actor') || r.includes('demandante') || r.includes('accionante'))
    return 'la parte demandada'
  if (r.includes('demandad')) return 'la parte actora'
  if (r.includes('recurrente')) return 'la recurrida'
  if (r.includes('recurrid')) return 'la parte recurrente'
  return 'la contraparte'
}

// -----------------------------------------------------------------------------
// Route
// -----------------------------------------------------------------------------

const RequestSchema = z.object({
  context: z
    .object({
      documentIds: z.array(z.string().uuid()).default([]),
      personIds: z.array(z.string().uuid()).default([]),
    })
    .optional(),
})

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

  const body = await req.json().catch(() => ({}))
  const parsed = RequestSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json(
      { error: 'Parámetros inválidos', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const doc = await getDocument(supabase, id)
  if (!doc) return Response.json({ error: 'Documento no encontrado' }, { status: 404 })
  if (doc.caseId) {
    const canView = await checkCasePermission(supabase, user.id, doc.caseId, 'can_view')
    if (!canView) return Response.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const segments = segmentDoc(doc.content)
  if (segments.length === 0) {
    return Response.json({
      report: {
        overall: 'acceptable',
        summary:
          'El documento todavía es demasiado corto para un stress-test: escribí al menos un párrafo por sección.',
        findings: [],
      },
    })
  }

  const chunks = pickChunks(segments)
  const opposite = oppositeRole(doc.clientRole)

  let model
  try {
    model = resolveModel(PRIMARY_MODEL)
  } catch {
    model = resolveModel(FALLBACK_MODEL)
  }

  // Run per-chunk stress tests in parallel. generateObject is used (single
  // shot) to keep the overall latency bounded. If a chunk fails, we skip it
  // silently rather than aborting the whole report.
  const findings = await Promise.all(
    chunks.map(async (chunk) => {
      try {
        const { object } = await generateObject({
          model,
          schema: StressFindingSchema,
          system: [
            `Actúa como abogado de ${opposite} en un expediente argentino.`,
            'Tu tarea es auditar un PÁRRAFO escrito por la otra parte y producir:',
            '  - attacks: 1-3 ataques concretos y citables (citation si aplica: norma o fallo)',
            '  - defenses: 1-3 ideas para reforzar el párrafo frente a esos ataques',
            '  - suggestedRewrite: opcional; una versión reforzada del párrafo (máx 180 palabras)',
            '  - severity: low | medium | high según lo vulnerable que veas el párrafo',
            'NO inventes hechos. Si falta evidencia, señalalo en attacks.',
            'Respondé siempre en español formal argentino.',
          ].join('\n'),
          prompt: [
            `Sección: "${chunk.section}"`,
            '',
            'PÁRRAFO A AUDITAR:',
            chunk.paragraph,
          ].join('\n'),
          temperature: 0.5,
        })
        return {
          section: chunk.section,
          passage: chunk.paragraph,
          severity: object.severity ?? 'medium',
          attacks: object.attacks ?? [],
          defenses: object.defenses ?? [],
          suggestedRewrite: object.suggestedRewrite,
        }
      } catch (err) {
        console.error('[stress-test] chunk failed:', err)
        return null
      }
    })
  )

  const validFindings = findings.filter((f): f is NonNullable<typeof f> => !!f)

  // Overall score heuristic
  const high = validFindings.filter((f) => f.severity === 'high').length
  const med = validFindings.filter((f) => f.severity === 'medium').length
  const overall: 'strong' | 'acceptable' | 'weak' =
    high >= 2 ? 'weak' : high === 1 || med >= 3 ? 'acceptable' : 'strong'

  const summary =
    validFindings.length === 0
      ? 'No se pudieron auditar los párrafos. Probá de nuevo.'
      : `Se auditaron ${validFindings.length} párrafos clave. Detectamos ${high} ataque(s) fuerte(s) y ${med} observacion(es) medianas.`

  const report = StressReportSchema.parse({
    overall,
    summary,
    findings: validFindings.sort((a, b) => severityRank(b.severity) - severityRank(a.severity)),
  })

  return Response.json({ report })
}

function severityRank(s: 'low' | 'medium' | 'high'): number {
  return s === 'high' ? 2 : s === 'medium' ? 1 : 0
}
