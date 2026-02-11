/**
 * Pending Tasks Component
 * 
 * Displays a list of pending and in-progress tasks assigned to the user.
 */
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { ArrowRight, CheckSquare } from 'lucide-react'
import type { TaskPriority, TaskStatus } from '@/lib/types'

/**
 * Task status configuration
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
 * Fetches pending tasks for the current user
 */
async function getPendingTasks() {
  const supabase = await createClient()

  // Get current user
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data: tasks, error } = await supabase
    .from('tasks')
    .select(`
      id,
      title,
      status,
      priority,
      due_date,
      cases (
        id,
        case_number,
        title
      )
    `)
    .or(`assigned_to.eq.${user.id},created_by.eq.${user.id}`)
    .in('status', ['pending', 'in_progress'])
    .order('due_date', { ascending: true, nullsFirst: false })
    .order('priority', { ascending: false })
    .limit(5)

  if (error) {
    console.error('Error fetching tasks:', error)
    return []
  }

  return tasks
}

/**
 * Formats a due date for display
 */
function formatDueDate(dateString: string | null): { text: string; isOverdue: boolean } {
  if (!dateString) return { text: 'Sin fecha', isOverdue: false }

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const dueDate = new Date(dateString)
  dueDate.setHours(0, 0, 0, 0)

  const diffDays = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays < 0) return { text: `Vencida hace ${Math.abs(diffDays)} días`, isOverdue: true }
  if (diffDays === 0) return { text: 'Vence hoy', isOverdue: false }
  if (diffDays === 1) return { text: 'Vence mañana', isOverdue: false }
  if (diffDays <= 7) return { text: `Vence en ${diffDays} días`, isOverdue: false }

  return {
    text: dueDate.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }),
    isOverdue: false,
  }
}

export async function PendingTasks() {
  const tasks = await getPendingTasks()

  return (
    <Card className="border-border/60">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base font-semibold">Tareas Pendientes</CardTitle>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/tareas" className="text-xs">
            Ver todas
            <ArrowRight className="ml-1 h-3 w-3" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <CheckSquare className="mb-2 h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              No hay tareas pendientes
            </p>
            <p className="text-xs text-muted-foreground">
              ¡Buen trabajo!
            </p>
          </div>
        ) : (
          tasks.map((task) => {
            const caseData = task.cases as unknown as { id: string; case_number: string; title: string } | null
            const status = statusConfig[task.status as TaskStatus]
            const { text: dueDateText, isOverdue } = formatDueDate(task.due_date)

            return (
              <Link
                key={task.id}
                href={`/tareas/${task.id}`}
                className={`flex items-start gap-3 rounded-md border-l-2 p-2 transition-colors hover:bg-muted/50 ${
                  priorityColors[task.priority as TaskPriority]
                }`}
              >
                {/* Checkbox (visual only in dashboard) */}
                <Checkbox
                  checked={task.status === 'completed'}
                  className="mt-0.5"
                  disabled
                />

                {/* Task Info */}
                <div className="flex-1 space-y-1">
                  <p className="text-sm font-medium text-foreground line-clamp-1">
                    {task.title}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={status.variant} className="h-5 text-[10px]">
                      {status.label}
                    </Badge>
                    <span className={`text-xs ${isOverdue ? 'font-medium text-destructive' : 'text-muted-foreground'}`}>
                      {dueDateText}
                    </span>
                  </div>
                  {caseData && (
                    <p className="text-xs text-muted-foreground">
                      {caseData.case_number} · {caseData.title}
                    </p>
                  )}
                </div>
              </Link>
            )
          })
        )}
      </CardContent>
    </Card>
  )
}
