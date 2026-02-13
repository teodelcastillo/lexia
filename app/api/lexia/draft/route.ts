/**
 * Lexia Document Drafting API - POST /api/lexia/draft
 *
 * Generates legal document drafts via streaming. Uses Claude Sonnet with
 * fallback to GPT-4 Turbo. No tools - pure text generation.
 */

import { streamText } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { createClient } from '@/lib/supabase/server'
import { checkCasePermission } from '@/lib/utils/access-control'

import { resolveModel } from '@/lib/ai/resolver'
import { getModelConfig } from '@/lib/ai/providers'
import { checkCreditsRemaining, recordLexiaUsage } from '@/lib/ai/usage'
import { getCreditsForIntent } from '@/lib/ai/credits'
import { buildDraftPrompt, buildDraftUserMessage, resolveTemplateContent } from '@/lib/ai/draft-prompts'
import { normalizeFormDataForPrompt } from '@/lib/lexia/party-utils'
import {
  isDocumentType,
  validateFormData,
  type DocumentType,
} from '@/lib/ai/draft-schemas'

export const maxDuration = 90

const LEXIA_CREDITS_ENFORCEMENT = process.env.LEXIA_CREDITS_ENFORCEMENT === 'true'

const LEXIA_RATE_LIMIT_WINDOW_MS = 60_000
const LEXIA_RATE_LIMIT_MAX = 60
const rateLimitStore = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(userId: string): boolean {
  const now = Date.now()
  const entry = rateLimitStore.get(userId)
  if (!entry) {
    rateLimitStore.set(userId, { count: 1, resetAt: now + LEXIA_RATE_LIMIT_WINDOW_MS })
    return true
  }
  if (now >= entry.resetAt) {
    rateLimitStore.set(userId, { count: 1, resetAt: now + LEXIA_RATE_LIMIT_WINDOW_MS })
    return true
  }
  if (entry.count >= LEXIA_RATE_LIMIT_MAX) return false
  entry.count += 1
  return true
}

/** Document types that use extended thinking (complex reasoning) */
const EXTENDED_THINKING_TYPES: DocumentType[] = [
  'demanda',
  'contestacion',
  'casacion',
  'contrato',
]

