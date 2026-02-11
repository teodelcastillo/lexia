/**
 * Lexia Conversation Messages - POST to persist messages
 *
 * Called by the client when the stream completes (useChat onFinish).
 * Ensures messages are stored even when server-side onFinish fails to run.
 */

import { createClient } from '@/lib/supabase/server'
import { saveMessages, updateConversationMeta } from '@/lib/lexia'
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
