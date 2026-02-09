import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { CreateCompanyForm } from '@/components/companies/create-company-form'
import { Skeleton } from '@/components/ui/skeleton'

export const metadata = {
  title: 'Nueva Empresa',
  description: 'Crear una nueva empresa',
}

/**
 * Validates user access - Only admin and lawyers can create companies
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

  if (!profile || !['admin_general', 'case_leader'].includes(profile.system_role)) {
    redirect('/dashboard')
  }
}

function CreateCompanySkeleton() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-4 w-96" />
      </div>
      <div className="space-y-4">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    </div>
  )
}

export default async function CreateCompanyPage() {
  await validateAccess()

  return (
    <Suspense fallback={<CreateCompanySkeleton />}>
      <CreateCompanyForm />
    </Suspense>
  )
}
