/**
 * Lexia - AI Legal Assistant API Route
 *
 * Thin HTTP layer: auth, validation, controller decision, then orchestrator.
 * The orchestrator (lib/ai/orchestrator.ts) resolves the provider model and
 * runs streamText with fallback; this route only returns the stream response.
 */

import {
  convertToModelMessages,
  validateUIMessages,
  createIdGenerator,
  consumeStream,
  type UIMessage,
  type InferUITools,
  type UIDataTypes,
} from 'ai'
import { createClient } from '@/lib/supabase/server'
import { checkCasePermission } from '@/lib/utils/access-control'

import {
  processRequest,
  enrichCaseContext,
  finalizeDecision,
  createAuditEntry,
  lexiaTools,
  getToolsForIntent,
  runStreamWithFallback,
  checkCreditsRemaining,
  recordLexiaUsage,
  getCreditsForIntent,
  type CaseContextInput,
} from '@/lib/ai'
import {
  loadMessagesForConversation,
  saveMessages,
  updateConversationMeta,
  updateConversation,
  generateConversationTitle,
  getFirstUserMessageText,
  DEFAULT_TITLE,
} from '@/lib/lexia'

export const maxDuration = 60

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const LEXIA_CREDITS_ENFORCEMENT = process.env.LEXIA_CREDITS_ENFORCEMENT === 'true'

// Export message type (unchanged - UI compatibility)
export type LexiaMessage = UIMessage<never, UIDataTypes, InferUITools<typeof lexiaTools>>

/**
 * Extracts the latest user message text from UIMessage parts.
 * Used by the controller for intent classification.
 */
function getLatestUserMessage(messages: UIMessage[]): string {
  const lastUserMsg = [...messages].reverse().find(m => m.role === 'user')
  if (!lastUserMsg?.parts) return ''
  return lastUserMsg.parts
    .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
    .map(p => p.text)
    .join(' ')
}

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

/** Extract tool names invoked from AI SDK onFinish options (steps or toolCalls). */
function getToolNamesFromFinishOptions(options: unknown): string[] {
  if (!options || typeof options !== 'object') return []
  const o = options as Record<string, unknown>
  if (Array.isArray(o.toolCalls)) {
    return (o.toolCalls as Array<{ toolName?: string }>)
      .map(t => t.toolName)
      .filter((name): name is string => typeof name === 'string')
  }
  if (Array.isArray(o.steps)) {
    const names: string[] = []
    for (const step of o.steps as Array<{ toolCalls?: Array<{ toolName?: string }> }>) {
      if (Array.isArray(step.toolCalls)) {
        for (const t of step.toolCalls) {
          if (typeof t.toolName === 'string') names.push(t.toolName)
        }
      }
    }
    return [...new Set(names)]
  }
  return []
}

/**
 * POST handler - Lexia chat endpoint
 */
