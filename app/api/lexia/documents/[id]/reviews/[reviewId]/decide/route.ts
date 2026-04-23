/**
 * POST /api/lexia/documents/[id]/reviews/[reviewId]/decide
 * Body: { decision: 'approved' | 'rejected', reason?: string }
 */

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { decideReview } from '@/lib/lexia/workspace'

export const dynamic = 'force-dynamic'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const Body = z.object({
  decision: z.enum(['approved', 'rejected']),
  reason: z.string().max(2000).optional(),
})

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string; reviewId: string }> }
) {
  const { id, reviewId } = await ctx.params
  if (!UUID_REGEX.test(id) || !UUID_REGEX.test(reviewId)) {
    return Response.json({ error: 'ID invalido' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const parsed = Body.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: 'Parametros invalidos' }, { status: 400 })
  }

  try {
    const result = await decideReview(supabase, {
      reviewId,
      reviewerId: user.id,
      decision: parsed.data.decision,
      reason: parsed.data.reason ?? null,
    })
    return Response.json(result)
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Error' }, { status: 400 })
  }
}
