/**
 * Task Detail Page
 * 
 * Displays detailed task information with:
 * - Status management
 * - Edit capabilities
 * - Activity history
 * - Quick actions
 */
import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  ArrowLeft,
  CheckSquare,
  Clock,
  User,
  Briefcase,
  Calendar,
  Flag,
  Edit,
  Trash2,
  Play,
  Check,
  AlertTriangle,
  MessageSquare,
} from 'lucide-react'
import { TaskStatusActions } from '@/components/tasks/task-status-actions'
import type { TaskStatus, TaskPriority } from '@/lib/types'

export const metadata = {
  title: 'Detalle de Tarea',
  description: 'Ver y gestionar tarea',
}

interface TaskDetailPageProps {
  params: Promise<{ id: string }>
}

/** Status configuration */
const statusConfig: Record<TaskStatus, { 
  label: string
  variant: 'default' | 'secondary' | 'outline' | 'destructive'
  icon: typeof Clock
}> = {
  pending: { label: 'Pendiente', variant: 'secondary', icon: Clock },
  in_progress: { label: 'En Progreso', variant: 'default', icon: Play },
  completed: { label: 'Completada', variant: 'outline', icon: Check },
  cancelled: { label: 'Cancelada', variant: 'destructive', icon: AlertTriangle },
}

/** Priority configuration */
const priorityConfig: Record<TaskPriority, { 
  label: string
  color: string
}> = {
  low: { label: 'Baja', color: 'text-muted-foreground' },
  medium: { label: 'Media', color: 'text-chart-2' },
  high: { label: 'Alta', color: 'text-warning' },
  urgent: { label: 'Urgente', color: 'text-destructive' },
}

