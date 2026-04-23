/**
 * GET  /api/lexia/documents/[id]/reviews — current review state + history
 * POST /api/lexia/documents/[id]/reviews — request review (body: { reviewerIds: string[] })
 */

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getDocumentReviewState, requestReview } from '@/lib/lexia/workspace'

export const dynamic = 'force-dynamic'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const RequestBody = z.object({
  reviewerIds: z.array(z.string().uuid()).min(1).max(10),
})

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  if (!UUID_REGEX.test(id)) return Response.json({ error: 'ID invalido' }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const state = await getDocumentReviewState(supabase, id)
    if (!state) return Response.json({ error: 'Documento no encontrado' }, { status: 404 })
    return Response.json(state)
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Error' }, { status: 500 })
  }
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  if (!UUID_REGEX.test(id)) return Response.json({ error: 'ID invalido' }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const parsed = RequestBody.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: 'Parametros invalidos' }, { status: 400 })
  }

  // Snapshot version
  const { data: doc } = await supabase
    .from('lexia_documents')
    .select('version, user_id')
    .eq('id', id)
    .maybeSingle()
  if (!doc) return Response.json({ error: 'Documento no encontrado' }, { status: 404 })
  const d = doc as { version: number; user_id: string }

  try {
    const reviews = await requestReview(supabase, {
      documentId: id,
      requestedBy: user.id,
      reviewerIds: parsed.data.reviewerIds,
      currentVersion: d.version,
    })
    return Response.json({ reviews })
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Error' }, { status: 400 })
  }
}
