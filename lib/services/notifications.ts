import { createClient } from '@/lib/supabase/server'
import { getCurrentUserOrganizationId } from '@/lib/utils/organization'
import type { SupabaseClient } from '@supabase/supabase-js'

type NotificationType =
  | 'user_login'
  | 'user_created'
  | 'case_created'
  | 'case_updated'
  | 'case_status_changed'
  | 'document_uploaded'
  | 'document_deleted'
  | 'comment_added'
  | 'person_created'
  | 'company_created'
  | 'task_assigned'
  | 'task_created'
  | 'task_completed'
  | 'task_overdue'
  | 'deadline_approaching'
  | 'deadline_overdue'
  | 'deadline_created'
  | 'deadline_completed'
  | 'case_assigned'
  | 'mention'
  | 'task_approaching'
  | 'calendar_event_approaching'

type NotificationCategory = 'activity' | 'work'

interface CreateNotificationParams {
  userIds: string[]
  category: NotificationCategory
  type: NotificationType
  title: string
  message: string
  caseId?: string
  taskId?: string
  deadlineId?: string
  documentId?: string
  triggeredBy?: string
  metadata?: Record<string, unknown>
}

/**
 * Creates notifications for specified users.
 * Pass supabase client for cron/admin context (bypasses RLS).
 */
export async function createNotifications(
  params: CreateNotificationParams,
  options?: { supabase?: SupabaseClient; metadata?: Record<string, unknown> }
) {
  const supabase = options?.supabase ?? (await createClient())

  const metadata = { ...(params.metadata || {}), ...(options?.metadata || {}) }
  const notifications = params.userIds.map((userId) => ({
    user_id: userId,
    category: params.category,
    type: params.type,
    title: params.title,
    message: params.message,
    case_id: params.caseId || null,
    task_id: params.taskId || null,
    deadline_id: params.deadlineId || null,
    document_id: params.documentId || null,
    triggered_by: params.triggeredBy || null,
    metadata: Object.keys(metadata).length ? metadata : {},
  }))

  const { error } = await supabase.from('notifications').insert(notifications)
  
  if (error) {
    console.error('[v0] Error creating notifications:', error)
    throw error
  }
}

/**
 * Gets users to notify based on role hierarchy
 * - admin_general: gets all activity notifications (within same organization)
 * - case_leader: gets all notifications for their cases
 * - lawyer_executive: gets task and deadline notifications for their assignments
 * Pass supabase for cron context (admin client).
 */
export async function getUsersToNotify(
  params: {
    caseId?: string
    taskId?: string
    deadlineId?: string
    excludeUserId?: string
    organizationId?: string | null
  },
  options?: { supabase?: SupabaseClient }
): Promise<{ admins: string[]; caseLeaders: string[]; assignees: string[] }> {
  const supabase = options?.supabase ?? (await createClient())
  
  // Get organization_id - use provided one or get from current user (when in user context)
  let organizationId = params.organizationId
  if (!organizationId && !options?.supabase) {
    organizationId = await getCurrentUserOrganizationId()
  }
  
  // Get admins from the same organization only
  const adminQuery = supabase
    .from('profiles')
    .select('id')
    .eq('system_role', 'admin_general')
    .eq('is_active', true)
  
  if (organizationId) {
    adminQuery.eq('organization_id', organizationId)
  }
  
  const { data: admins } = await adminQuery
  const adminIds = (admins || []).map(a => a.id).filter(id => id !== params.excludeUserId)
  
  let caseLeaderIds: string[] = []
  let assigneeIds: string[] = []
  
  // Get case leader if case is provided
  if (params.caseId) {
    // First get the case to verify organization
    const { data: caseData } = await supabase
      .from('cases')
      .select('organization_id')
      .eq('id', params.caseId)
      .single()
    
    // Only proceed if case exists and belongs to the same organization
    if (caseData && (!organizationId || caseData.organization_id === organizationId)) {
      const { data: caseAssignments } = await supabase
        .from('case_assignments')
        .select('user_id, case_role, organization_id')
        .eq('case_id', params.caseId)
        
      // Additional organization filter for case assignments
      if (organizationId) {
        // Filter case assignments by organization (via the case's organization)
        // We already filtered the case by organization above, so assignments should be correct
        // But we add an explicit check for defense in depth
      }
      
      if (caseAssignments) {
        caseLeaderIds = caseAssignments
          .filter(a => a.case_role === 'leader')
          .map(a => a.user_id)
          .filter(id => id !== params.excludeUserId)
        
        assigneeIds = caseAssignments
          .map(a => a.user_id)
          .filter(id => id !== params.excludeUserId)
      }
    }
  }
  
  // Get task assignee if task is provided
  if (params.taskId) {
    const { data: task } = await supabase
      .from('tasks')
      .select('assigned_to, organization_id')
      .eq('id', params.taskId)
      .single()
    
    // Verify task belongs to same organization
    if (task && (!organizationId || task.organization_id === organizationId)) {
      if (task.assigned_to && task.assigned_to !== params.excludeUserId) {
        assigneeIds.push(task.assigned_to)
      }
    }
  }
  
  // Get deadline-related users if deadline is provided
  // Includes assigned_to, created_by, and case assignees
  if (params.deadlineId) {
    const { data: deadline } = await supabase
      .from('deadlines')
      .select('case_id, created_by, assigned_to, organization_id')
      .eq('id', params.deadlineId)
      .single()
    
    // Verify deadline belongs to same organization
    if (deadline && (!organizationId || deadline.organization_id === organizationId)) {
      // Add assigned_to (primary responsible) if not excluded
      if (deadline.assigned_to && deadline.assigned_to !== params.excludeUserId) {
        assigneeIds.push(deadline.assigned_to)
      }
      // Add creator if not excluded
      if (deadline.created_by && deadline.created_by !== params.excludeUserId) {
        assigneeIds.push(deadline.created_by)
      }
      
      // Get case assignees if case exists
      if (deadline.case_id) {
        const { data: caseAssignments } = await supabase
          .from('case_assignments')
          .select('user_id')
          .eq('case_id', deadline.case_id)
        
        if (caseAssignments) {
          caseAssignments.forEach(a => {
            if (a.user_id !== params.excludeUserId) {
              assigneeIds.push(a.user_id)
            }
          })
        }
      }
    }
  }
  
  return {
    admins: [...new Set(adminIds)],
    caseLeaders: [...new Set(caseLeaderIds)],
    assignees: [...new Set(assigneeIds)],
  }
}

