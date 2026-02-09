/**
 * Dashboard Home Page
 * 
 * Role-based dashboard showing actionable information:
 * - Admin: Global overview of cases, deadlines, and team activity
 * - Case Leader: Overview of assigned cases, deadlines, and team task status
 * - Lawyer/Assistant: Personal task list, upcoming deadlines, assigned cases
 */
import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Skeleton } from '@/components/ui/skeleton'

// Role-specific dashboard components
import { AdminDashboard } from '@/components/dashboard/admin-dashboard'
import { LeaderDashboard } from '@/components/dashboard/leader-dashboard'
import { LawyerDashboard } from '@/components/dashboard/lawyer-dashboard'

import type { SystemRole, UserProfile } from '@/lib/types'

export const metadata = {
  title: 'Dashboard',
  description: 'Vista general del sistema de gestión legal',
}

/**
 * Fetches the current user's profile and validates access
 */
async function getCurrentUser(): Promise<{ user: { id: string; email: string }; profile: UserProfile }> {
  const supabase = await createClient()
  
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  
  if (authError || !user) {
    redirect('/auth/login')
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (profileError || !profile) {
    redirect('/auth/login')
  }

  // Redirect clients to portal
  if (profile.system_role === 'client') {
    redirect('/portal')
  }

  return { user, profile: profile as UserProfile }
}

/**
 * Checks if user is a case leader for any case
 */
async function isUserCaseLeader(userId: string): Promise<boolean> {
  const supabase = await createClient()
  
  const { count } = await supabase
    .from('case_assignments')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('case_role', 'leader')

  return (count || 0) > 0
}

export default async function DashboardPage() {
  const { profile } = await getCurrentUser()
  const systemRole = profile.system_role as SystemRole
  
  // Determine effective dashboard role
  // Admin always sees admin dashboard
  // Lawyers who are case leaders see leader dashboard
  // Others see lawyer/assistant dashboard
  let dashboardType: 'admin_general' | 'leader' | 'case_leader' = 'case_leader'
  
  if (systemRole === 'admin_general') {
    dashboardType = 'admin_general'
  } else if (systemRole === 'case_leader') {
    const isCaseLeader = await isUserCaseLeader(profile.id)
    dashboardType = isCaseLeader ? 'leader' : 'case_leader'
  }

  return (
    <div className="space-y-6">
      {/* Welcome Header with Role Context */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Bienvenido, {profile.first_name}
        </h1>
        <p className="text-muted-foreground">
          {dashboardType === 'admin_general' && 'Panel de administración - Vista global del estudio'}
          {dashboardType === 'leader' && 'Panel de líder de caso - Sus casos y equipo'}
          {dashboardType === 'case_leader' && 'Su espacio de trabajo - Tareas y casos asignados'}
        </p>
      </div>

      {/* Role-Specific Dashboard Content */}
      <Suspense fallback={<DashboardSkeleton />}>
        {dashboardType === 'admin_general' && <AdminDashboard userId={profile.id} />}
        {dashboardType === 'leader' && <LeaderDashboard userId={profile.id} />}
        {dashboardType === 'case_leader' && <LawyerDashboard userId={profile.id} />}
      </Suspense>
    </div>
  )
}

/**
 * Loading skeleton for the dashboard
 */
function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* Stats row skeleton */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-lg border border-border bg-card p-6">
            <Skeleton className="mb-2 h-4 w-24" />
            <Skeleton className="h-8 w-16" />
            <Skeleton className="mt-2 h-3 w-32" />
          </div>
        ))}
      </div>

      {/* Content grid skeleton */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <CardSkeleton />
          <CardSkeleton />
        </div>
        <div className="space-y-6">
          <CardSkeleton />
          <CardSkeleton />
        </div>
      </div>
    </div>
  )
}

/**
 * Card skeleton component
 */
function CardSkeleton() {
  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="border-b border-border p-4">
        <Skeleton className="h-5 w-40" />
      </div>
      <div className="space-y-3 p-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-md" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
