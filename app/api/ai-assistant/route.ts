/**
 * AI Legal Assistant API Route (Legacy)
 * 
 * This is the original AI assistant endpoint, now refactored to
 * use the shared tool definitions and prompt system from lib/ai.
 * 
 * It serves as a simpler alternative to the full Lexia route,
 * without intent classification or multi-provider routing.
 * It always uses the Gateway with a single general prompt.
 * 
 * This route can be deprecated in favor of /api/lexia once
 * all consumers are migrated.
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
import { lexiaTools } from '@/lib/ai'
import { buildSystemPrompt } from '@/lib/ai/prompts'

export const maxDuration = 60

// Export message type for client
export type AIAssistantMessage = UIMessage<
  never,
  UIDataTypes,
  InferUITools<typeof lexiaTools>
>

/**
 * POST handler for AI assistant chat
 */
export async function POST(req: Request) {
  const supabase = await createClient()

  // Verify user is authenticated
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return new Response('Unauthorized', { status: 401 })
  }

  const body = await req.json()

  // Validate incoming messages using shared tools
  const messages = await validateUIMessages<AIAssistantMessage>({
    messages: body.messages,
    tools: lexiaTools,
  })

  // Use the general chat prompt from the centralized prompt system
  const systemPrompt = buildSystemPrompt('general_chat', null)

  // Stream the response (always uses gateway, no controller routing)
  const result = streamText({
    model: 'openai/gpt-4o',
    system: systemPrompt,
    messages: await convertToModelMessages(messages),
    stopWhen: stepCountIs(5),
    tools: lexiaTools,
    toolChoice: 'auto',
  })

  return result.toUIMessageStreamResponse({
    onFinish: async () => {
      try {
        await supabase.from('activity_log').insert({
          user_id: user.id,
          action_type: 'ai_assistant_query',
          entity_type: 'ai_assistant',
          entity_id: 'general',
          description: `AI Assistant query with ${messages.length} messages`,
          case_id: null,
        })
      } catch {
        // Silently fail logging
      }
    },
  })
}
