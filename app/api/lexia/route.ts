/**
 * Lexia - AI Legal Assistant API Route
 * 
 * Refactored to use the 3-layer architecture:
 *   UI (useChat) -> API Route (this file) -> Controller -> Decision -> streamText
 * 
 * This route is a thin HTTP layer. It:
 * 1. Authenticates the user
 * 2. Validates messages  
 * 3. Asks the controller for a decision (intent, provider, config)
 * 4. Executes streamText with the controller's decision
 * 5. Logs the interaction for audit
 * 
 * The route does NOT decide which model to use or how to build prompts.
 * That logic lives in the controller (lib/ai/lexia-controller.ts).
 */

import {
  convertToModelMessages,
  streamText,
  validateUIMessages,
  stepCountIs,
  type UIMessage,
  type InferUITools,
  type UIDataTypes,
} from 'ai'
import { createClient } from '@/lib/supabase/server'

import {
  processRequest,
  enrichCaseContext,
  finalizeDecision,
  createAuditEntry,
  lexiaTools,
  getToolsForIntent,
  type CaseContextInput,
} from '@/lib/ai'

export const maxDuration = 60

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

    // 2. Parse request body
    const body = await req.json()
    const caseContextInput: CaseContextInput | null = body.caseContext || null

    // 3. Validate messages (unchanged - UI compatibility)
    const messages = await validateUIMessages<LexiaMessage>({
      messages: body.messages,
      tools: lexiaTools,
    })

    // 4. Extract latest user message for intent classification
    const userMessage = getLatestUserMessage(messages)

    // 5. Ask controller for a decision
    let decision = processRequest(userMessage, caseContextInput, user.id)

    // 6. Enrich case context if the controller says we need it
    let caseContext = null
    if (decision.enrichContext && caseContextInput) {
      caseContext = await enrichCaseContext(supabase, caseContextInput)
    }

    // 7. Finalize the decision (builds system prompt with context)
    decision = finalizeDecision(decision, caseContext)

    // 8. Resolve tools based on intent classification
    const activeTools = getToolsForIntent(decision.classification.toolsAllowed)

    // 9. Stream response using the controller's configuration
    const result = streamText({
      model: decision.serviceConfig.model,
      system: decision.serviceConfig.systemPrompt,
      messages: await convertToModelMessages(messages),
      stopWhen: stepCountIs(5),
      tools: activeTools,
      toolChoice: 'auto',
      temperature: decision.serviceConfig.temperature,
      maxTokens: decision.serviceConfig.maxTokens,
    })

    return result.toUIMessageStreamResponse({
      onFinish: async (options) => {
        const durationMs = Date.now() - startTime

        // Create audit entry
        const audit = createAuditEntry(
          decision,
          user.id,
          messages.length,
          options.usage?.totalTokens ?? 0,
          durationMs,
          [], // TODO: extract tool names from response
        )

        // Log to activity_log for backward compatibility
        try {
          await supabase.from('activity_log').insert({
            user_id: user.id,
            action_type: 'lexia_query',
            entity_type: caseContextInput ? 'case' : 'general',
            entity_id: caseContextInput?.caseId || 'general',
            description: `Lexia [${audit.intent}] via ${audit.model} (${durationMs}ms)`,
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
