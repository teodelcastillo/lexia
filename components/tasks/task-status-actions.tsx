/**
 * Task Status Actions Component
 * 
 * Quick action buttons to change task status.
 * Displays contextual buttons based on current status.
 */
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { logActivity } from '@/lib/services/activity-log'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  Play,
  Check,
  RotateCcw,
  Loader2,
  XCircle,
} from 'lucide-react'
import type { TaskStatus } from '@/lib/types'

interface TaskStatusActionsProps {
  /** Task ID */
  taskId: string
  /** Current task status */
  currentStatus: TaskStatus
  /** Task title for activity log */
  taskTitle?: string
  /** Case ID for activity log */
  caseId?: string | null
}

/** Status transition configuration */
const statusTransitions: Record<TaskStatus, Array<{
  newStatus: TaskStatus
  label: string
  icon: typeof Play
  variant: 'default' | 'outline' | 'destructive'
}>> = {
  pending: [
    { newStatus: 'in_progress', label: 'Iniciar', icon: Play, variant: 'default' },
    { newStatus: 'completed', label: 'Completar', icon: Check, variant: 'outline' },
  ],
  in_progress: [
    { newStatus: 'completed', label: 'Completar', icon: Check, variant: 'default' },
    { newStatus: 'pending', label: 'Pausar', icon: RotateCcw, variant: 'outline' },
  ],
  under_review: [
    { newStatus: 'completed', label: 'Completar', icon: Check, variant: 'default' },
    { newStatus: 'in_progress', label: 'Volver a progreso', icon: Play, variant: 'outline' },
  ],
  completed: [
    { newStatus: 'pending', label: 'Reabrir', icon: RotateCcw, variant: 'outline' },
  ],
  cancelled: [
    { newStatus: 'pending', label: 'Reactivar', icon: RotateCcw, variant: 'outline' },
  ],
}

export function TaskStatusActions({ taskId, currentStatus, taskTitle, caseId }: TaskStatusActionsProps) {
  const router = useRouter()
  const [isUpdating, setIsUpdating] = useState<TaskStatus | null>(null)
  const [showCancelDialog, setShowCancelDialog] = useState(false)

  /** Updates task status */
  async function updateStatus(newStatus: TaskStatus) {
    setIsUpdating(newStatus)

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No autenticado')

      const { error } = await supabase
        .from('tasks')
        .update({ 
          status: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', taskId)

      if (error) throw error

      const statusLabels: Record<TaskStatus, string> = {
        pending: 'pendiente',
        in_progress: 'en progreso',
        under_review: 'en revisión',
        completed: 'completada',
        cancelled: 'cancelada',
      }

      const title = taskTitle || 'Tarea'
      const actionDesc =
        newStatus === 'completed'
          ? `terminó la tarea "${title}"`
          : newStatus === 'cancelled'
            ? `canceló la tarea "${title}"`
            : `cambió el estado de la tarea "${title}" a ${statusLabels[newStatus]}`
      await logActivity({
        supabase,
        userId: user.id,
        actionType: newStatus === 'completed' ? 'completed' : 'updated',
        entityType: 'task',
        entityId: taskId,
        caseId,
        description: actionDesc,
        newValues: { status: newStatus },
      })

      if (newStatus === 'completed') {
        try {
          await fetch('/api/notifications/trigger', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'task_completed',
              taskId,
              taskTitle: title,
              caseId: caseId ?? '',
            }),
          })
        } catch {
          // Non-blocking
        }
      }

      toast.success(`Tarea marcada como ${statusLabels[newStatus]}`)
      router.refresh()

    } catch (error) {
      console.error('Error updating task status:', error)
      toast.error('Error al actualizar el estado')
    } finally {
      setIsUpdating(null)
    }
  }

  /** Cancels the task */
  async function cancelTask() {
    setIsUpdating('cancelled')
    setShowCancelDialog(false)

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No autenticado')

      const { error } = await supabase
        .from('tasks')
        .update({ 
          status: 'cancelled',
          updated_at: new Date().toISOString(),
        })
        .eq('id', taskId)

      if (error) throw error

      const title = taskTitle || 'Tarea'
      await logActivity({
        supabase,
        userId: user.id,
        actionType: 'updated',
        entityType: 'task',
        entityId: taskId,
        caseId,
        description: `canceló la tarea "${title}"`,
        newValues: { status: 'cancelled' },
      })

      toast.success('Tarea cancelada')
      router.refresh()

    } catch (error) {
      console.error('Error cancelling task:', error)
      toast.error('Error al cancelar la tarea')
    } finally {
      setIsUpdating(null)
    }
  }

  const transitions = statusTransitions[currentStatus] || []

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Status transition buttons */}
      {transitions.map((transition) => {
        const Icon = transition.icon
        const isLoading = isUpdating === transition.newStatus

        return (
          <Button
            key={transition.newStatus}
            variant={transition.variant}
            size="sm"
            onClick={() => updateStatus(transition.newStatus)}
            disabled={isUpdating !== null}
            className={transition.variant === 'outline' ? 'bg-transparent' : ''}
          >
            {isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Icon className="mr-2 h-4 w-4" />
            )}
            {transition.label}
          </Button>
        )
      })}

      {/* Cancel button (only for pending or in_progress) */}
      {(currentStatus === 'pending' || currentStatus === 'in_progress') && (
        <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
          <AlertDialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="bg-transparent text-destructive hover:text-destructive"
              disabled={isUpdating !== null}
            >
              <XCircle className="mr-2 h-4 w-4" />
              Cancelar
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Cancelar Tarea</AlertDialogTitle>
              <AlertDialogDescription>
                ¿Está seguro de que desea cancelar esta tarea? 
                Puede reactivarla más tarde si lo necesita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="bg-transparent">No, mantener</AlertDialogCancel>
              <AlertDialogAction
                onClick={cancelTask}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isUpdating === 'cancelled' ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Sí, cancelar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  )
}
