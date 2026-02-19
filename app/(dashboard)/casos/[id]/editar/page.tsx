/**
 * Edit Case Page
 *
 * Page for editing an existing legal case.
 * Reuses the same access validation as the case detail page.
 */
import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { EditCaseForm } from '@/components/cases/edit-case-form'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { getCurrentUserOrganizationId } from '@/lib/utils/organization'
import type { CaseRole } from '@/lib/types'

export const metadata = {
  title: 'Editar Caso | Casos',
  description: 'Editar datos de un caso legal',
}

interface EditCasePageProps {
  params: Promise<{ id: string }>
}

async function validateAccess(caseId: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('system_role')
    .eq('id', user.id)
    .single()

  if (profile?.system_role === 'admin_general') {
    return { user, profile, canEdit: true }
  }

  if (profile?.system_role === 'client') {
    redirect('/portal')
  }

  const { data: assignment } = await supabase
    .from('case_assignments')
    .select('case_role')
    .eq('case_id', caseId)
    .eq('user_id', user.id)
    .single()

  if (!assignment) {
    redirect('/casos')
  }

  const caseRole = assignment.case_role as CaseRole
  const canEdit = caseRole === 'leader'

  if (!canEdit) {
    redirect(`/casos/${caseId}`)
  }

  return { user, profile, canEdit }
}

async function getCaseForEdit(caseId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('cases')
    .select('id, case_number, title, description, case_type, status, company_id, court_number, jurisdiction, court_name, opposing_party, opposing_counsel, filing_date')
    .eq('id', caseId)
    .single()

  if (error || !data) {
    return null
  }

  return data
}

export default async function EditCasePage({ params }: EditCasePageProps) {
  const { id } = await params

  await validateAccess(id)

  const [caseData, organizationId] = await Promise.all([
    getCaseForEdit(id),
    getCurrentUserOrganizationId(),
  ])

  if (!caseData) {
    redirect('/casos?error=case_not_found')
  }

  const supabase = await createClient()
  const companiesQuery = supabase
    .from('companies')
    .select('id, company_name, name')
    .order('company_name')

  if (organizationId) {
    companiesQuery.eq('organization_id', organizationId)
  }

  const { data: companies } = await companiesQuery

  return (
    <div className="mx-auto max-w-3xl">
      <Suspense fallback={<FormSkeleton />}>
        <EditCaseForm
          caseId={id}
          initialCase={caseData}
          companies={companies || []}
          organizationId={organizationId}
        />
      </Suspense>
    </div>
  )
}

function FormSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Skeleton className="h-10 w-10" />
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
      </div>
      <Card>
        <div className="border-b border-border p-6">
          <Skeleton className="h-6 w-48 mb-2" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="p-6 space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-10 w-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-10 w-full" />
            </div>
          </div>
          <div className="flex gap-3 pt-4">
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-10 w-24" />
          </div>
        </div>
      </Card>
    </div>
  )
}
