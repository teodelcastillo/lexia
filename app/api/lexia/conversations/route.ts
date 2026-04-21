/**
 * Lexia Conversations API - GET list, POST create
 */

import { createClient } from '@/lib/supabase/server'
import {
  createConversation,
  loadConversations,
} from '@/lib/lexia'
import { checkCasePermission } from '@/lib/utils/access-control'

function parseLimit(raw: string | null, fallback = 50, max = 100) {
  const parsed = parseInt(raw ?? String(fallback), 10)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(Math.max(parsed, 1), max)
}

export async function GET(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const caseId = searchParams.get('caseId') || undefined
    const limit = parseLimit(searchParams.get('limit'))

    const conversations = await loadConversations(supabase, user.id, {
      caseId: caseId || null,
      limit,
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

    if (caseId) {
      const canView = await checkCasePermission(supabase, user.id, caseId, 'can_view')
      if (!canView) {
        return new Response(
          JSON.stringify({ error: 'Sin acceso al caso' }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        )
      }
    }

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
