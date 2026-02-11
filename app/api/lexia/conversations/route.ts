/**
 * Lexia Conversations API - GET list, POST create
 */

import { createClient } from '@/lib/supabase/server'
import {
  createConversation,
  loadConversations,
} from '@/lib/lexia'

export async function GET(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const caseId = searchParams.get('caseId') || undefined
    const limit = parseInt(searchParams.get('limit') ?? '50', 10)

    const conversations = await loadConversations(supabase, user.id, {
      caseId: caseId || null,
      limit: Math.min(limit, 100),
    })

    return Response.json(conversations)
  } catch (error) {
    console.error('[Lexia] GET conversations error:', error)
    return new Response(
      JSON.stringify({
        error: 'Error loading conversations',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const caseId = body.caseId ?? null

    const { id } = await createConversation(supabase, user.id, caseId)

    return Response.json({ id })
  } catch (error) {
    console.error('[Lexia] POST conversations error:', error)
    return new Response(
      JSON.stringify({
        error: 'Error creating conversation',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