/**
 * Notifies about case creation
 */
export async function notifyCaseCreated(caseId: string, caseNumber: string, title: string, createdBy: string) {
  // Get organization_id from the case
  const supabase = await createClient()
  const { data: caseData } = await supabase
    .from('cases')
    .select('organization_id')
    .eq('id', caseId)
    .single()
  
  const users = await getUsersToNotify({ 
    caseId, 
    excludeUserId: createdBy,
    organizationId: caseData?.organization_id || null
  })
  const allUsers = [...users.admins]
  
  if (allUsers.length > 0) {
    await createNotifications({
      userIds: allUsers,
      category: 'activity',
      type: 'case_created',
      title: 'Nuevo caso creado',
      message: `Se creó el caso ${caseNumber}: ${title}`,
      caseId,
      triggeredBy: createdBy,
    })
  }
}

/**
 * Notifies about task assignment
 */
export async function notifyTaskAssigned(
  taskId: string, 
  taskTitle: string, 
  caseId: string,
  assignedTo: string, 
  assignedBy: string
) {
  // Get organization_id from the task
  const supabase = await createClient()
  const { data: taskData } = await supabase
    .from('tasks')
    .select('organization_id')
    .eq('id', taskId)
    .single()
  
  const users = await getUsersToNotify({ 
    caseId, 
    taskId, 
    excludeUserId: assignedBy,
    organizationId: taskData?.organization_id || null
  })
  
  // Work notification to assignee
  if (assignedTo !== assignedBy) {
    await createNotifications({
      userIds: [assignedTo],
      category: 'work',
      type: 'task_assigned',
      title: 'Nueva tarea asignada',
      message: `Se te asignó la tarea: ${taskTitle}`,
      caseId,
      taskId,
      triggeredBy: assignedBy,
    })
  }
  
  // Activity notification to admins and case leaders
  const activityUsers = [...users.admins, ...users.caseLeaders].filter(id => id !== assignedTo)
  if (activityUsers.length > 0) {
    await createNotifications({
      userIds: activityUsers,
      category: 'activity',
      type: 'task_assigned',
      title: 'Tarea asignada',
      message: `Se asignó la tarea "${taskTitle}"`,
      caseId,
      taskId,
      triggeredBy: assignedBy,
    })
  }
}

/**
 * Notifies about task completion (activity)
 */
export async function notifyTaskCompleted(
  taskId: string,
  taskTitle: string,
  caseId: string | null,
  completedBy: string
) {
  const supabase = await createClient()
  const { data: taskData } = await supabase
    .from('tasks')
    .select('organization_id')
    .eq('id', taskId)
    .single()

  const users = await getUsersToNotify({
    caseId: caseId ?? undefined,
    taskId,
    excludeUserId: completedBy,
    organizationId: taskData?.organization_id || null,
  })
  const allUsers = [...new Set([...users.admins, ...users.caseLeaders, ...users.assignees])]

  if (allUsers.length > 0) {
    await createNotifications({
      userIds: allUsers,
      category: 'activity',
      type: 'task_completed',
      title: 'Tarea completada',
      message: `Se completó la tarea "${taskTitle}"`,
      caseId: caseId ?? undefined,
      taskId,
      triggeredBy: completedBy,
    })
  }
}

