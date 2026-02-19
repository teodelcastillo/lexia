/**
 * Activity Log Service
 *
 * Logs user actions for the "Actividad Reciente" dashboard.
 * Store rich descriptions like "terminó la tarea X", "creó el evento Y", "asignó la tarea Z a María".
 */
import type { SupabaseClient } from '@supabase/supabase-js'

export interface LogActivityParams {
  supabase: SupabaseClient
  userId: string
  actionType: string
  entityType: string
  entityId: string
  caseId?: string | null
  description: string
  newValues?: Record<string, unknown> | null
  oldValues?: Record<string, unknown> | null
}

/**
 * Inserts an activity log entry. Call from client or server after a successful action.
 */
export async function logActivity(params: LogActivityParams): Promise<void> {
  const {
    supabase,
    userId,
    actionType,
    entityType,
    entityId,
    caseId,
    description,
    newValues,
    oldValues,
  } = params

  try {
    await supabase.from('activity_log').insert({
      user_id: userId,
      action_type: actionType,
      entity_type: entityType,
      entity_id: entityId,
      case_id: caseId ?? null,
      description,
      new_values: newValues ?? null,
      old_values: oldValues ?? null,
    })
  } catch (err) {
    console.error('[ActivityLog] Error logging activity:', err)
  }
}
