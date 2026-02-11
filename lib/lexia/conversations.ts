/**
 * Lexia Conversations - Persistence layer for chat history
 *
 * Handles create, load, save, and update of lexia_conversations and lexia_messages.
 * Messages are stored as full UIMessage JSON for reconstructing with validateUIMessages.
 */

import type { UIMessage } from 'ai'

type SupabaseClient = Awaited<ReturnType<typeof import('@/lib/supabase/server').createClient>>

export interface LexiaConversation {
  id: string
  user_id: string
  case_id: string | null
  organization_id: string | null
  title: string
  summary: string | null
  intent: string | null
  model_used: string | null
  message_count: number
  is_archived: boolean
  is_pinned: boolean
  last_message_at: string | null
  created_at: string
  updated_at: string
}

export interface LexiaConversationWithMessages extends LexiaConversation {
  messages: UIMessage[]
}

export interface ConversationListItem {
  id: string
  title: string
  case_id: string | null
  case_number?: string
  case_title?: string
  last_message_at: string | null
  message_count: number
  is_pinned: boolean
}

/**
 * Creates a new conversation for the user.
 * organization_id is auto-assigned via trigger.
 */
export async function createConversation(
  supabase: SupabaseClient,
  userId: string,
  caseId?: string | null
): Promise<{ id: string }> {
  const { data, error } = await supabase
    .from('lexia_conversations')
    .insert({
      user_id: userId,
      case_id: caseId ?? null,
      title: 'Nueva conversación',
    })
    .select('id')
    .single()

  if (error) {
    console.error('[Lexia] createConversation error:', error)
    throw new Error('Failed to create conversation')
  }

  return { id: data.id }
}

/**
 * Loads a conversation with its messages.
 * Verifies user ownership via RLS.
 */
export async function loadConversation(
  supabase: SupabaseClient,
  convId: string,
  userId: string
): Promise<LexiaConversationWithMessages | null> {
  const { data: conv, error: convError } = await supabase
    .from('lexia_conversations')
    .select('*')
    .eq('id', convId)
    .eq('user_id', userId)
    .single()

  if (convError || !conv) {
    return null
  }

  const messages = await loadMessagesForConversation(supabase, convId, userId)

  return {
    ...conv,
    messages,
  }
}

/**
 * Loads conversations for the user, optionally filtered by case.
 */
export async function loadConversations(
  supabase: SupabaseClient,
  userId: string,
  options?: { caseId?: string | null; limit?: number }
): Promise<ConversationListItem[]> {
  const limit = options?.limit ?? 50

  let query = supabase
    .from('lexia_conversations')
    .select(`
      id,
      title,
      case_id,
      last_message_at,
      message_count,
      is_pinned,
      cases (
        case_number,
        title
      )
    `)
    .eq('user_id', userId)
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(limit)

  if (options?.caseId) {
    query = query.eq('case_id', options.caseId)
  }

  const { data, error } = await query

  if (error) {
    console.error('[Lexia] loadConversations error:', error)
    return []
  }

  return (data ?? []).map((row) => {
    const caseData = row.cases as { case_number?: string; title?: string } | null
    return {
      id: row.id,
      title: row.title,
      case_id: row.case_id,
      case_number: caseData?.case_number,
      case_title: caseData?.title,
      last_message_at: row.last_message_at,
      message_count: row.message_count ?? 0,
      is_pinned: row.is_pinned ?? false,
    }
  })
}

/**
 * Loads messages for a conversation and converts to UIMessage[].
 */
export async function loadMessagesForConversation(
  supabase: SupabaseClient,
  convId: string,
  userId: string
): Promise<UIMessage[]> {
  // Verify user has access to this conversation
  const { data: conv, error: convError } = await supabase
    .from('lexia_conversations')
    .select('id')
    .eq('id', convId)
    .eq('user_id', userId)
    .single()

  if (convError || !conv) {
    return []
  }

  const { data: rows, error } = await supabase
    .from('lexia_messages')
    .select('content')
    .eq('conversation_id', convId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('[Lexia] loadMessagesForConversation error:', error)
    return []
  }

  return (rows ?? []).map((row) => row.content as UIMessage)
}

