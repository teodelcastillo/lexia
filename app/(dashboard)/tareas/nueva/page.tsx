/**
 * New Task Page
 * 
 * Form for creating new tasks with:
 * - Title and description
 * - Due date and priority selection
 * - User assignment
 * - Case connection
 */
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import { TaskForm } from '@/components/tasks/task-form'
import { getCurrentUserOrganizationId } from '@/lib/utils/organization'

export const metadata = {
  title: 'Nueva Tarea',
  description: 'Crear una nueva tarea',
}

interface NewTaskPageProps {
  searchParams: Promise<{
    caso?: string
    evento?: string
  }>
}

export default async function NewTaskPage({ searchParams }: NewTaskPageProps) {
  const supabase = await createClient()
  const params = await searchParams
  
  // Validate user access
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

  const organizationId = await getCurrentUserOrganizationId()
  const isAdmin = profile?.system_role === 'admin_general'

  // Fetch case IDs the user is assigned to (required for tasks RLS)
  const { data: assignments } = await supabase
    .from('case_assignments')
    .select('case_id')
    .eq('user_id', user.id)
  const assignedCaseIds = (assignments ?? []).map((a) => a.case_id)

  // Fetch available cases: admins see all org cases, others only assigned cases
  let cases: Array<{ id: string; case_number: string; title: string }> = []
  if (isAdmin && organizationId) {
    const { data } = await supabase
      .from('cases')
      .select('id, case_number, title')
      .eq('organization_id', organizationId)
      .in('status', ['active', 'pending'])
      .order('case_number', { ascending: false })
    cases = data ?? []
  } else if (assignedCaseIds.length > 0) {
    const { data } = await supabase
      .from('cases')
      .select('id, case_number, title')
      .in('id', assignedCaseIds)
      .in('status', ['active', 'pending'])
      .order('case_number', { ascending: false })
    cases = data ?? []
  }

  // Fetch team members for assignment (filtered by organization)
  const teamMembersQuery = supabase
    .from('profiles')
    .select('id, first_name, last_name, system_role')
    .in('system_role', ['admin_general', 'case_leader', 'lawyer_executive'])
    .eq('is_active', true)
    .order('first_name')

  if (organizationId) {
    teamMembersQuery.eq('organization_id', organizationId)
  }

  const { data: teamMembers } = await teamMembersQuery

  // If caso param provided, use it as preselected only if user has access
  const preselectedCase =
    params.caso && cases.some((c) => c.id === params.caso)
      ? cases.find((c) => c.id === params.caso) ?? null
      : null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild className="bg-transparent">
          <Link href="/tareas">
            <ArrowLeft className="h-4 w-4" />
            <span className="sr-only">Volver</span>
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Nueva Tarea
          </h1>
          <p className="text-sm text-muted-foreground">
            Complete los datos para crear una nueva tarea
          </p>
        </div>
      </div>

      {/* Task Form */}
      <TaskForm 
        cases={cases}
        teamMembers={teamMembers || []}
        preselectedCase={preselectedCase}
        currentUserId={user.id}
        linkedGoogleEventId={params.evento || null}
        noCasesMessage={
          cases.length === 0
            ? 'No hay casos asignados. Asigne un caso primero desde la ficha del caso.'
            : undefined
        }
      />
    </div>
  )
}
