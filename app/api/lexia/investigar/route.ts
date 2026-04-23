/**
 * POST /api/lexia/investigar
 *
 * "Investigar" mode of the Lexia Workspace: given a caseId + documentIds + a
 * question, returns a structured answer citing passages from the documents.
 *
 * Streamed as a partial object:
 *   {
 *     answer: string                  // natural language answer in Spanish
 *     citations: Array<{
 *       documentId: string
 *       documentName: string
 *       passage: string               // verbatim quote from the document
 *       relevance: 'high'|'medium'|'low'
 *     }>
 *     caveats: string[]               // things the docs do NOT answer / risks
 *     followUps: string[]             // suggested follow-up questions
 *   }
 *
 * We purposefully do NOT use embeddings here: the current dataset is small
 * per-case and full-text in the prompt gives higher quality answers with less
 * moving parts. If needed later, we can add pgvector retrieval behind the
 * same contract.
 */

import { streamObject } from 'ai'
import { z } from 'zod'

import { createClient } from '@/lib/supabase/server'
import { checkCasePermission } from '@/lib/utils/access-control'
import { resolveModel } from '@/lib/ai/resolver'
import { extractDocumentsForCase } from '@/lib/lexia/workspace/document-extract'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const PRIMARY_MODEL = 'anthropic/claude-sonnet-4-20250514'
const FALLBACK_MODEL = 'openai/gpt-4o'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const RequestSchema = z.object({
  caseId: z.string().regex(UUID_REGEX),
  documentIds: z.array(z.string().regex(UUID_REGEX)).min(1).max(10),
  question: z.string().min(4).max(1000),
})

const CitationSchema = z.object({
  documentId: z.string(),
  documentName: z.string(),
  passage: z.string().min(1).max(800),
  relevance: z.enum(['high', 'medium', 'low']).default('medium'),
})

const AnswerSchema = z.object({
  answer: z.string().min(1),
  citations: z.array(CitationSchema).max(12).default([]),
  caveats: z.array(z.string()).max(6).default([]),
  followUps: z.array(z.string()).max(4).default([]),
})

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
  const { caseId, documentIds, question } = parsed.data

  const canView = await checkCasePermission(supabase, user.id, caseId, 'can_view')
  if (!canView) {
    return Response.json({ error: 'Sin permisos sobre el caso' }, { status: 403 })
  }

  const extracted = await extractDocumentsForCase(supabase, caseId, documentIds, {
    maxCharsPerDoc: 12000,
    maxDocs: 10,
  })
  const usable = extracted.filter((d) => !d.error && d.text.length > 0)
  if (usable.length === 0) {
    return Response.json(
      {
        error:
          'Ninguno de los documentos seleccionados tiene texto extraíble. Subí PDFs o Word al caso para poder investigar.',
      },
      { status: 422 }
    )
  }

  const documentsBlock = usable
    .map((d, i) => `--- DOC #${i + 1} — id:${d.id} — "${d.name}" ---\n${d.text}`)
    .join('\n\n')

  const system = [
    'Sos LEXIA en modo INVESTIGAR. Respondés preguntas jurídicas usando SOLO los documentos del caso que te paso.',
    '',
    'REGLAS:',
    '- NO inventes información que no esté en los documentos.',
    '- Si los documentos no cubren la pregunta, decílo en claro y ponelo en "caveats".',
    '- Citá SIEMPRE al menos un pasaje textual cuando afirmes algo (campo citations).',
    '- En cada citation, "passage" debe ser un fragmento literal copiado del documento (sin parafrasear).',
    '- "documentId" debe coincidir exactamente con el id que te paso en el bloque DOC.',
    '- Respondé siempre en español formal propio del derecho argentino.',
    '- "answer" va en prosa clara, 1 a 3 párrafos, con las conclusiones accionables para el abogado.',
    '- "followUps" son 1-3 preguntas concretas que el abogado podría hacer a continuación.',
  ].join('\n')

  const prompt = [
    `Pregunta del abogado: "${question.trim()}"`,
    '',
    'Documentos disponibles (id entre comillas para que los cites tal cual):',
    documentsBlock,
    '',
    'Respondé el objeto estructurado AnswerSchema.',
  ].join('\n')

  let model
  try {
    model = resolveModel(PRIMARY_MODEL)
  } catch {
    model = resolveModel(FALLBACK_MODEL)
  }

  const result = streamObject({
    model,
    schema: AnswerSchema,
    system,
    prompt,
    temperature: 0.3,
  })

  return result.toTextStreamResponse()
}
