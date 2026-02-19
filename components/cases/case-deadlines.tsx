/**
 * Case Deadlines Component
 * 
 * Displays and manages deadlines and court dates for a case.
 */
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Plus, 
  Calendar, 
  Clock, 
  AlertTriangle,
  CheckCircle,
  CheckSquare,
} from 'lucide-react'
import { DeadlineCompleteButton } from '@/components/deadlines/deadline-complete-button'
import type { DeadlineType } from '@/lib/types'

interface CaseDeadlinesProps {
  caseId: string
  canEdit: boolean
}

/**
 * Deadline type configuration
 */
const deadlineTypeConfig: Record<DeadlineType, { label: string; icon: typeof Calendar }> = {
  court_date: { label: 'Audiencia', icon: Calendar },
  filing_deadline: { label: 'Presentación', icon: Clock },
  meeting: { label: 'Reunión', icon: Calendar },
  other: { label: 'Otro', icon: Clock },
}

/**
 * Fetches deadlines for a case
 */
async function getCaseDeadlines(caseId: string) {
  const supabase = await createClient()

  const { data: deadlines, error } = await supabase
    .from('deadlines')
    .select(`
      id,
      title,
      description,
      deadline_type,
      due_date,
      is_completed,
      created_at
    `)
    .eq('case_id', caseId)
    .order('due_date', { ascending: true })

  if (error) {
    console.error('Error fetching deadlines:', error)
    return []
  }

  return deadlines
}

/**
 * Fetches tasks linked to deadlines for this case
 */
async function getTasksByDeadline(caseId: string) {
  const supabase = await createClient()
  const { data: tasks, error } = await supabase
    .from('tasks')
    .select('id, title, status, deadline_id')
    .eq('case_id', caseId)
    .not('deadline_id', 'is', null)
  if (error) return new Map<string, Array<{ id: string; title: string; status: string }>>()
  const byDeadline = new Map<string, Array<{ id: string; title: string; status: string }>>()
  for (const t of tasks ?? []) {
    if (t.deadline_id) {
      const list = byDeadline.get(t.deadline_id) ?? []
      list.push({ id: t.id, title: t.title, status: t.status })
      byDeadline.set(t.deadline_id, list)
    }
  }
  return byDeadline
}

/**
 * Calculates days until deadline
 */