export async function POST(req: Request) {
  const startTime = Date.now()

  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    }

    if (!checkRateLimit(user.id)) {
      return new Response(
        JSON.stringify({ error: 'Too many requests. Please try again later.' }),
        { status: 429, headers: { 'Retry-After': '60' } }
      )
    }

    const body = await req.json()
    const documentType = body.documentType as string
    const variant = (body.variant as string | undefined) ?? ''
    const formData = (body.formData ?? {}) as Record<string, string>
    const caseContext = body.caseContext as {
      caseId?: string
      caseNumber?: string
      title?: string
      type?: string
    } | null
    const previousDraft = body.previousDraft as string | null
    const iterationInstruction = body.iterationInstruction as string | null
    const demandaContext = body.demandaContext as string | null | undefined

    if (!isDocumentType(documentType)) {
      return new Response(
        JSON.stringify({ error: 'Invalid documentType' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    if (LEXIA_CREDITS_ENFORCEMENT) {
      const credits = await checkCreditsRemaining(supabase, user.id)
      if (!credits.allowed) {
        return new Response(
          JSON.stringify({
            error: 'Credits exhausted for this period. Usage resets next month.',
            remaining: 0,
            limit: credits.limit,
          }),
          { status: 402, headers: { 'Content-Type': 'application/json' } }
        )
      }
    }

    if (caseContext?.caseId) {
      const canView = await checkCasePermission(supabase, user.id, caseContext.caseId, 'can_view')
      if (!canView) {
        return new Response(JSON.stringify({ error: 'Forbidden: no access to this case' }), { status: 403 })
      }
    }

    // Load template from DB (org-specific or global) - needed for structure_schema validation
    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single()

    const orgId = profile?.organization_id ?? null

    type TemplateRow = {
      system_prompt_fragment: string | null
      template_content: string | null
      structure_schema: unknown
    }

    let template: TemplateRow | null = null
    if (orgId) {
      const { data: orgTemplate } = await supabase
        .from('lexia_document_templates')
        .select('system_prompt_fragment, template_content, structure_schema')
        .eq('document_type', documentType)
        .eq('variant', variant)
        .eq('organization_id', orgId)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle()
      if (orgTemplate) template = orgTemplate as TemplateRow
    }
    if (!template) {
      const { data: globalTemplate } = await supabase
        .from('lexia_document_templates')
        .select('system_prompt_fragment, template_content, structure_schema')
        .eq('document_type', documentType)
        .eq('variant', variant)
        .is('organization_id', null)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle()
      if (globalTemplate) template = globalTemplate as TemplateRow
    }

    const structureSchema = template?.structure_schema as { fields?: unknown[] } | null
    const sanitizedStructureSchema =
      structureSchema && typeof structureSchema === 'object' && Array.isArray(structureSchema.fields)
        ? structureSchema
        : null

    const validation = validateFormData(documentType, formData, sanitizedStructureSchema)
    if (!validation.success) {
      return new Response(
        JSON.stringify({ error: 'Validation failed', errors: validation.errors }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Carta documento: sin IA, solo contenido del usuario (ahorra costos y evita errores)
    if (documentType === 'carta_documento') {
      const texto = (validation.data.texto ?? '').trim() || '\u00A0'
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(texto))
          controller.close()
        },
      })
      return new Response(stream, {
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      })
    }

    const templateFragment = template?.system_prompt_fragment ?? null
    const templateContent = template?.template_content ?? null
    const resolvedFormData = normalizeFormDataForPrompt(validation.data, documentType)
    const baseContent = resolveTemplateContent(templateContent, resolvedFormData)

    const systemPrompt = buildDraftPrompt({
      documentType,
      formData: resolvedFormData,
      templateFragment,
      baseContent: baseContent || null,
      caseContext: caseContext
        ? {
            caseNumber: caseContext.caseNumber ?? '',
            title: caseContext.title ?? '',
            type: caseContext.type,
          }
        : null,
      demandaContext: demandaContext ?? null,
      previousDraft,
      iterationInstruction,
    })

    const userMessage = buildDraftUserMessage(documentType, iterationInstruction)

    const primaryConfig = getModelConfig('claude-sonnet')
    const fallbackConfig = getModelConfig('gpt4-turbo')
    const maxTokens = 8192
    const useExtendedThinking = EXTENDED_THINKING_TYPES.includes(documentType)

    const streamOptionsBase = {
      system: systemPrompt,
      messages: [{ role: 'user' as const, content: userMessage }],
      maxTokens,
    }
    const streamOptions = useExtendedThinking
      ? streamOptionsBase
      : { ...streamOptionsBase, temperature: 0.6 }

    let modelUsed = primaryConfig?.model ?? 'anthropic/claude-sonnet-4-20250514'

    try {
      const model = useExtendedThinking && primaryConfig?.model.startsWith('anthropic/')
        ? anthropic('claude-sonnet-4-20250514', {
            thinking: { type: 'enabled' as const, budgetTokens: 4096 },
          })
        : resolveModel(primaryConfig?.model ?? 'anthropic/claude-sonnet-4-20250514')
      const result = streamText({
        model,
        ...streamOptions,
      })

      return result.toTextStreamResponse({
        onFinish: async (options) => {
          const durationMs = Date.now() - startTime
          const tokensUsed = options.usage?.totalTokens ?? 0
          const creditsCharged = getCreditsForIntent('document_drafting')

          try {
            await recordLexiaUsage(
              supabase,
              user.id,
              `draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              'document_drafting',
              creditsCharged,
              tokensUsed,
            )
          } catch (err) {
            console.error('[Lexia Draft] Error recording usage:', err)
          }

          try {
            await supabase.from('activity_log').insert({
              user_id: user.id,
              action_type: 'lexia_query',
              entity_type: caseContext?.caseId ? 'case' : 'general',
              entity_id: caseContext?.caseId ?? 'general',
              description: `Lexia Draft [${documentType}] via ${modelUsed} (${durationMs}ms)`,
              case_id: caseContext?.caseId ?? null,
            })
          } catch (err) {
            console.error('[Lexia Draft] Error logging:', err)
          }
        },
      })
    } catch (primaryError) {
      console.warn('[Lexia Draft] Primary model failed, using fallback:', primaryError)
      if (!fallbackConfig) throw primaryError

      modelUsed = fallbackConfig.model
      const model = resolveModel(fallbackConfig.model)
      const result = streamText({
        model,
        ...streamOptions,
      })

      return result.toTextStreamResponse({
        onFinish: async (options) => {
          const durationMs = Date.now() - startTime
          const tokensUsed = options.usage?.totalTokens ?? 0
          const creditsCharged = getCreditsForIntent('document_drafting')

          try {
            await recordLexiaUsage(
              supabase,
              user.id,
              `draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              'document_drafting',
              creditsCharged,
              tokensUsed,
            )
          } catch (err) {
            console.error('[Lexia Draft] Error recording usage:', err)
          }

          try {
            await supabase.from('activity_log').insert({
              user_id: user.id,
              action_type: 'lexia_query',
              entity_type: caseContext?.caseId ? 'case' : 'general',
              entity_id: caseContext?.caseId ?? 'general',
              description: `Lexia Draft [${documentType}] via ${modelUsed} fallback (${durationMs}ms)`,
              case_id: caseContext?.caseId ?? null,
            })
          } catch (err) {
            console.error('[Lexia Draft] Error logging:', err)
          }
        },
      })
    }
  } catch (error) {
    console.error('[Lexia Draft] API error:', error)
    return new Response(
      JSON.stringify({
        error: 'Error processing request',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