export async function POST(req: Request) {
  const startTime = Date.now()

  try {
    const supabase = await createClient()

    // 1. Authenticate
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

    // 2. Parse request body
    const body = await req.json()
    const caseContextInput: CaseContextInput | null = body.caseContext || null
    const conversationId = body.conversationId ?? body.id ?? null

    // 3. Resolve messages: load from DB if conversationId, else use client messages
    let messages: UIMessage[]
    if (conversationId) {
      const previousMessages = await loadMessagesForConversation(supabase, conversationId, user.id)
      const clientMessages = Array.isArray(body.messages) ? body.messages : []
      if (clientMessages.length === 1) {
        messages = [...previousMessages, clientMessages[0] as UIMessage]
      } else if (clientMessages.length > 1) {
        messages = clientMessages as UIMessage[]
      } else {
        messages = previousMessages
      }
    } else {
      messages = Array.isArray(body.messages) ? (body.messages as UIMessage[]) : []
    }

    // 4. Validate messages
    const validatedMessages = await validateUIMessages<LexiaMessage>({
      messages,
      tools: lexiaTools,
    })

    // 5. Extract latest user message for intent classification
    const userMessage = getLatestUserMessage(validatedMessages)

    // 6. Ask controller for a decision
    let decision = processRequest(userMessage, caseContextInput, user.id)

    // 5b. Validate case access before enriching context
    if (caseContextInput) {
      const canView = await checkCasePermission(supabase, user.id, caseContextInput.caseId, 'can_view')
      if (!canView) {
        return new Response(JSON.stringify({ error: 'Forbidden: no access to this case' }), { status: 403 })
      }
    }

    // 6. Enrich case context if the controller says we need it
    let caseContext = null
    if (decision.enrichContext && caseContextInput) {
      caseContext = await enrichCaseContext(supabase, caseContextInput)
    }

    // 7. Finalize the decision (builds system prompt with context)
    decision = finalizeDecision(decision, caseContext)

    // 10. Resolve tools based on intent classification
    const activeTools = getToolsForIntent(decision.classification.toolsAllowed)
    const modelMessages = await convertToModelMessages(validatedMessages)

    // 11. Orchestrator: resolve provider, stream with fallback
    const { result, decision: finalDecision } = await runStreamWithFallback({
      messages: modelMessages,
      decision,
      tools: activeTools,
    })

    return result.toUIMessageStreamResponse({
      originalMessages: validatedMessages,
      generateMessageId: createIdGenerator({ prefix: 'msg', size: 16 }),
      // Consume a copy of the stream on the server so onFinish runs when the response completes
      consumeSseStream: async ({ stream }) => {
        await consumeStream({ stream })
      },
      onFinish: async (options) => {
        const durationMs = Date.now() - startTime
        const tokensUsed = (options as { usage?: { totalTokens?: number } }).usage?.totalTokens ?? 0
        const creditsCharged = getCreditsForIntent(finalDecision.classification.intent)

        try {
          await recordLexiaUsage(
            supabase,
            user.id,
            finalDecision.traceId,
            finalDecision.classification.intent,
            creditsCharged,
            tokensUsed,
          )
        } catch (err) {
          console.error('[Lexia] Error recording usage:', err)
        }

        const toolsInvoked = getToolNamesFromFinishOptions(options)
        const audit = createAuditEntry(
          finalDecision,
          user.id,
          validatedMessages.length,
          tokensUsed,
          durationMs,
          toolsInvoked,
        )

        // Persist messages when conversationId is present (single source of truth)
        const messagesToSave =
          (options.messages?.length ? options.messages : undefined) ??
          (options.responseMessage
            ? ([...validatedMessages, options.responseMessage] as UIMessage[])
            : undefined)
        if (conversationId && messagesToSave?.length && UUID_REGEX.test(conversationId)) {
          try {
            await saveMessages(supabase, conversationId, messagesToSave, {
              tokensUsed,
            })
            await updateConversationMeta(supabase, conversationId, {
              message_count: messagesToSave.length,
              last_message_at: new Date().toISOString(),
              intent: finalDecision.classification.intent,
              model_used: finalDecision.serviceConfig.model,
            })
            // Generate title only once, from the 1st user message (skip entirely when not 1st)
            const userMessageCount = messagesToSave.filter((m) => m.role === 'user').length
            if (userMessageCount === 1) {
              const firstUserText = getFirstUserMessageText(messagesToSave)
              if (firstUserText) {
                const { data: conv } = await supabase
                  .from('lexia_conversations')
                  .select('title')
                  .eq('id', conversationId)
                  .eq('user_id', user.id)
                  .single()
                if (conv?.title === DEFAULT_TITLE) {
                  const title = await generateConversationTitle(firstUserText)
                  if (title) {
                    await updateConversation(supabase, conversationId, user.id, { title })
                  }
                }
              }
            }
          } catch (err) {
            console.error('[Lexia] Error saving conversation:', err)
          }
        } else if (conversationId && !UUID_REGEX.test(conversationId)) {
          console.warn('[Lexia] Skip saveMessages: invalid conversationId format', conversationId)
        }

        // Log to activity_log for backward compatibility
        try {
          await supabase.from('activity_log').insert({
            user_id: user.id,
            action_type: 'lexia_query',
            entity_type: caseContextInput ? 'case' : 'general',
            entity_id: caseContextInput?.caseId || 'general',
            description: `Lexia [${finalDecision.classification.intent}] via ${audit.model} (${durationMs}ms)`,
            case_id: caseContextInput?.caseId || null,
          })
        } catch (err) {
          console.error('[Lexia] Error logging usage:', err)
        }
      },
    })
  } catch (error) {
    console.error('[Lexia] API error:', error)
    return new Response(JSON.stringify({
      error: 'Error processing request',
      details: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