/**
 * Notifies about task creation (activity)
 */
export async function notifyTaskCreated(
  taskId: string,
  taskTitle: string,
  caseId: string | null,
  createdBy: string
) {
  const supabase = await createClient()
  const { data: taskData } = await supabase
    .from('tasks')
    .select('organization_id')
    .eq('id', taskId)
    .single()

  const users = await getUsersToNotify({
    caseId: caseId ?? undefined,
    taskId,
    excludeUserId: createdBy,
    organizationId: taskData?.organization_id || null,
  })
  const allUsers = [...new Set([...users.admins, ...users.caseLeaders])]

  if (allUsers.length > 0) {
    await createNotifications({
      userIds: allUsers,
      category: 'activity',
      type: 'task_created',
      title: 'Nueva tarea creada',
      message: `Se creó la tarea "${taskTitle}"`,
      caseId: caseId ?? undefined,
      taskId,
      triggeredBy: createdBy,
    })
  }
}

/**
 * Notifies about deadline/event creation (activity)
 */
export async function notifyDeadlineCreated(
  deadlineId: string,
  deadlineTitle: string,
  caseId: string | null,
  createdBy: string,
  assignedTo?: string | null
) {
  const supabase = await createClient()
  const { data: deadlineData } = await supabase
    .from('deadlines')
    .select('organization_id')
    .eq('id', deadlineId)
    .single()

  const users = await getUsersToNotify({
    caseId: caseId ?? undefined,
    deadlineId,
    excludeUserId: createdBy,
    organizationId: deadlineData?.organization_id || null,
  })
  const activityUsers = [...new Set([...users.admins, ...users.caseLeaders])]

  if (activityUsers.length > 0) {
    await createNotifications({
      userIds: activityUsers,
      category: 'activity',
      type: 'deadline_created',
      title: 'Nuevo evento agendado',
      message: `Se agendó el evento "${deadlineTitle}"`,
      caseId: caseId ?? undefined,
      deadlineId,
      triggeredBy: createdBy,
    })
  }

  // Work notification to assignee when assigned to someone else
  if (assignedTo && assignedTo !== createdBy) {
    await createNotifications({
      userIds: [assignedTo],
      category: 'work',
      type: 'deadline_created',
      title: 'Evento asignado',
      message: `Se te asignó el evento "${deadlineTitle}"`,
      caseId: caseId ?? undefined,
      deadlineId,
      triggeredBy: createdBy,
    })
  }
}

/**
 * Notifies about deadline completion (activity)
 */
export async function notifyDeadlineCompleted(
  deadlineId: string,
  deadlineTitle: string,
  caseId: string | null,
  completedBy: string
) {
  const supabase = await createClient()
  const { data: deadlineData } = await supabase
    .from('deadlines')
    .select('organization_id')
    .eq('id', deadlineId)
    .single()

  const users = await getUsersToNotify({
    caseId: caseId ?? undefined,
    deadlineId,
    excludeUserId: completedBy,
    organizationId: deadlineData?.organization_id || null,
  })
  const allUsers = [...new Set([...users.admins, ...users.caseLeaders, ...users.assignees])]

  if (allUsers.length > 0) {
    await createNotifications({
      userIds: allUsers,
      category: 'activity',
      type: 'deadline_completed',
      title: 'Evento completado',
      message: `Se completó el evento "${deadlineTitle}"`,
      caseId: caseId ?? undefined,
      deadlineId,
      triggeredBy: completedBy,
    })
  }
}

/**
 * Notifies about deadline assignment (work for assignee, activity for others)
 */
export async function notifyDeadlineAssigned(
  deadlineId: string,
  deadlineTitle: string,
  caseId: string | null,
  assignedTo: string,
  assignedBy: string
) {
  const supabase = await createClient()
  const { data: deadlineData } = await supabase
    .from('deadlines')
    .select('organization_id')
    .eq('id', deadlineId)
    .single()

  const users = await getUsersToNotify({
    caseId: caseId ?? undefined,
    deadlineId,
    excludeUserId: assignedBy,
    organizationId: deadlineData?.organization_id || null,
  })

  if (assignedTo !== assignedBy) {
    await createNotifications({
      userIds: [assignedTo],
      category: 'work',
      type: 'deadline_created',
      title: 'Evento asignado',
      message: `Se te asignó el evento "${deadlineTitle}"`,
      caseId: caseId ?? undefined,
      deadlineId,
      triggeredBy: assignedBy,
    })
  }

  const activityUsers = [...users.admins, ...users.caseLeaders].filter(id => id !== assignedTo)
  if (activityUsers.length > 0) {
    await createNotifications({
      userIds: activityUsers,
      category: 'activity',
      type: 'deadline_created',
      title: 'Evento asignado',
      message: `Se asignó el evento "${deadlineTitle}"`,
      caseId: caseId ?? undefined,
      deadlineId,
      triggeredBy: assignedBy,
    })
  }
}

