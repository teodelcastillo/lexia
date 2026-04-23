/**
 * GET /api/lexia/documents/[id]/grounding
 *
 * Returns an aggregated integrity report for the document: counts of
 * verified/warning/invalid citations across accepted edits, plus the list
 * of ungrounded citations so the UI can let the lawyer act on them.
 */

import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

interface EditRow {
  id: string
  status: string
  grounding_status: 'unknown' | 'grounded' | 'partial' | 'ungrounded'
  citations: Array<{ label: string; kind?: string }>
  citation_verdicts: Array<{
    index: number
    status: 'verified' | 'warning' | 'invalid'
    explanation: string
    sourceType?: string
    source?: string
    suggestedLabel?: string
  }>
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
  if (authError || !user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('lexia_document_edits')
    .select('id,status,grounding_status,citations,citation_verdicts')
    .eq('document_id', id)
    .in('status', ['accepted', 'edited'])
    .order('created_at', { ascending: false })

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  const rows = (data ?? []) as EditRow[]
  let verified = 0
  let warning = 0
  let invalid = 0
  const issues: Array<{
    editId: string
    index: number
    label: string
    status: 'warning' | 'invalid'
    explanation: string
    suggestedLabel?: string
    source?: string
    sourceType?: string
  }> = []

  for (const row of rows) {
    const verdicts = Array.isArray(row.citation_verdicts) ? row.citation_verdicts : []
    for (const v of verdicts) {
      if (v.status === 'verified') verified++
      else if (v.status === 'warning') warning++
      else if (v.status === 'invalid') invalid++
      if (v.status !== 'verified') {
        const cite = row.citations?.[v.index]
        issues.push({
          editId: row.id,
          index: v.index,
          label: cite?.label ?? `Cita #${v.index}`,
          status: v.status,
          explanation: v.explanation,
          suggestedLabel: v.suggestedLabel,
          source: v.source,
          sourceType: v.sourceType,
        })
      }
    }
  }

  const total = verified + warning + invalid
  const status: 'grounded' | 'partial' | 'ungrounded' | 'empty' =
    total === 0 ? 'empty' : invalid > 0 ? 'ungrounded' : warning > 0 ? 'partial' : 'grounded'

  return Response.json({
    status,
    counts: { verified, warning, invalid, total },
    issues,
  })
}