export default async function TaskDetailPage({ params }: TaskDetailPageProps) {
  const { id } = await params
  const supabase = await createClient()
  
  // Validate user access
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('system_role')
    .eq('id', user.id)
    .single()

  if (profile?.system_role === 'client') {
    redirect('/portal')
  }

  // Fetch task with relations
  const { data: task, error } = await supabase
    .from('tasks')
    .select(`
      *,
      case:cases(id, case_number, title),
      assignee:profiles!tasks_assigned_to_fkey(id, first_name, last_name, email),
      creator:profiles!tasks_created_by_fkey(id, first_name, last_name)
    `)
    .eq('id', id)
    .single()

  if (error || !task) {
    notFound()
  }

  // Type assertions for relations
  const caseData = task.case as { 
    id: string
    case_number: string
    title: string
  } | null
  
  const assignee = task.assignee as { 
    id: string
    first_name: string
    last_name: string
    email: string
  } | null
  
  const creator = task.creator as { 
    id: string
    first_name: string
    last_name: string
  } | null

  const status = statusConfig[task.status as TaskStatus]
  const priority = priorityConfig[task.priority as TaskPriority]
  const StatusIcon = status.icon

  // Check if user can edit (creator or assignee)
  const canEdit = user.id === task.created_by || 
                  user.id === task.assigned_to || 
                  profile?.system_role === 'admin_general'

  // Calculate due date info
  function getDueDateInfo(dateString: string | null): { 
    text: string
    subtext: string
    isOverdue: boolean 
    isUrgent: boolean 
  } {
    if (!dateString) return { text: 'Sin fecha', subtext: '', isOverdue: false, isUrgent: false }

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const dueDate = new Date(dateString)
    dueDate.setHours(0, 0, 0, 0)

    const diffDays = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    const formattedDate = dueDate.toLocaleDateString('es-AR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })

    if (diffDays < 0) {
      return { 
        text: formattedDate, 
        subtext: `Vencida hace ${Math.abs(diffDays)} día${Math.abs(diffDays) > 1 ? 's' : ''}`, 
        isOverdue: true, 
        isUrgent: true 
      }
    }
    if (diffDays === 0) {
      return { text: formattedDate, subtext: 'Vence hoy', isOverdue: false, isUrgent: true }
    }
    if (diffDays === 1) {
      return { text: formattedDate, subtext: 'Vence mañana', isOverdue: false, isUrgent: true }
    }
    if (diffDays <= 3) {
      return { text: formattedDate, subtext: `Vence en ${diffDays} días`, isOverdue: false, isUrgent: true }
    }

    return { 
      text: formattedDate, 
      subtext: `Vence en ${diffDays} días`, 
      isOverdue: false, 
      isUrgent: false 
    }
  }

  const dueDateInfo = getDueDateInfo(task.due_date)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild className="bg-transparent">
            <Link href="/tareas">
              <ArrowLeft className="h-4 w-4" />
              <span className="sr-only">Volver</span>
            </Link>
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                {task.title}
              </h1>
              <Badge variant={status.variant} className="gap-1">
                <StatusIcon className="h-3 w-3" />
                {status.label}
              </Badge>
            </div>
            {caseData && (
              <Link 
                href={`/casos/${caseData.id}`}
                className="text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                {caseData.case_number} · {caseData.title}
              </Link>
            )}
          </div>
        </div>

        {/* Actions */}
        {canEdit && (
          <div className="flex items-center gap-2 flex-wrap">
            <TaskStatusActions 
              taskId={task.id} 
              currentStatus={task.status as TaskStatus} 
            />
            <Separator orientation="vertical" className="h-8" />
            <Button variant="outline" size="sm" asChild className="bg-transparent">
              <Link href={`/tareas/${task.id}/editar`}>
                <Edit className="mr-2 h-4 w-4" />
                Editar
              </Link>
            </Button>
            <Button variant="outline" size="sm" className="bg-transparent text-destructive hover:text-destructive">
              <Trash2 className="mr-2 h-4 w-4" />
              Eliminar
            </Button>
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <MessageSquare className="h-5 w-5" />
                Descripción
              </CardTitle>
            </CardHeader>
            <CardContent>
              {task.description ? (
                <p className="text-sm text-foreground whitespace-pre-wrap">
                  {task.description}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  Sin descripción
                </p>
              )}
            </CardContent>
          </Card>

          {/* Activity / Timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock className="h-5 w-5" />
                Actividad
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Created event */}
                <div className="flex gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                    <CheckSquare className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm text-foreground">
                      <span className="font-medium">
                        {creator ? `${creator.first_name} ${creator.last_name}` : 'Usuario'}
                      </span>
                      {' '}creó esta tarea
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(task.created_at).toLocaleDateString('es-AR', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>

                {/* Status change indicator */}
                {task.status !== 'pending' && (
                  <div className="flex gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                      <StatusIcon className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm text-foreground">
                        Estado cambiado a <span className="font-medium">{status.label}</span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(task.updated_at).toLocaleDateString('es-AR', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Due Date */}
          <Card className={dueDateInfo.isOverdue ? 'border-destructive' : dueDateInfo.isUrgent ? 'border-warning' : ''}>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Calendar className="h-5 w-5" />
                Fecha de Vencimiento
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className={`text-sm font-medium capitalize ${
                dueDateInfo.isOverdue ? 'text-destructive' : 'text-foreground'
              }`}>
                {dueDateInfo.text}
              </p>
              {dueDateInfo.subtext && (
                <p className={`text-xs mt-1 ${
                  dueDateInfo.isOverdue ? 'text-destructive' : 
                  dueDateInfo.isUrgent ? 'text-warning' : 'text-muted-foreground'
                }`}>
                  {dueDateInfo.subtext}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Priority */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Flag className="h-5 w-5" />
                Prioridad
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className={`text-sm font-medium ${priority.color}`}>
                {priority.label}
              </p>
            </CardContent>
          </Card>

          {/* Assignment */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <User className="h-5 w-5" />
                Asignación
              </CardTitle>
            </CardHeader>
            <CardContent>
              {assignee ? (
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-medium">
                    {assignee.first_name[0]}{assignee.last_name[0]}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {assignee.first_name} {assignee.last_name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {assignee.email}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Sin asignar</p>
              )}
            </CardContent>
          </Card>

          {/* Case */}
          {caseData && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Briefcase className="h-5 w-5" />
                  Caso Vinculado
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Link 
                  href={`/casos/${caseData.id}`}
                  className="block rounded-lg border border-border p-3 hover:bg-muted/50 transition-colors"
                >
                  <p className="text-sm font-medium text-primary">
                    {caseData.case_number}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                    {caseData.title}
                  </p>

                </Link>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
