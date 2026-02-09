import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { CreatePersonForm } from '@/components/people/create-person-form'
import { Skeleton } from '@/components/ui/skeleton'

interface CreatePersonPageProps {
  searchParams: Promise<{ company_id?: string }>
}

export const metadata = {
  title: 'Nueva Persona',
  description: 'Crear una nueva persona',
}

/**
 * Validates user access - Only admin and lawyers can create people
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

function CreatePersonSkeleton() {
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

export default async function CreatePersonPage({ searchParams }: CreatePersonPageProps) {
  await validateAccess()
  const params = await searchParams
  const companyId = params?.company_id

  return (
    <Suspense fallback={<CreatePersonSkeleton />}>
      <CreatePersonForm preselectedCompanyId={companyId} />
    </Suspense>
  )
}
