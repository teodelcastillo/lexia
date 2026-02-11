/**
 * Case Tasks Component
 * 
 * Displays and manages tasks associated with a case.
 */
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Plus, CheckSquare } from 'lucide-react'
import type { TaskStatus, TaskPriority } from '@/lib/types'

interface CaseTasksProps {
  caseId: string
  canEdit: boolean
}

/**
 * Status configuration
 */
const statusConfig: Record<TaskStatus, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
  pending: { label: 'Pendiente', variant: 'secondary' },
  in_progress: { label: 'En Progreso', variant: 'default' },
  completed: { label: 'Completada', variant: 'outline' },
  cancelled: { label: 'Cancelada', variant: 'outline' },
}

/**
 * Priority indicator colors
 */
const priorityColors: Record<TaskPriority, string> = {
  low: 'border-l-muted-foreground/30',
  medium: 'border-l-chart-2',
  high: 'border-l-warning',
  urgent: 'border-l-destructive',
}

/**
 * Fetches tasks for a case
 */
async function getCaseTasks(caseId: string) {
  const supabase = await createClient()

  const { data: tasks, error } = await supabase
    .from('tasks')
    .select(`
      id,
      title,
      status,
      priority,
      due_date,
      profiles:assigned_to (
        id,
        first_name,
        last_name
      )
    `)
    .eq('case_id', caseId)
    .order('status', { ascending: true })
    .order('due_date', { ascending: true, nullsFirst: false })

  if (error) {
    console.error('Error fetching tasks:', error)
    return []
  }

  return tasks
}

/**
 * Formats date for display
 */
function formatDueDate(dateString: string | null): { text: string; isOverdue: boolean } {
  if (!dateString) return { text: 'Sin fecha', isOverdue: false }

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const dueDate = new Date(dateString)
  dueDate.setHours(0, 0, 0, 0)

  const diffDays = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays < 0) return { text: `Vencida`, isOverdue: true }
  if (diffDays === 0) return { text: 'Hoy', isOverdue: false }
  if (diffDays === 1) return { text: 'Mañana', isOverdue: false }

  return {
    text: dueDate.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }),
    isOverdue: false,
  }
}

export async function CaseTasks({ caseId, canEdit }: CaseTasksProps) {
  const tasks = await getCaseTasks(caseId)

  // Separate tasks by status
  const pendingTasks = tasks.filter(t => t.status === 'pending' || t.status === 'in_progress')
  const completedTasks = tasks.filter(t => t.status === 'completed' || t.status === 'cancelled')

  return (
    <div className="space-y-6">
      {/* Header with Add Button */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-foreground">
          Tareas del Caso ({tasks.length})
        </h3>
        {canEdit && (
          <Button asChild size="sm">
            <Link href={`/tareas/nueva?caso=${caseId}`}>
              <Plus className="mr-2 h-4 w-4" />
              Nueva Tarea
            </Link>
          </Button>
        )}
      </div>

      {tasks.length === 0 ? (
        <Card className="border-dashed border-border/60">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <CheckSquare className="mb-4 h-12 w-12 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              No hay tareas para este caso
            </p>
            {canEdit && (
              <Button asChild className="mt-4 bg-transparent" variant="outline">
                <Link href={`/tareas/nueva?caso=${caseId}`}>
                  Crear Primera Tarea
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Pending Tasks */}
          {pendingTasks.length > 0 && (
            <Card className="border-border/60">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Pendientes ({pendingTasks.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {pendingTasks.map((task) => {
                  const assignee = task.profiles as { id: string; first_name: string; last_name: string } | null
                  const status = statusConfig[task.status as TaskStatus]
                  const { text: dueDateText, isOverdue } = formatDueDate(task.due_date)

                  return (
                    <Link
                      key={task.id}
                      href={`/tareas/${task.id}`}
                      className={`flex items-start gap-3 rounded-md border-l-2 p-3 transition-colors hover:bg-muted/50 ${
                        priorityColors[task.priority as TaskPriority]
                      }`}
                    >
                      <Checkbox
                        checked={false}
                        className="mt-0.5"
                        disabled
                      />
                      <div className="flex-1 space-y-1">
                        <p className="text-sm font-medium text-foreground">
                          {task.title}
                        </p>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant={status.variant} className="h-5 text-[10px]">
                            {status.label}
                          </Badge>
                          <span className={`text-xs ${isOverdue ? 'font-medium text-destructive' : 'text-muted-foreground'}`}>
                            {dueDateText}
                          </span>
                          {assignee && (
                            <span className="text-xs text-muted-foreground">
                              · {assignee.first_name} {assignee.last_name}
                            </span>
                          )}
                        </div>
                      </div>
                    </Link>
                  )
                })}
              </CardContent>
            </Card>
          )}

          {/* Completed Tasks */}
          {completedTasks.length > 0 && (
            <Card className="border-border/60">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Completadas ({completedTasks.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {completedTasks.map((task) => {
                  const assignee = task.profiles as { id: string; first_name: string; last_name: string } | null

                  return (
                    <Link
                      key={task.id}
                      href={`/tareas/${task.id}`}
                      className="flex items-start gap-3 rounded-md p-3 opacity-60 transition-colors hover:bg-muted/50"
                    >
                      <Checkbox
                        checked={true}
                        className="mt-0.5"
                        disabled
                      />
                      <div className="flex-1 space-y-1">
                        <p className="text-sm font-medium text-foreground line-through">
                          {task.title}
                        </p>
                        {assignee && (
                          <p className="text-xs text-muted-foreground">
                            {assignee.first_name} {assignee.last_name}
                          </p>
                        )}
                      </div>
                    </Link>
                  )
                })}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