/**
 * Saves all messages for a conversation.
 * Replaces existing messages with the new set (delete + insert for simplicity).
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function saveMessages(
  supabase: SupabaseClient,
  convId: string,
  messages: UIMessage[],
  metadata?: { tokensUsed?: number }
): Promise<void> {
  if (messages.length === 0) return
  if (!UUID_REGEX.test(convId)) {
    throw new Error(`Invalid conversation_id: expected UUID, got "${convId}"`)
  }

  // Delete existing messages and insert new ones
  const { error: deleteError } = await supabase
    .from('lexia_messages')
    .delete()
    .eq('conversation_id', convId)

  if (deleteError) {
    console.error('[Lexia] saveMessages delete error:', deleteError)
    throw new Error(`Failed to delete messages: ${deleteError.message}`)
  }

  const ALLOWED_ROLES = ['user', 'assistant', 'system', 'tool'] as const
  const sanitizeRole = (r: unknown): (typeof ALLOWED_ROLES)[number] => {
    const s = String(r ?? '').toLowerCase()
    if (s === 'human') return 'user'
    return ALLOWED_ROLES.includes(s as (typeof ALLOWED_ROLES)[number])
      ? (s as (typeof ALLOWED_ROLES)[number])
      : 'user'
  }

  const rows = messages.map((msg) => {
    // Ensure content is JSON-serializable (strip undefined, circular refs)
    let content: Record<string, unknown>
    try {
      content = JSON.parse(JSON.stringify(msg)) as Record<string, unknown>
    } catch {
      content = { id: msg.id, role: msg.role, parts: [], metadata: {} }
    }
    return {
      id: String(msg.id ?? `msg-${Math.random().toString(36).slice(2, 18)}`),
      conversation_id: convId,
      role: sanitizeRole(msg.role),
      content,
      metadata: typeof metadata === 'object' && metadata !== null ? { ...metadata } : {},
      tokens_used: Math.floor(Number(metadata?.tokensUsed) || 0),
    }
  })

  const { error: insertError } = await supabase
    .from('lexia_messages')
    .insert(rows)

  if (insertError) {
    // Fallback: insert one by one to isolate the failing row
    for (let i = 0; i < rows.length; i++) {
      const { error: singleError } = await supabase.from('lexia_messages').insert(rows[i])
      if (singleError) {
        console.error('[Lexia] saveMessages insert error (row index', i, '):', singleError)
        console.error('[Lexia] Failing row sample:', JSON.stringify(rows[i], null, 2).slice(0, 500))
        throw new Error(`Failed to insert messages: ${singleError.message} (row ${i})`)
      }
    }
    return
  }
}

/**
 * Updates conversation metadata after a response.
 */
export async function updateConversationMeta(
  supabase: SupabaseClient,
  convId: string,
  updates: {
    title?: string
    message_count?: number
    last_message_at?: string
    intent?: string
    model_used?: string
  }
): Promise<void> {
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (updates.title !== undefined) payload.title = updates.title
  if (updates.message_count !== undefined) payload.message_count = updates.message_count
  if (updates.last_message_at !== undefined) payload.last_message_at = updates.last_message_at
  if (updates.intent !== undefined) payload.intent = updates.intent
  if (updates.model_used !== undefined) payload.model_used = updates.model_used

  const { error } = await supabase
    .from('lexia_conversations')
    .update(payload)
    .eq('id', convId)

  if (error) {
    console.error('[Lexia] updateConversationMeta error:', error)
  }
}

/**
 * Updates conversation title, is_pinned, is_archived.
 */
export async function updateConversation(
  supabase: SupabaseClient,
  convId: string,
  userId: string,
  updates: {
    title?: string
    is_pinned?: boolean
    is_archived?: boolean
  }
): Promise<boolean> {
  const { error } = await supabase
    .from('lexia_conversations')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', convId)
    .eq('user_id', userId)

  if (error) {
    console.error('[Lexia] updateConversation error:', error)
    return false
  }
  return true
}
