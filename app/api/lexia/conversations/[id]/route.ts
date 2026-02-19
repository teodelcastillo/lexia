/**
 * Lexia Conversation by ID - GET, PATCH
 */

import { safeValidateUIMessages } from 'ai'
import { createClient } from '@/lib/supabase/server'
import { lexiaTools } from '@/lib/ai'
import {
  loadConversation,
  updateConversation,
} from '@/lib/lexia'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    }

    const conversation = await loadConversation(supabase, id, user.id)

    if (!conversation) {
      return new Response(JSON.stringify({ error: 'Conversation not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Normalize messages for UI (parts, role) when loading from DB
    const messages = conversation.messages ?? []
    const validated = await safeValidateUIMessages({
      messages,
      tools: lexiaTools as Record<string, import('ai').Tool<unknown, unknown>>,
    })
    const normalizedMessages = validated.success ? validated.data : messages

    return Response.json({
      ...conversation,
      messages: normalizedMessages,
    })
  } catch (error) {
    console.error('[Lexia] GET conversation error:', error)
    return new Response(
      JSON.stringify({
        error: 'Error loading conversation',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const updates: { title?: string; is_pinned?: boolean; is_archived?: boolean } = {}
    if (typeof body.title === 'string') updates.title = body.title
    if (typeof body.is_pinned === 'boolean') updates.is_pinned = body.is_pinned
    if (typeof body.is_archived === 'boolean') updates.is_archived = body.is_archived

    if (Object.keys(updates).length === 0) {
      return Response.json({ ok: true })
    }

    const ok = await updateConversation(supabase, id, user.id, updates)

    if (!ok) {
      return new Response(JSON.stringify({ error: 'Failed to update' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    return Response.json({ ok: true })
  } catch (error) {
    console.error('[Lexia] PATCH conversation error:', error)
    return new Response(
      JSON.stringify({
        error: 'Error updating conversation',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
