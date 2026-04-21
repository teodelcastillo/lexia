/**
 * POST /api/lexia/documents/[id]/edit
 *
 * Core of the Workspace: given a selection (or insertion point) on a document
 * and a natural-language instruction, returns a structured EditOperation
 * (reasoning + replacement + alternatives + citations + caveats) streamed as
 * a partial object using the AI SDK `streamObject`.
 *
 * Design principles:
 *  - The AI never "writes over" the document. It proposes an operation.
 *  - The lawyer sees reasoning and sources before accepting.
 *  - Every proposal is persisted (pending) for audit; acceptance is later
 *    recorded by /accept.
 */

import { streamObject } from 'ai'
import { createClient } from '@/lib/supabase/server'
import { checkCasePermission } from '@/lib/utils/access-control'
import {
  getDocument,
  EditOperationSchema,
  EditRequestSchema,
  docToOutline,
} from '@/lib/lexia/workspace'
import { resolveModel } from '@/lib/ai/resolver'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Primary model: Claude Sonnet for legal drafting quality. Fallback on GPT-4o.
const PRIMARY_MODEL = 'anthropic/claude-sonnet-4-20250514'
const FALLBACK_MODEL = 'openai/gpt-4o'

// -----------------------------------------------------------------------------
// Prompt builders
// -----------------------------------------------------------------------------

function buildSystemPrompt(opts: {
  documentType: string
  clientRole: string | null
  caseNumber: string | null
  caseTitle: string | null
}): string {
  const roleLine = opts.clientRole
    ? `Representás al ${opts.clientRole.toUpperCase()} en este caso.`
    : 'No hay rol del cliente definido para este documento.'
  const caseLine =
    opts.caseNumber && opts.caseTitle
      ? `Caso: ${opts.caseNumber} - "${opts.caseTitle}".`
      : 'Sin caso asociado.'
  return [
    'Eres LEXIA, asistente de redacción jurídica para un estudio en Córdoba, Argentina.',
    `Tipo de documento actual: ${opts.documentType.toUpperCase()}.`,
    roleLine,
    caseLine,
    '',
    'PRINCIPIOS IRRENUNCIABLES:',
    '- NO inventes hechos, fechas, montos o identidades. Si faltan datos, DEJALO EXPLÍCITO en caveats.',
    '- Al citar normativa o fallos, da la referencia completa y exacta. Si no estás seguro, marcalo en caveats y NO la agregues a citations.',
    '- Tonalidad formal propia del derecho argentino. Párrafos claros, sin floritura.',
    '- Respondé SIEMPRE en el idioma español, formalmente.',
    '',
    'FORMATO DEL CAMPO "replacement":',
    '- Texto plano. Usá doble salto de línea para separar párrafos.',
    '- NO uses markdown (nada de **, ##, - listas).',
    '- NO envuelvas en comillas.',
    '- Si sustituís varios párrafos, escribilos separados por doble salto de línea.',
    '',
    'FORMATO DE "reasoning":',
    '- 2 a 6 oraciones explicando qué cambios hiciste y por qué.',
    '- En primera persona ("reformulé...", "separé en...", "cité el art. ...").',
    '- El abogado lo lee antes de aceptar; debe poder confiar rápido.',
    '',
    'FORMATO DE "citations":',
    '- Solo citas que usaste efectivamente en el reemplazo.',
    '- label exacto: "CCyCN art. 2560", "CPCC Córdoba art. 179", "CSJN, Fallos 340:1695", etc.',
    '',
    'Si la instrucción del usuario no se puede cumplir (falta información), devolvé un "replacement" igual al texto original y explicalo en "reasoning" pidiendo el dato faltante, marcando el caveat.',
  ].join('\n')
}

