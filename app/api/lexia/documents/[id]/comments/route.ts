/**
 * GET  /api/lexia/documents/[id]/comments — list threads
 * POST /api/lexia/documents/[id]/comments — create comment / reply
 */

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { listComments, createComment } from '@/lib/lexia/workspace'

export const dynamic = 'force-dynamic'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const CreateBody = z.object({
  content: z.string().min(1).max(5000),
  parentId: z.string().uuid().nullable().optional(),
  selection: z
    .object({
      from: z.number().int().nonnegative(),
      to: z.number().int().nonnegative(),
      text: z.string().max(1000).optional(),
    })
    .nullable()
    .optional(),
})

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  if (!UUID_REGEX.test(id)) return Response.json({ error: 'ID invalido' }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const threads = await listComments(supabase, id)
    return Response.json({ threads })
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'Error' },
      { status: 500 }
    )
  }
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  if (!UUID_REGEX.test(id)) return Response.json({ error: 'ID invalido' }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const parsed = CreateBody.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: 'Parametros invalidos', details: parsed.error.flatten() }, { status: 400 })
  }

  // Snapshot current version to track drift later.
  const { data: doc } = await supabase
    .from('lexia_documents')
    .select('version')
    .eq('id', id)
    .maybeSingle()
  const version = (doc as { version?: number } | null)?.version ?? null

  try {
    const comment = await createComment(supabase, {
      documentId: id,
      authorId: user.id,
      parentId: parsed.data.parentId ?? null,
      selection: parsed.data.selection ?? null,
      content: parsed.data.content,
      versionAtCreation: version,
    })
    return Response.json({ comment })
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'Error' },
      { status: 400 }
    )
  }
}
