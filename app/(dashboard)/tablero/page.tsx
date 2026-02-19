/**
 * Kanban Board Page
 *
 * Trello-style board for tasks. Columns = status. Drag & drop updates status.
 */
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getCurrentUserOrganizationId } from '@/lib/utils/organization'
import { KanbanBoard } from '@/components/kanban/kanban-board'
import type { TaskStatus } from '@/lib/types'

export const metadata = {
  title: 'Tablero',
  description: 'Tablero Kanban de tareas',
}

const KANBAN_STATUSES: TaskStatus[] = ['pending', 'in_progress', 'under_review', 'completed']

async function getTasksForKanban(userId: string, organizationId: string | null) {
  const supabase = await createClient()

  let query = supabase
    .from('tasks')
    .select(
      `
      id,
      title,
      description,
      status,
      priority,
      due_date,
      created_at,
      cases (
        id,
        case_number,
        title
      ),
      assignee:profiles!assigned_to (
        id,
        first_name,
        last_name
      )
    `
    )
    .or(`assigned_to.eq.${userId},created_by.eq.${userId}`)
    .neq('status', 'cancelled')
    .order('due_date', { ascending: true, nullsFirst: false })
    .order('priority', { ascending: false })
    .limit(200)

  if (organizationId) {
    query = query.eq('organization_id', organizationId)
  }

  const { data: tasks, error } = await query

  if (error) {
    console.error('Error fetching tasks for Kanban:', error)
    return []
  }

  return tasks || []
}

async function getCasesForBoard(userId: string, organizationId: string | null) {
  const supabase = await createClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('system_role')
    .eq('id', userId)
    .single()
  const isAdmin = profile?.system_role === 'admin_general'

  // Fetch case IDs the user is assigned to
  const { data: assignments } = await supabase
    .from('case_assignments')
    .select('case_id')
    .eq('user_id', userId)
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
  return cases
}

export default async function TableroPage() {
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

  const organizationId = await getCurrentUserOrganizationId()
  const [tasks, cases] = await Promise.all([
    getTasksForKanban(user.id, organizationId),
    getCasesForBoard(user.id, organizationId),
  ])

  return (
    <KanbanBoard
      tasks={tasks}
      columns={KANBAN_STATUSES}
      cases={cases}
      currentUserId={user.id}
    />
  )
}
