/**
 * GET /api/lexia/documents/[id]/reviewers
 *
 * Returns the candidate reviewers for a document: the team assigned to the
 * document's case when there is one, otherwise the organization members
 * (excluding the current user).
 */

import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

interface ProfileRow {
  id: string
  first_name: string
  last_name: string
  email: string
  role: string
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  if (!UUID_REGEX.test(id)) return Response.json({ error: 'ID invalido' }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: doc } = await supabase
    .from('lexia_documents')
    .select('case_id, organization_id')
    .eq('id', id)
    .maybeSingle()
  if (!doc) return Response.json({ error: 'Documento no encontrado' }, { status: 404 })
  const d = doc as { case_id: string | null; organization_id: string | null }

  let reviewers: ProfileRow[] = []

  if (d.case_id) {
    const { data } = await supabase
      .from('case_assignments')
      .select('user:profiles(id,first_name,last_name,email,role)')
      .eq('case_id', d.case_id)
    for (const row of data ?? []) {
      const raw = (row as { user?: ProfileRow | ProfileRow[] | null }).user
      const p = raw == null ? null : Array.isArray(raw) ? raw[0] : raw
      if (p && p.id !== user.id) reviewers.push(p)
    }
  }

  if (reviewers.length === 0 && d.organization_id) {
    const { data } = await supabase
      .from('profiles')
      .select('id,first_name,last_name,email,role')
      .eq('organization_id', d.organization_id)
      .eq('is_active', true)
      .neq('id', user.id)
      .in('role', ['admin_general', 'case_leader', 'lawyer_executive'])
      .limit(50)
    reviewers = (data ?? []) as ProfileRow[]
  }

  return Response.json({
    reviewers: reviewers.map((r) => ({
      id: r.id,
      name: `${r.first_name} ${r.last_name}`.trim(),
      email: r.email,
      role: r.role,
    })),
  })
}