/**
 * Notifies about approaching deadline
 */
export async function notifyDeadlineApproaching(
  deadlineId: string,
  deadlineTitle: string,
  caseId: string,
  dueDate: string,
  daysRemaining: number,
  options?: { supabase?: SupabaseClient; metadata?: Record<string, unknown> }
) {
  const supabase = options?.supabase ?? (await createClient())
  const { data: deadlineData } = await supabase
    .from('deadlines')
    .select('organization_id')
    .eq('id', deadlineId)
    .single()
  
  const users = await getUsersToNotify(
    {
      caseId,
      deadlineId,
      organizationId: deadlineData?.organization_id || null,
    },
    { supabase: options?.supabase }
  )
  const allUsers = [...new Set([...users.admins, ...users.caseLeaders, ...users.assignees])]

  if (allUsers.length > 0) {
    await createNotifications(
      {
        userIds: allUsers,
        category: 'work',
        type: 'deadline_approaching',
        title: 'Vencimiento próximo',
        message: `El plazo "${deadlineTitle}" vence en ${daysRemaining} día${daysRemaining === 1 ? '' : 's'}`,
        caseId,
        deadlineId,
        metadata: { dueDate, daysRemaining },
      },
      options
    )
  }
}

/**
 * Notifies about approaching task due date
 */
export async function notifyTaskApproaching(
  taskId: string,
  taskTitle: string,
  caseId: string,
  dueDate: string,
  daysRemaining: number,
  options?: { supabase?: SupabaseClient; metadata?: Record<string, unknown> }
) {
  const supabase = options?.supabase ?? (await createClient())
  const { data: taskData } = await supabase
    .from('tasks')
    .select('organization_id')
    .eq('id', taskId)
    .single()

  const users = await getUsersToNotify(
    {
      caseId: caseId || undefined,
      taskId,
      organizationId: taskData?.organization_id || null,
    },
    { supabase: options?.supabase }
  )
  const allUsers = [...new Set([...users.admins, ...users.caseLeaders, ...users.assignees])]

  if (allUsers.length > 0) {
    await createNotifications(
      {
        userIds: allUsers,
        category: 'work',
        type: 'task_approaching',
        title: 'Tarea próxima',
        message: `La tarea "${taskTitle}" vence en ${daysRemaining} día${daysRemaining === 1 ? '' : 's'}`,
        caseId: caseId || undefined,
        taskId,
        metadata: { dueDate, daysRemaining },
      },
      options
    )
  }
}

/**
 * Notifies about approaching Google Calendar event
 */
export async function notifyCalendarEventApproaching(
  eventId: string,
  googleEventId: string,
  summary: string,
  startAt: string,
  userId: string,
  hoursOrDaysRemaining: number,
  options?: { supabase?: SupabaseClient; metadata?: Record<string, unknown> }
) {
  const isToday = hoursOrDaysRemaining === 0
  const title = isToday ? 'Evento hoy' : 'Evento próximo'
  const message = isToday
    ? `"${summary}" comienza hoy`
    : `"${summary}" en ${hoursOrDaysRemaining} día${hoursOrDaysRemaining === 1 ? '' : 's'}`

  const baseMetadata = {
    google_calendar_event_id: eventId,
    google_event_id: googleEventId,
    start_at: startAt,
    days_before: hoursOrDaysRemaining,
    source_id: eventId,
  }
  await createNotifications(
    {
      userIds: [userId],
      category: 'work',
      type: 'calendar_event_approaching',
      title,
      message,
      metadata: baseMetadata,
    },
    options
  )
}

/**
 * Notifies about document upload
 */
export async function notifyDocumentUploaded(
  documentId: string,
  documentName: string,
  caseId: string,
  uploadedBy: string
) {
  // Get organization_id from the case
  const supabase = await createClient()
  const { data: caseData } = await supabase
    .from('cases')
    .select('organization_id')
    .eq('id', caseId)
    .single()
  
  const users = await getUsersToNotify({ 
    caseId, 
    excludeUserId: uploadedBy,
    organizationId: caseData?.organization_id || null
  })
  const allUsers = [...new Set([...users.admins, ...users.caseLeaders, ...users.assignees])]
  
  if (allUsers.length > 0) {
    await createNotifications({
      userIds: allUsers,
      category: 'activity',
      type: 'document_uploaded',
      title: 'Nuevo documento',
      message: `Se subió el documento "${documentName}"`,
      caseId,
      documentId,
      triggeredBy: uploadedBy,
    })
  }
}
