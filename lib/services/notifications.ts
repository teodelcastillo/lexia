import { createClient } from '@/lib/supabase/server'

type NotificationType = 
  | 'user_login' | 'user_created' | 'case_created' | 'case_updated' 
  | 'case_status_changed' | 'document_uploaded' | 'document_deleted'
  | 'comment_added' | 'person_created' | 'company_created'
  | 'task_assigned' | 'task_completed' | 'task_overdue'
  | 'deadline_approaching' | 'deadline_overdue' | 'deadline_created'
  | 'case_assigned' | 'mention'

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
 * Creates notifications for specified users
 */
export async function createNotifications(params: CreateNotificationParams) {
  const supabase = await createClient()
  
  const notifications = params.userIds.map(userId => ({
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
    metadata: params.metadata || {},
  }))

  const { error } = await supabase.from('notifications').insert(notifications)
  
  if (error) {
    console.error('[v0] Error creating notifications:', error)
    throw error
  }
}

/**
 * Gets users to notify based on role hierarchy
 * - admin_general: gets all activity notifications
 * - case_leader: gets all notifications for their cases
 * - lawyer_executive: gets task and deadline notifications for their assignments
 */
export async function getUsersToNotify(params: {
  caseId?: string
  taskId?: string
  deadlineId?: string
  excludeUserId?: string
}): Promise<{ admins: string[], caseLeaders: string[], assignees: string[] }> {
  const supabase = await createClient()
  
  // Get all admins
  const { data: admins } = await supabase
    .from('profiles')
    .select('id')
    .eq('system_role', 'admin_general')
  
  const adminIds = (admins || []).map(a => a.id).filter(id => id !== params.excludeUserId)
  
  let caseLeaderIds: string[] = []
  let assigneeIds: string[] = []
  
  // Get case leader if case is provided
  if (params.caseId) {
    const { data: caseAssignments } = await supabase
      .from('case_assignments')
      .select('user_id, role')
      .eq('case_id', params.caseId)
    
    if (caseAssignments) {
      caseLeaderIds = caseAssignments
        .filter(a => a.role === 'lead')
        .map(a => a.user_id)
        .filter(id => id !== params.excludeUserId)
      
      assigneeIds = caseAssignments
        .map(a => a.user_id)
        .filter(id => id !== params.excludeUserId)
    }
  }
  
  // Get task assignee if task is provided
  if (params.taskId) {
    const { data: task } = await supabase
      .from('tasks')
      .select('assigned_to')
      .eq('id', params.taskId)
      .single()
    
    if (task?.assigned_to && task.assigned_to !== params.excludeUserId) {
      assigneeIds.push(task.assigned_to)
    }
  }
  
  // Get deadline assignee if deadline is provided
  if (params.deadlineId) {
    const { data: deadline } = await supabase
      .from('deadlines')
      .select('assigned_to')
      .eq('id', params.deadlineId)
      .single()
    
    if (deadline?.assigned_to && deadline.assigned_to !== params.excludeUserId) {
      assigneeIds.push(deadline.assigned_to)
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
  const users = await getUsersToNotify({ caseId, excludeUserId: createdBy })
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
  const users = await getUsersToNotify({ caseId, taskId, excludeUserId: assignedBy })
  
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
 * Notifies about approaching deadline
 */
export async function notifyDeadlineApproaching(
  deadlineId: string,
  deadlineTitle: string,
  caseId: string,
  dueDate: string,
  daysRemaining: number
) {
  const users = await getUsersToNotify({ caseId, deadlineId })
  const allUsers = [...new Set([...users.admins, ...users.caseLeaders, ...users.assignees])]
  
  if (allUsers.length > 0) {
    await createNotifications({
      userIds: allUsers,
      category: 'work',
      type: 'deadline_approaching',
      title: 'Vencimiento próximo',
      message: `El plazo "${deadlineTitle}" vence en ${daysRemaining} día${daysRemaining === 1 ? '' : 's'}`,
      caseId,
      deadlineId,
      metadata: { dueDate, daysRemaining },
    })
  }
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
  const users = await getUsersToNotify({ caseId, excludeUserId: uploadedBy })
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
