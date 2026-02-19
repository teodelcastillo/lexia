import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { TaskStatusActions } from '@/components/tasks/task-status-actions'
import { TaskComments } from '@/components/tasks/task-comments'
import type { TaskStatus } from '@/lib/types'
import {
  getEventStatus,
  temporalStateLabels,
  preparationStateLabels,
  legalRiskLabels,
  eventKindLabels,
} from '@/lib/event-status'
import {
  ArrowLeft,
  Calendar,
  Clock,
  MapPin,
  FileText,
  CheckSquare,
  Plus,
  Briefcase,
} from 'lucide-react'

interface EventDetailPageProps {
  params: Promise<{ id: string }>
}

const statusConfig: Record<TaskStatus, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  pending: { label: 'Pendiente', variant: 'secondary' },
  in_progress: { label: 'En progreso', variant: 'default' },
  under_review: { label: 'En revisión', variant: 'secondary' },
  completed: { label: 'Completada', variant: 'outline' },
  cancelled: { label: 'Cancelada', variant: 'destructive' },
}

export default async function CalendarEventDetailPage({ params }: EventDetailPageProps) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('system_role')
    .eq('id', user.id)
    .single()

  if (profile?.system_role === 'client') {
    redirect('/portal')
  }

  const baseSelect = 'id, google_event_id, summary, description, location, start_at, end_at, status'
  let event: {
    id: string
    google_event_id: string
    summary: string | null
    description: string | null
    location: string | null
    start_at: string
    end_at: string
    status: string
    event_kind?: string | null
    preparation_override?: string | null
  } | null = null

  const { data: eventWithCols, error } = await supabase
    .from('google_calendar_events')
    .select(`${baseSelect}, event_kind, preparation_override`)
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (eventWithCols) {
    event = eventWithCols
  } else if (error) {
    const { data: eventBase } = await supabase
      .from('google_calendar_events')
      .select(baseSelect)
      .eq('id', id)
      .eq('user_id', user.id)
      .single()
    event = eventBase ? { ...eventBase, event_kind: null, preparation_override: null } : null
  }

  if (!event) notFound()

  const { data: deadlines } = await supabase
    .from('deadlines')
    .select('id, title, due_date, case:cases(id, case_number, title)')
    .eq('google_calendar_event_id', event.google_event_id)
    .order('due_date', { ascending: true })

  const deadlineIds = (deadlines ?? []).map((d) => d.id)

  const baseTaskSelect = `
      id,
      title,
      description,
      status,
      priority,
      due_date,
      deadline_id,
      created_by,
      assigned_to,
      case:cases(id, case_number, title)
    `

  const { data: directTasksRaw } = await supabase
    .from('tasks')
    .select(baseTaskSelect)
    .neq('status', 'cancelled')
    .eq('google_calendar_event_id', event.google_event_id)

  const { data: deadlineTasksRaw } = deadlineIds.length
    ? await supabase
        .from('tasks')
        .select(baseTaskSelect)
        .neq('status', 'cancelled')
        .in('deadline_id', deadlineIds)
    : { data: [] as unknown[] }

  const mergedMap = new Map<string, unknown>()
  for (const row of directTasksRaw ?? []) mergedMap.set((row as { id: string }).id, row)
  for (const row of deadlineTasksRaw ?? []) mergedMap.set((row as { id: string }).id, row)
  const tasksRaw = Array.from(mergedMap.values())

  const tasks = (tasksRaw ?? []) as Array<{
    id: string
    title: string
    description: string | null
    status: TaskStatus
    priority: string
    due_date: string | null
    deadline_id: string | null
    created_by: string
    assigned_to: string | null
    case: { id: string; case_number: string; title: string } | null
  }>
  tasks.sort((a, b) => {
    const aTime = a.due_date ? new Date(a.due_date).getTime() : Number.MAX_SAFE_INTEGER
    const bTime = b.due_date ? new Date(b.due_date).getTime() : Number.MAX_SAFE_INTEGER
    if (aTime !== bTime) return aTime - bTime
    return a.title.localeCompare(b.title, 'es')
  })

  const taskIds = tasks.map((t) => t.id)
  const { data: commentsRaw } = taskIds.length
    ? await supabase
        .from('task_comments')
        .select(`
          id,
          task_id,
          content,
          created_at,
          updated_at,
          profiles:created_by (
            id,
            first_name,
            last_name
          )
        `)
        .in('task_id', taskIds)
        .order('created_at', { ascending: false })
    : { data: [] as unknown[] }

  const commentsByTask = new Map<string, unknown[]>()
  for (const comment of commentsRaw ?? []) {
    const taskId = (comment as { task_id: string }).task_id
    const list = commentsByTask.get(taskId) ?? []
    list.push(comment)
    commentsByTask.set(taskId, list)
  }

  const firstCaseIdFromTasks = tasks.find((t) => t.case?.id)?.case?.id
  const firstCaseIdFromDeadlines = (deadlines ?? []).reduce<string | null>((acc, deadline) => {
    if (acc) return acc
    const rel = deadline.case as
      | { id?: string }
      | Array<{ id?: string }>
      | null
      | undefined
    if (!rel) return null
    if (Array.isArray(rel)) return rel[0]?.id ?? null
    return rel.id ?? null
  }, null)
  const firstCaseId = firstCaseIdFromTasks ?? firstCaseIdFromDeadlines ?? undefined

  const eventDateStart = new Date(event.start_at)
  const eventDateEnd = new Date(event.end_at)

  const eventStatus = getEventStatus(
    event.start_at,
    tasks.map((t) => ({ status: t.status })),
    event.event_kind ?? undefined,
    event.summary,
    event.description,
    undefined,
    event.preparation_override ?? undefined
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild className="bg-transparent">
            <Link href="/calendario">
              <ArrowLeft className="h-4 w-4" />
              <span className="sr-only">Volver</span>
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {event.summary || 'Evento sin título'}
            </h1>
            <p className="text-sm text-muted-foreground">
              Registro de tareas asociadas al evento
            </p>
          </div>
        </div>
        <Button asChild>
          <Link href={`/tareas/nueva?evento=${encodeURIComponent(event.google_event_id)}${firstCaseId ? `&caso=${firstCaseId}` : ''}`}>
            <Plus className="mr-2 h-4 w-4" />
            Nueva tarea para este evento
          </Link>
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Datos del evento</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              {eventDateStart.toLocaleDateString('es-AR', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-muted-foreground" />
              {eventDateStart.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })} -{' '}
              {eventDateEnd.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
            </div>
            {event.location && (
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                {event.location}
              </div>
            )}
            {event.description && (
              <div className="rounded-md border p-3 text-sm text-muted-foreground whitespace-pre-wrap">
                <div className="mb-1 flex items-center gap-1 text-foreground">
                  <FileText className="h-4 w-4" />
                  Descripción
                </div>
                {event.description}
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{eventKindLabels[eventStatus.eventKind]}</Badge>
              <Badge variant="outline">{temporalStateLabels[eventStatus.temporal]}</Badge>
              <Badge
                variant={
                  eventStatus.preparation === 'listo'
                    ? 'outline'
                    : eventStatus.legalRisk === 'alto'
                      ? 'destructive'
                      : 'secondary'
                }
              >
                {preparationStateLabels[eventStatus.preparation]}
              </Badge>
              {eventStatus.totalCount > 0 && (
                <span className="text-sm text-muted-foreground">
                  Preparación: {eventStatus.completedCount}/{eventStatus.totalCount} ({eventStatus.percentReady}%)
                </span>
              )}
              {eventStatus.legalRisk !== 'ninguno' && eventStatus.legalRisk !== 'bajo' && (
                <Badge variant={eventStatus.legalRisk === 'alto' ? 'destructive' : 'outline'}>
                  {legalRiskLabels[eventStatus.legalRisk]}
                </Badge>
              )}
              <Badge variant="outline">
                {event.status === 'confirmed' ? 'Confirmado' : event.status}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckSquare className="h-5 w-5" />
              Tareas asociadas ({tasks.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {tasks.length === 0 ? (
              <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
                No hay tareas asociadas a este evento todavía.
              </div>
            ) : (
              tasks.map((task) => {
                const status = statusConfig[task.status]
                const isCompleted = task.status === 'completed'
                const canEditTask =
                  user.id === task.created_by ||
                  user.id === task.assigned_to ||
                  profile?.system_role === 'admin_general'

                return (
                  <div key={task.id} className="rounded-lg border p-4 space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Link href={`/tareas/${task.id}`} className="font-medium hover:text-primary">
                            {task.title}
                          </Link>
                          <Badge variant={status.variant}>{status.label}</Badge>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          {task.case && (
                            <span className="flex items-center gap-1">
                              <Briefcase className="h-3.5 w-3.5" />
                              {task.case.case_number}
                            </span>
                          )}
                          {task.due_date && (
                            <span>
                              Vence {new Date(task.due_date).toLocaleDateString('es-AR')}
                            </span>
                          )}
                          <span>{isCompleted ? 'Completada' : 'Pendiente'}</span>
                        </div>
                        {task.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2">{task.description}</p>
                        )}
                      </div>
                    </div>

                    {canEditTask && (
                      <>
                        <TaskStatusActions
                          taskId={task.id}
                          currentStatus={task.status}
                          taskTitle={task.title}
                          caseId={task.case?.id}
                        />
                        <Separator />
                      </>
                    )}

                    <TaskComments
                      taskId={task.id}
                      currentUserId={user.id}
                      canComment={true}
                      initialComments={
                        (commentsByTask.get(task.id) ?? []) as Array<{
                          id: string
                          task_id: string
                          content: string
                          created_at: string
                          updated_at: string
                          profiles:
                            | { id: string; first_name: string; last_name: string }
                            | Array<{ id: string; first_name: string; last_name: string }>
                            | null
                        }>
                      }
                    />
                  </div>
                )
              })
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
