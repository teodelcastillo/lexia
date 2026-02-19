/**
 * Edit Task Page
 *
 * Page for editing an existing task.
 */
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { TaskForm } from '@/components/tasks/task-form'
import { getCurrentUserOrganizationId } from '@/lib/utils/organization'

export const metadata = {
  title: 'Editar Tarea',
  description: 'Editar una tarea existente',
}

interface EditTaskPageProps {
  params: Promise<{ id: string }>
}

export default async function EditTaskPage({ params }: EditTaskPageProps) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('system_role')
    .eq('id', user.id)
    .single()

  if (profile?.system_role === 'client') {
    redirect('/portal')
  }

  const { data: task } = await supabase
    .from('tasks')
    .select(
      'id, title, description, priority, due_date, case_id, assigned_to, deadline_id, created_by, google_calendar_event_id'
    )
    .eq('id', id)
    .single()

  if (!task) {
    redirect('/tareas?error=task_not_found')
  }

  const canEdit =
    profile?.system_role === 'admin_general' ||
    task.created_by === user.id ||
    task.assigned_to === user.id

  if (!canEdit) {
    redirect(`/tareas/${id}`)
  }

  const organizationId = await getCurrentUserOrganizationId()
  const isAdmin = profile?.system_role === 'admin_general'

  const { data: assignments } = await supabase
    .from('case_assignments')
    .select('case_id')
    .eq('user_id', user.id)
  const assignedCaseIds = (assignments ?? []).map((a) => a.case_id)

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

  if (task.case_id && !cases.some((c) => c.id === task.case_id)) {
    const { data: fallbackCase } = await supabase
      .from('cases')
      .select('id, case_number, title')
      .eq('id', task.case_id)
      .single()
    if (fallbackCase) {
      cases = [fallbackCase, ...cases]
    }
  }

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

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild className="bg-transparent">
          <Link href={`/tareas/${id}`}>
            <ArrowLeft className="h-4 w-4" />
            <span className="sr-only">Volver</span>
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Editar Tarea
          </h1>
          <p className="text-sm text-muted-foreground">
            Actualice los datos de la tarea
          </p>
        </div>
      </div>

      <TaskForm
        cases={cases}
        teamMembers={teamMembers || []}
        currentUserId={user.id}
        existingTask={{
          id: task.id,
          title: task.title,
          description: task.description,
          priority: task.priority,
          due_date: task.due_date,
          case_id: task.case_id,
          assigned_to: task.assigned_to,
          deadline_id: task.deadline_id,
          google_calendar_event_id: task.google_calendar_event_id,
        }}
      />
    </div>
  )
}