function getDaysUntil(dateString: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const deadline = new Date(dateString)
  deadline.setHours(0, 0, 0, 0)
  return Math.ceil((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

/**
 * Gets urgency status
 */
function getUrgencyStatus(days: number, isCompleted: boolean): { text: string; isUrgent: boolean; isPast: boolean } {
  if (isCompleted) return { text: 'Completado', isUrgent: false, isPast: false }
  if (days < 0) return { text: `Vencido hace ${Math.abs(days)} días`, isUrgent: true, isPast: true }
  if (days === 0) return { text: 'Hoy', isUrgent: true, isPast: false }
  if (days === 1) return { text: 'Mañana', isUrgent: true, isPast: false }
  if (days <= 3) return { text: `En ${days} días`, isUrgent: true, isPast: false }
  if (days <= 7) return { text: `En ${days} días`, isUrgent: false, isPast: false }
  return { text: `En ${days} días`, isUrgent: false, isPast: false }
}

export async function CaseDeadlines({ caseId, canEdit }: CaseDeadlinesProps) {
  const [deadlines, tasksByDeadline] = await Promise.all([
    getCaseDeadlines(caseId),
    getTasksByDeadline(caseId),
  ])

  // Separate by status
  const upcomingDeadlines = deadlines.filter(d => !d.is_completed)
  const completedDeadlines = deadlines.filter(d => d.is_completed)

  return (
    <div className="space-y-6">
      {/* Header with Add Button */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-foreground">
          Vencimientos ({deadlines.length})
        </h3>
        {canEdit && (
          <Button asChild size="sm">
            <Link href={`/calendario/nuevo?caso=${caseId}`}>
              <Plus className="mr-2 h-4 w-4" />
              Agregar Vencimiento
            </Link>
          </Button>
        )}
      </div>

      {deadlines.length === 0 ? (
        <Card className="border-dashed border-border/60">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Calendar className="mb-4 h-12 w-12 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              No hay vencimientos para este caso
            </p>
            {canEdit && (
              <Button asChild className="mt-4 bg-transparent" variant="outline">
                <Link href={`/calendario/nuevo?caso=${caseId}`}>
                  Agregar Primer Vencimiento
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Upcoming Deadlines */}
          {upcomingDeadlines.length > 0 && (
            <Card className="border-border/60">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Próximos ({upcomingDeadlines.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {upcomingDeadlines.map((deadline) => {
                  const typeConfig = deadlineTypeConfig[deadline.deadline_type as DeadlineType]
                  const daysUntil = getDaysUntil(deadline.due_date)
                  const { text: urgencyText, isUrgent, isPast } = getUrgencyStatus(daysUntil, false)
                  const TypeIcon = typeConfig.icon

                  return (
                    <div
                      key={deadline.id}
                      className="flex items-start gap-3 rounded-md p-3 transition-colors hover:bg-muted/50"
                    >
                      {/* Date Box */}
                      <div className={`flex h-12 w-12 flex-col items-center justify-center rounded-md border ${
                        isPast 
                          ? 'border-destructive bg-destructive/10' 
                          : isUrgent 
                            ? 'border-warning/50 bg-warning/10' 
                            : 'border-border bg-muted/50'
                      }`}>
                        <span className={`text-xs font-medium ${
                          isPast ? 'text-destructive' : isUrgent ? 'text-warning' : 'text-muted-foreground'
                        }`}>
                          {new Date(deadline.due_date).toLocaleDateString('es-AR', { month: 'short' }).toUpperCase()}
                        </span>
                        <span className={`text-lg font-bold ${
                          isPast ? 'text-destructive' : isUrgent ? 'text-warning' : 'text-foreground'
                        }`}>
                          {new Date(deadline.due_date).getDate()}
                        </span>
                      </div>

                      {/* Deadline Info */}
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="h-5 gap-1 text-[10px]">
                            <TypeIcon className="h-3 w-3" />
                            {typeConfig.label}
                          </Badge>
                          {(isUrgent || isPast) && (
                            <Badge 
                              variant={isPast ? 'destructive' : 'secondary'} 
                              className="h-5 gap-1 text-[10px]"
                            >
                              <AlertTriangle className="h-3 w-3" />
                              {urgencyText}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm font-medium text-foreground">
                          {deadline.title}
                        </p>
                        {deadline.description && (
                          <p className="text-xs text-muted-foreground line-clamp-1">
                            {deadline.description}
                          </p>
                        )}
                        {(() => {
                          const tasks = tasksByDeadline.get(deadline.id) ?? []
                          if (tasks.length === 0) return null
                          return (
                            <div className="mt-2 space-y-1 pl-2 border-l-2 border-muted">
                              {tasks.map((task) => (
                                <Link
                                  key={task.id}
                                  href={`/casos/${caseId}?tab=tareas`}
                                  className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground"
                                >
                                  <CheckSquare className="h-3 w-3 shrink-0" />
                                  <span className={task.status === 'completed' ? 'line-through' : ''}>
                                    {task.title}
                                  </span>
                                </Link>
                              ))}
                            </div>
                          )
                        })()}
                      </div>
                      {canEdit && (
                        <DeadlineCompleteButton
                          deadlineId={deadline.id}
                          variant="outline"
                          size="sm"
                        />
                      )}
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          )}

          {/* Completed Deadlines */}
          {completedDeadlines.length > 0 && (
            <Card className="border-border/60">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Completados ({completedDeadlines.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {completedDeadlines.map((deadline) => {
                  const typeConfig = deadlineTypeConfig[deadline.deadline_type as DeadlineType]

                  return (
                    <div
                      key={deadline.id}
                      className="flex items-center gap-3 rounded-md p-2 opacity-60"
                    >
                      <CheckCircle className="h-5 w-5 text-success" />
                      <div className="flex-1">
                        <p className="text-sm text-foreground line-through">
                          {deadline.title}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {typeConfig.label} · {new Date(deadline.due_date).toLocaleDateString('es-AR')}
                        </p>
                      </div>
                    </div>
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
