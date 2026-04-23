import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { checkCasePermission } from '@/lib/utils/access-control'
import { getDocument } from '@/lib/lexia/workspace/persistence'
import { WorkspaceClient } from '@/components/lexia/workspace/workspace-client'

interface PageProps {
  params: Promise<{ id: string }>
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function WorkspaceDocumentPage({ params }: PageProps) {
  const { id } = await params
  if (!UUID_REGEX.test(id)) notFound()

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const doc = await getDocument(supabase, id)
  if (!doc) notFound()

  // Case-level permission (if the doc is scoped).
  if (doc.caseId) {
    const canView = await checkCasePermission(supabase, user.id, doc.caseId, 'can_view')
    if (!canView) notFound()
  }

  // Load case metadata
  let caseInfo: { id: string; caseNumber: string; title: string } | null = null
  let caseDocuments: Array<{ id: string; name: string }> = []
  const casePersons: Array<{ id: string; name: string; type: string }> = []
  if (doc.caseId) {
    const { data: caseRow } = await supabase
      .from('cases')
      .select('id, case_number, title')
      .eq('id', doc.caseId)
      .maybeSingle()
    if (caseRow) {
      caseInfo = {
        id: (caseRow as { id: string }).id,
        caseNumber: (caseRow as { case_number: string }).case_number,
        title: (caseRow as { title: string }).title,
      }
    }

    const { data: docs } = await supabase
      .from('documents')
      .select('id, name')
      .eq('case_id', doc.caseId)
      .order('created_at', { ascending: false })
      .limit(50)
    caseDocuments = (docs ?? []).map((d) => ({
      id: (d as { id: string }).id,
      name: (d as { name?: string }).name ?? '(sin nombre)',
    }))

    const { data: parts } = await supabase
      .from('case_participants')
      .select('person:people(id, first_name, last_name, name, person_type)')
      .eq('case_id', doc.caseId)
      .limit(30)
    if (Array.isArray(parts)) {
      for (const row of parts as Array<{
        person?: {
          id?: string
          first_name?: string | null
          last_name?: string | null
          name?: string | null
          person_type?: string | null
        }
      }>) {
        const p = row.person
        if (!p?.id) continue
        const nm =
          p.name ?? [p.first_name ?? '', p.last_name ?? ''].filter(Boolean).join(' ').trim() ?? '(persona)'
        casePersons.push({
          id: p.id,
          name: nm || '(persona)',
          type: p.person_type ?? 'persona',
        })
      }
    }
  }

  return (
    <WorkspaceClient
      document={doc}
      caseInfo={caseInfo}
      caseDocuments={caseDocuments}
      casePersons={casePersons}
      currentUserId={user.id}
    />
  )
}
