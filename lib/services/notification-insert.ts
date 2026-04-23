/**
 * Inserts notification rows with a given Supabase client.
 * No `next/headers` — safe to import from code shared with client bundles
 * (callers that run on the server pass a `SupabaseClient` from the request).
 */
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
  | 'sac_new_movements'
  | 'review_requested'
  | 'review_decided'
  | 'document_comment'

type NotificationCategory = 'activity' | 'work'

export interface CreateNotificationParams {
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
 * Inserts rows into `notifications` using the provided client (RLS applies).
 */
export async function insertNotifications(
  supabase: SupabaseClient,
  params: CreateNotificationParams,
  options?: { metadata?: Record<string, unknown> }
) {
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
