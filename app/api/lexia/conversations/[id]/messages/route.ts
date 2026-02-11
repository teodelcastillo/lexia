/**
 * Lexia Conversation Messages - POST to persist messages
 *
 * Called by the client when the stream completes (useChat onFinish).
 * Ensures messages are stored even when server-side onFinish fails to run.
 * Generates a relevant title from the first user message when still default.
 */

import { createClient } from '@/lib/supabase/server'
import {
  saveMessages,
  updateConversationMeta,
  updateConversation,
  generateConversationTitle,
  getFirstUserMessageText,
  DEFAULT_TITLE,
} from '@/lib/lexia'
import { validateUIMessages } from 'ai'
import { lexiaTools } from '@/lib/ai'
import type { UIMessage } from 'ai'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: conversationId } = await params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const messages = Array.isArray(body.messages) ? body.messages : []

    if (messages.length === 0) {
      return Response.json({ ok: true })
    }

    const validatedMessages = await validateUIMessages({
      messages: messages as UIMessage[],
      tools: lexiaTools,
    })

    await saveMessages(supabase, conversationId, validatedMessages)
    await updateConversationMeta(supabase, conversationId, {
      message_count: validatedMessages.length,
      last_message_at: new Date().toISOString(),
    })

    // Generate title from first user message if still default
    const { data: conv } = await supabase
      .from('lexia_conversations')
      .select('title')
      .eq('id', conversationId)
      .eq('user_id', user.id)
      .single()

    if (conv?.title === DEFAULT_TITLE) {
      const firstUserText = getFirstUserMessageText(validatedMessages)
      if (firstUserText) {
        const title = await generateConversationTitle(firstUserText)
        if (title) {
          await updateConversation(supabase, conversationId, user.id, { title })
        }
      }
    }

    return Response.json({ ok: true })
  } catch (error) {
    console.error('[Lexia] POST messages error:', error)
    return new Response(
      JSON.stringify({
        error: 'Error saving messages',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
