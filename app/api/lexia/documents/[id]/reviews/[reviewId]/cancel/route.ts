/**
 * POST /api/lexia/documents/[id]/reviews/[reviewId]/cancel
 *
 * Cancels a pending review. Only the requester or an admin can cancel.
 */

import { createClient } from '@/lib/supabase/server'
import { cancelReview } from '@/lib/lexia/workspace'

export const dynamic = 'force-dynamic'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string; reviewId: string }> }
) {
  const { id, reviewId } = await ctx.params
  if (!UUID_REGEX.test(id) || !UUID_REGEX.test(reviewId)) {
    return Response.json({ error: 'ID invalido' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const review = await cancelReview(supabase, { reviewId, userId: user.id })
    return Response.json({ review })
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Error' }, { status: 400 })
  }
}
