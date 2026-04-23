/**
 * GET    /api/lexia/documents/[id]  - Load a document
 * PATCH  /api/lexia/documents/[id]  - Save current content (creates a new version)
 * DELETE /api/lexia/documents/[id]  - Soft fail-safe delete (only owner)
 */

import { createClient } from '@/lib/supabase/server'
import { checkCasePermission } from '@/lib/utils/access-control'
import {
  getDocument,
  updateDocumentContent,
  TiptapDocSchema,
} from '@/lib/lexia/workspace'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function authorizeDocument(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  id: string,
  permission: 'can_view' | 'can_edit',
) {
  const doc = await getDocument(supabase, id)
  if (!doc) return { ok: false as const, status: 404, error: 'Documento no encontrado' }
  if (doc.caseId) {
    const allowed = await checkCasePermission(supabase, userId, doc.caseId, permission)
    if (!allowed) return { ok: false as const, status: 403, error: 'Sin permisos sobre el caso' }
  }
  return { ok: true as const, document: doc }
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  if (!UUID_REGEX.test(id)) {
    return Response.json({ error: 'ID invalido' }, { status: 400 })
  }
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const authz = await authorizeDocument(supabase, user.id, id, 'can_view')
  if (!authz.ok) return Response.json({ error: authz.error }, { status: authz.status })
  return Response.json({ document: authz.document })
}

const PatchBodySchema = z.object({
  content: TiptapDocSchema.optional(),
  title: z.string().min(1).max(300).optional(),
  activeContext: z
    .object({
      documentIds: z.array(z.string().uuid()).default([]),
      personIds: z.array(z.string().uuid()).default([]),
    })
    .optional(),
  summary: z.string().max(500).optional(),
})

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  if (!UUID_REGEX.test(id)) {
    return Response.json({ error: 'ID invalido' }, { status: 400 })
  }
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const authz = await authorizeDocument(supabase, user.id, id, 'can_edit')
  if (!authz.ok) return Response.json({ error: authz.error }, { status: authz.status })

  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return Response.json({ error: 'Cuerpo JSON invalido' }, { status: 400 })
  }
  const parsed = PatchBodySchema.safeParse(body)
  if (!parsed.success) {
    return Response.json(
      { error: 'Datos invalidos', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { content, title, activeContext, summary } = parsed.data
  if (!content && !title && !activeContext) {
    return Response.json({ error: 'Nada que actualizar' }, { status: 400 })
  }

  try {
    // If only metadata (no content change), we still bump a version for title changes
    // but never for activeContext alone (that's UI state). Handled below.
    if (!content) {
      const updatePayload: Record<string, unknown> = {}
      if (title) updatePayload.title = title
      if (activeContext) updatePayload.active_context = activeContext
      const { data, error } = await supabase
        .from('lexia_documents')
        .update(updatePayload)
        .eq('id', id)
        .select('*')
        .maybeSingle()
      if (error || !data) {
        return Response.json(
          { error: 'No se pudo actualizar (bloqueado por RLS o no existe)' },
          { status: 404 }
        )
      }
      return Response.json({
        document: {
          ...authz.document,
          title: title ?? authz.document.title,
          activeContext: activeContext ?? authz.document.activeContext,
        },
      })
    }

    const updated = await updateDocumentContent(supabase, {
      id,
      userId: user.id,
      content,
      title,
      activeContext,
      source: 'manual',
      summary,
    })
    return Response.json({ document: updated })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error'
    console.error('[Lexia Workspace] update error:', err)
    // Approved-document guard surfaces a specific message; bubble it up with 409.
    if (/aprobado/i.test(message)) {
      return Response.json({ error: message }, { status: 409 })
    }
    return Response.json({ error: 'Error actualizando el documento' }, { status: 500 })
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  if (!UUID_REGEX.test(id)) {
    return Response.json({ error: 'ID invalido' }, { status: 400 })
  }
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('lexia_documents')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)
    .select('id')
    .maybeSingle()
  if (error) return Response.json({ error: 'Error eliminando documento' }, { status: 500 })
  if (!data) return Response.json({ error: 'No encontrado' }, { status: 404 })
  return Response.json({ success: true })
}
