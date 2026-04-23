/**
 * PATCH  /api/lexia/documents/[id]/comments/[commentId]
 *    Body: { content?: string; resolved?: boolean }
 * DELETE /api/lexia/documents/[id]/comments/[commentId]
 */

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { updateComment, deleteComment } from '@/lib/lexia/workspace'

export const dynamic = 'force-dynamic'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const PatchBody = z.object({
  content: z.string().min(1).max(5000).optional(),
  resolved: z.boolean().optional(),
})

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string; commentId: string }> }
) {
  const { id, commentId } = await ctx.params
  if (!UUID_REGEX.test(id) || !UUID_REGEX.test(commentId)) {
    return Response.json({ error: 'ID invalido' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const parsed = PatchBody.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: 'Parametros invalidos' }, { status: 400 })
  }

  try {
    const comment = await updateComment(supabase, {
      commentId,
      userId: user.id,
      content: parsed.data.content,
      resolved: parsed.data.resolved,
    })
    return Response.json({ comment })
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Error' }, { status: 400 })
  }
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string; commentId: string }> }
) {
  const { id, commentId } = await ctx.params
  if (!UUID_REGEX.test(id) || !UUID_REGEX.test(commentId)) {
    return Response.json({ error: 'ID invalido' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    await deleteComment(supabase, commentId)
    return Response.json({ ok: true })
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Error' }, { status: 400 })
  }
}
