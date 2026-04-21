/**
 * POST /api/notifications/trigger
 *
 * Triggers notifications from client after successful actions.
 * Validates that the current user is the one performing the action.
 */
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import {
  notifyTaskAssigned,
  notifyTaskCompleted,
  notifyTaskCreated,
  notifyDeadlineCreated,
  notifyDeadlineAssigned,
} from '@/lib/services/notifications'

const BODY_SCHEMA = {
  task_assigned: (v: unknown) => {
    const o = v as Record<string, unknown>
    return (
      typeof o?.taskId === 'string' &&
      typeof o?.taskTitle === 'string' &&
      (typeof o?.caseId === 'string' || o?.caseId === null) &&
      typeof o?.assignedTo === 'string'
    )
  },
  task_completed: (v: unknown) => {
    const o = v as Record<string, unknown>
    return (
      typeof o?.taskId === 'string' &&
      typeof o?.taskTitle === 'string' &&
      (typeof o?.caseId === 'string' || o?.caseId === null)
    )
  },
  task_created: (v: unknown) => {
    const o = v as Record<string, unknown>
    return (
      typeof o?.taskId === 'string' &&
      typeof o?.taskTitle === 'string' &&
      (typeof o?.caseId === 'string' || o?.caseId === null)
    )
  },
  deadline_created: (v: unknown) => {
    const o = v as Record<string, unknown>
    return (
      typeof o?.deadlineId === 'string' &&
      typeof o?.deadlineTitle === 'string' &&
      (typeof o?.caseId === 'string' || o?.caseId === null)
    )
  },
  deadline_assigned: (v: unknown) => {
    const o = v as Record<string, unknown>
    return (
      typeof o?.deadlineId === 'string' &&
      typeof o?.deadlineTitle === 'string' &&
      (typeof o?.caseId === 'string' || o?.caseId === null) &&
      typeof o?.assignedTo === 'string'
    )
  },
} as const

type TriggerType = keyof typeof BODY_SCHEMA

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const type = body?.type as TriggerType | undefined

    if (!type || !(type in BODY_SCHEMA) || !BODY_SCHEMA[type](body)) {
      return NextResponse.json({ error: 'Payload inválido' }, { status: 400 })
    }

    // Load the referenced task/deadline from the database and assert the
    // caller is genuinely authorized to emit the notification. This prevents
    // any authenticated user from fabricating fake notifications to others.
    if (type === 'task_assigned' || type === 'task_completed' || type === 'task_created') {
      const { data: task } = await supabase
        .from('tasks')
        .select('id, case_id, assigned_to, status, created_by')
        .eq('id', body.taskId)
        .maybeSingle()

      if (!task) {
        return NextResponse.json({ error: 'Tarea no encontrada' }, { status: 404 })
      }

      if (body.caseId && task.case_id && task.case_id !== body.caseId) {
        return NextResponse.json({ error: 'case_id no coincide con la tarea' }, { status: 400 })
      }

      if (type === 'task_assigned' && task.assigned_to !== body.assignedTo) {
        return NextResponse.json(
          { error: 'assignedTo no coincide con la tarea' },
          { status: 400 }
        )
      }

      if (type === 'task_completed' && task.status !== 'completed') {
        return NextResponse.json(
          { error: 'La tarea no está completada' },
          { status: 400 }
        )
      }
    }

    if (type === 'deadline_created' || type === 'deadline_assigned') {
      const { data: deadline } = await supabase
        .from('deadlines')
        .select('id, case_id, assigned_to')
        .eq('id', body.deadlineId)
        .maybeSingle()

      if (!deadline) {
        return NextResponse.json({ error: 'Vencimiento no encontrado' }, { status: 404 })
      }

      if (body.caseId && deadline.case_id && deadline.case_id !== body.caseId) {
        return NextResponse.json({ error: 'case_id no coincide con el vencimiento' }, { status: 400 })
      }

      if (type === 'deadline_assigned' && deadline.assigned_to !== body.assignedTo) {
        return NextResponse.json(
          { error: 'assignedTo no coincide con el vencimiento' },
          { status: 400 }
        )
      }
    }

    switch (type) {
      case 'task_assigned': {
        await notifyTaskAssigned(
          body.taskId,
          body.taskTitle,
          body.caseId ?? '',
          body.assignedTo,
          user.id
        )
        break
      }
      case 'task_completed': {
        await notifyTaskCompleted(
          body.taskId,
          body.taskTitle,
          body.caseId ?? null,
          user.id
        )
        break
      }
      case 'task_created': {
        await notifyTaskCreated(
          body.taskId,
          body.taskTitle,
          body.caseId ?? null,
          user.id
        )
        break
      }
      case 'deadline_created': {
        await notifyDeadlineCreated(
          body.deadlineId,
          body.deadlineTitle,
          body.caseId ?? null,
          user.id,
          body.assignedTo ?? null
        )
        break
      }
      case 'deadline_assigned': {
        await notifyDeadlineAssigned(
          body.deadlineId,
          body.deadlineTitle,
          body.caseId ?? null,
          body.assignedTo,
          user.id
        )
        break
      }
      default:
        return NextResponse.json({ error: 'Tipo no soportado' }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[Notifications Trigger]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error al crear notificaciones' },
      { status: 500 }
    )
  }
}