function buildUserPrompt(opts: {
  mode: 'selection' | 'insert'
  instruction: string
  selectionText: string
  outline: string
  documentText: string
  extraContext: string
}): string {
  const head =
    opts.mode === 'selection'
      ? 'El abogado seleccionó un fragmento y pide una edición sobre ese fragmento.'
      : 'El abogado posicionó el cursor en una línea vacía y pide que se redacte allí texto nuevo.'

  const selectionBlock =
    opts.mode === 'selection'
      ? `\n--- FRAGMENTO SELECCIONADO ---\n${opts.selectionText || '(vacío)'}\n`
      : '\n--- POSICIÓN DE INSERCIÓN ---\n(línea vacía dentro del documento)\n'

  return [
    head,
    '',
    `--- ESTRUCTURA DEL DOCUMENTO ---\n${opts.outline || '(sin encabezados)'}`,
    selectionBlock,
    '--- DOCUMENTO COMPLETO (para contexto, no lo reescribas) ---',
    opts.documentText.slice(0, 12000),
    opts.extraContext ? `\n--- CONTEXTO ADICIONAL ---\n${opts.extraContext}` : '',
    '',
    `--- INSTRUCCIÓN DEL ABOGADO ---\n"${opts.instruction.trim()}"`,
    '',
    opts.mode === 'selection'
      ? 'Generá el objeto EditOperation. "replacement" reemplaza exclusivamente el fragmento seleccionado, conservando el estilo y la coherencia con el resto del documento.'
      : 'Generá el objeto EditOperation. "replacement" es el texto nuevo a insertar en esa posición.',
  ]
    .filter(Boolean)
    .join('\n')
}

async function fetchCaseContextText(
  supabase: Awaited<ReturnType<typeof createClient>>,
  caseId: string | null,
  documentIds: string[],
  personIds: string[],
): Promise<string> {
  if (!caseId) return ''
  const parts: string[] = []

  // Documents (metadata only - content extraction is another story).
  if (documentIds.length > 0) {
    const { data } = await supabase
      .from('documents')
      .select('id, file_name')
      .eq('case_id', caseId)
      .in('id', documentIds)
      .limit(10)
    if (Array.isArray(data) && data.length > 0) {
      parts.push(
        'Documentos del caso seleccionados por el abogado (metadata):\n' +
          data.map((d) => `- ${(d as { file_name?: string }).file_name ?? '(sin nombre)'}`).join('\n')
      )
    }
  }

  // Personas
  if (personIds.length > 0) {
    const { data } = await supabase
      .from('people')
      .select('id, first_name, last_name, name, person_type')
      .in('id', personIds)
      .limit(20)
    if (Array.isArray(data) && data.length > 0) {
      parts.push(
        'Personas del caso seleccionadas:\n' +
          data
            .map((p) => {
              const person = p as {
                first_name?: string
                last_name?: string
                name?: string
                person_type?: string
              }
              const nm = person.name || `${person.first_name ?? ''} ${person.last_name ?? ''}`.trim()
              return `- ${nm} (${person.person_type ?? 'persona'})`
            })
            .join('\n')
      )
    }
  }
  return parts.join('\n\n')
}

// -----------------------------------------------------------------------------
// Handler
// -----------------------------------------------------------------------------

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
  if (authError || !user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return Response.json({ error: 'Cuerpo JSON invalido' }, { status: 400 })
  }
  const parsed = EditRequestSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json(
      { error: 'Parámetros invalidos', details: parsed.error.flatten() },
      { status: 400 }
    )
  }
  const { instruction, mode, selection, context } = parsed.data

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

  const extraContext = await fetchCaseContextText(
    supabase,
    doc.caseId,
    context?.documentIds ?? [],
    context?.personIds ?? []
  )

  const system = buildSystemPrompt({
    documentType: doc.documentType,
    clientRole: doc.clientRole ?? null,
    caseNumber,
    caseTitle,
  })
  const userPrompt = buildUserPrompt({
    mode,
    instruction,
    selectionText: selection?.text ?? '',
    outline: docToOutline(doc.content),
    documentText: doc.contentText,
    extraContext,
  })

  // Persist the edit attempt (pending) for audit.
  const { data: editRow } = await supabase
    .from('lexia_document_edits')
    .insert({
      document_id: id,
      user_id: user.id,
      instruction,
      mode,
      selection_from: selection?.from ?? null,
      selection_to: selection?.to ?? null,
      selection_text: selection?.text ?? null,
      context: context ?? {},
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
    schema: EditOperationSchema,
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
            replacement: object?.replacement ?? null,
            alternatives: object?.alternatives ?? [],
            citations: object?.citations ?? [],
            tokens_used: usage?.totalTokens ?? 0,
          })
          .eq('id', editId)
      } catch (err) {
        console.error('[Lexia Workspace] Failed to record edit result:', err)
      }
    },
  })

  // Include the editId in a header so the client can reference it on accept.
  const response = result.toTextStreamResponse()
  if (editId) response.headers.set('x-lexia-edit-id', editId)
  return response
}
