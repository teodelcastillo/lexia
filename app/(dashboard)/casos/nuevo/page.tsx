/**
 * Create New Case Page
 * 
 * Page for creating a new legal case
 */
import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CreateCaseForm } from '@/components/cases/create-case-form'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { getCurrentUserOrganizationId } from '@/lib/utils/organization'

export const metadata = {
  title: 'Crear Caso | Casos',
  description: 'Crear un nuevo caso legal',
}

/**
 * Validates user access
 */
async function validateAccess() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('system_role')
    .eq('id', user.id)
    .single()

  // Only admins and lawyers can create cases
  if (!['admin_general', 'case_leader', 'admin_general'].includes(profile?.system_role || '')) {
    redirect('/dashboard')
  }

  return { user, profile }
}

export default async function CreateCasePage() {
  const { user } = await validateAccess()
  const supabase = await createClient()
  const organizationId = await getCurrentUserOrganizationId()

  // Fetch companies filtered by organization
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
        <CreateCaseForm companies={companies || []} organizationId={organizationId} />
      </Suspense>
    </div>
  )
}

/**
 * Loading skeleton for the form
 */
function FormSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
      </div>

      {/* Form card skeleton */}
      <Card>
        <div className="border-b border-border p-6">
          <Skeleton className="h-6 w-48 mb-2" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="p-6 space-y-6">
          {/* Row 1 */}
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

          {/* Row 2 */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-10 w-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-10 w-full" />
            </div>
          </div>

          {/* Row 3 */}
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-10 w-full" />
          </div>

          {/* Row 4 */}
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-24 w-full" />
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-4">
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-10 w-24" />
          </div>
        </div>
      </Card>
    </div>
  )
}
