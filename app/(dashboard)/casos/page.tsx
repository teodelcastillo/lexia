/**
 * Cases List Page
 * 
 * Main view for browsing and managing legal cases.
 * Supports filtering, searching, and pagination.
 */
import { Suspense } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Plus, AlertCircle } from 'lucide-react'
import { CasesTable } from '@/components/cases/cases-table'
import { CasesFilters } from '@/components/cases/cases-filters'
import { Skeleton } from '@/components/ui/skeleton'

export const metadata = {
  title: 'Casos',
  description: 'Gestión de casos legales',
}

interface CasesPageProps {
  searchParams: Promise<{
    status?: string
    priority?: string
    search?: string
    page?: string
    error?: string
  }>
}

/**
 * Validates user access and returns profile
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

  if (profile?.system_role === 'client') {
    redirect('/portal')
  }

  return { user, profile }
}

export default async function CasesPage({ searchParams }: CasesPageProps) {
  const { profile } = await validateAccess()
  const params = await searchParams
  
  // Check if user can create cases
  const canCreateCases = ['admin_general', 'case_leader'].includes(profile?.system_role || '')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Casos
          </h1>
          <p className="text-sm text-muted-foreground">
            Gestione los casos legales de su estudio
          </p>
        </div>
        
        {canCreateCases && (
          <Button asChild>
            <Link href="/casos/nuevo">
              <Plus className="mr-2 h-4 w-4" />
              Nuevo Caso
            </Link>
          </Button>
        )}
      </div>

      {params.error === 'case_not_found' && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            No se pudo cargar el caso. Puede que no exista o no tenga permiso para verlo.
          </AlertDescription>
        </Alert>
      )}

      {/* Filters */}
      <CasesFilters 
        currentStatus={params.status}
        currentPriority={params.priority}
        currentSearch={params.search}
      />

      {/* Cases Table */}
      <Suspense fallback={<TableSkeleton />}>
        <CasesTable 
          status={params.status}
          priority={params.priority}
          search={params.search}
          page={params.page ? parseInt(params.page) : 1}
        />
      </Suspense>
    </div>
  )
}

/**
 * Loading skeleton for the table
 */
function TableSkeleton() {
  return (
    <div className="rounded-lg border border-border">
      <div className="border-b border-border p-4">
        <div className="flex gap-4">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-4 w-24" />
          ))}
        </div>
      </div>
      <div className="divide-y divide-border">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 p-4">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-6 w-16" />
            <Skeleton className="h-4 w-24" />
          </div>
        ))}
      </div>
    </div>
  )
}
