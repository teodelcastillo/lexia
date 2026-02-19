/**
 * Tasks List Page
 * 
 * Main view for managing tasks across all cases.
 */
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getCurrentUserOrganizationId } from '@/lib/utils/organization'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Plus, 
  Search, 
  CheckSquare,
  Clock,
  AlertTriangle,
} from 'lucide-react'
import type { TaskStatus, TaskPriority } from '@/lib/types'

export const metadata = {
  title: 'Tareas',
  description: 'Gestión de tareas',
}

interface TasksPageProps {
  searchParams: Promise<{
    search?: string
    status?: string
    page?: string
  }>
}

const ITEMS_PER_PAGE = 20

/**
 * Status configuration
 */
const statusConfig: Record<TaskStatus, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
  pending: { label: 'Pendiente', variant: 'secondary' },
  in_progress: { label: 'En Progreso', variant: 'default' },
  under_review: { label: 'En Revisión', variant: 'secondary' },
  completed: { label: 'Completada', variant: 'outline' },
  cancelled: { label: 'Cancelada', variant: 'outline' },
}

/**
 * Priority colors
 */
const priorityColors: Record<TaskPriority, string> = {
  low: 'border-l-muted-foreground/30',
  medium: 'border-l-chart-2',
  high: 'border-l-warning',
  urgent: 'border-l-destructive',
}

/**
 * Validates user access
 */
async function validateAccess() {
  const supabase = await createClient()
  
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

  return { user, profile }
}

/**
 * Fetches tasks for the current user with pagination and organization filter
 */
async function getTasks(
  userId: string, 
  organizationId: string | null,
  search?: string, 
  status?: string,
  page: number = 1,
  limit: number = ITEMS_PER_PAGE
) {
  const supabase = await createClient()
  const offset = (page - 1) * limit

  let query = supabase
    .from('tasks')
    .select(`
      id,
      title,
      description,
      status,
      priority,
      due_date,
      created_at,
      cases (
        id,
        case_number,
        title
      ),
      assignee:profiles!assigned_to (
        id,
        first_name,
        last_name
      )
    `, { count: 'exact' })
    .or(`assigned_to.eq.${userId},created_by.eq.${userId}`)
    .order('due_date', { ascending: true, nullsFirst: false })
    .order('priority', { ascending: false })
    .range(offset, offset + limit - 1)

  // Add organization filter for defense in depth
  if (organizationId) {
    query = query.eq('organization_id', organizationId)
  }

  if (search) {
    query = query.ilike('title', `%${search}%`)
  }

  if (status && status !== 'all') {
    if (status === 'active') {
      query = query.in('status', ['pending', 'in_progress'])
    } else {
      query = query.eq('status', status)
    }
  }

  const { data: tasksRaw, count, error } = await query

  if (error) {
    console.error('Error fetching tasks:', error)
    return { tasks: [], total: 0, totalPages: 0 }
  }

  const raw = tasksRaw ?? []
  type Row = (typeof raw)[number]
  const tasks = raw.map((row: Row) => {
    const casesRel = row.cases
    const assigneeRel = row.assignee
    const caseData = Array.isArray(casesRel) ? casesRel[0] ?? null : casesRel ?? null
    const assigneeData = Array.isArray(assigneeRel) ? assigneeRel[0] ?? null : assigneeRel ?? null
    return { ...row, cases: caseData, assignee: assigneeData }
  })

  return {
    tasks,
    total: count || 0,
    totalPages: Math.ceil((count || 0) / limit),
  }
}

/**
 * Formats due date
 */
function formatDueDate(dateString: string | null): { text: string; isOverdue: boolean; isUrgent: boolean } {
  if (!dateString) return { text: 'Sin fecha', isOverdue: false, isUrgent: false }

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const dueDate = new Date(dateString)
  dueDate.setHours(0, 0, 0, 0)

  const diffDays = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays < 0) return { text: `Vencida hace ${Math.abs(diffDays)} días`, isOverdue: true, isUrgent: true }
  if (diffDays === 0) return { text: 'Hoy', isOverdue: false, isUrgent: true }
  if (diffDays === 1) return { text: 'Mañana', isOverdue: false, isUrgent: true }
  if (diffDays <= 3) return { text: `En ${diffDays} días`, isOverdue: false, isUrgent: true }

  return {
    text: dueDate.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }),
    isOverdue: false,
    isUrgent: false,
  }
}

export default async function TasksPage({ searchParams }: TasksPageProps) {
  const { user } = await validateAccess()
  const organizationId = await getCurrentUserOrganizationId()
  const params = await searchParams
  const page = params.page ? parseInt(params.page) : 1
  
  const { tasks, total, totalPages } = await getTasks(
    user.id, 
    organizationId,
    params.search, 
    params.status,
    page,
    ITEMS_PER_PAGE
  )

  // Group tasks
  const pendingTasks = tasks.filter(t => t.status === 'pending')
  const inProgressTasks = tasks.filter(t => t.status === 'in_progress')
  const completedTasks = tasks.filter(t => t.status === 'completed')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Tareas
          </h1>
          <p className="text-sm text-muted-foreground">
            Gestione sus tareas y las de su equipo
          </p>
        </div>
        
        <Button asChild>
          <Link href="/tareas/nueva">
            <Plus className="mr-2 h-4 w-4" />
            Nueva Tarea
          </Link>
        </Button>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-border/60">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/10">
              <Clock className="h-5 w-5 text-warning" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{pendingTasks.length}</p>
              <p className="text-xs text-muted-foreground">Pendientes</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <AlertTriangle className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{inProgressTasks.length}</p>
              <p className="text-xs text-muted-foreground">En Progreso</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
              <CheckSquare className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{completedTasks.length}</p>
              <p className="text-xs text-muted-foreground">Completadas</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <form className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            name="search"
            placeholder="Buscar tareas..."
            className="pl-9"
            defaultValue={params.search}
          />
        </div>
        <Button type="submit" variant="secondary">
          Buscar
        </Button>
      </form>

      {/* Tasks by Status */}
      <Tabs defaultValue="active" className="space-y-4">
        <TabsList>
          <TabsTrigger value="active">
            Activas ({pendingTasks.length + inProgressTasks.length})
          </TabsTrigger>
          <TabsTrigger value="completed">
            Completadas ({completedTasks.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active">
            {pendingTasks.length === 0 && inProgressTasks.length === 0 ? (
              <EmptyTasksState />
            ) : (
              <div className="space-y-6">
                {/* In Progress */}
                {inProgressTasks.length > 0 && (
                  <TaskSection title="En Progreso" tasks={inProgressTasks} />
                )}
                
                {/* Pending */}
                {pendingTasks.length > 0 && (
                  <TaskSection title="Pendientes" tasks={pendingTasks} />
                )}
              </div>
            )}
        </TabsContent>

        <TabsContent value="completed">
            {completedTasks.length === 0 ? (
              <EmptyTasksState completed />
            ) : (
              <TaskSection title="Completadas" tasks={completedTasks} isCompleted />
            )}
        </TabsContent>
      </Tabs>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Mostrando {tasks.length} de {total} tareas · Página {page} de {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              asChild={page > 1}
            >
              {page > 1 ? (
                <Link 
                  href={`/tareas?page=${page - 1}${params.status ? `&status=${params.status}` : ''}${params.search ? `&search=${params.search}` : ''}`}
                >
                  Anterior
                </Link>
              ) : (
                'Anterior'
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              asChild={page < totalPages}
            >
              {page < totalPages ? (
                <Link 
                  href={`/tareas?page=${page + 1}${params.status ? `&status=${params.status}` : ''}${params.search ? `&search=${params.search}` : ''}`}
                >
                  Siguiente
                </Link>
              ) : (
                'Siguiente'
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Task section component
 */
interface TaskSectionProps {
  title: string
  tasks: Array<{
    id: string
    title: string
    status: string
    priority: string
    due_date: string | null
    cases: { id: string; case_number: string; title: string } | null
    assignee: { id: string; first_name: string; last_name: string } | null
  }>
  isCompleted?: boolean
}

function TaskSection({ title, tasks, isCompleted }: TaskSectionProps) {
  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title} ({tasks.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {tasks.map((task) => {
          const caseData = task.cases as { id: string; case_number: string; title: string } | null
          const assignee = task.assignee as { id: string; first_name: string; last_name: string } | null
          const status = statusConfig[task.status as TaskStatus]
          const { text: dueDateText, isOverdue, isUrgent } = formatDueDate(task.due_date)

          return (
            <Link
              key={task.id}
              href={`/tareas/${task.id}`}
              className={`flex items-start gap-3 rounded-md border-l-2 p-3 transition-colors hover:bg-muted/50 ${
                isCompleted ? 'opacity-60' : priorityColors[task.priority as TaskPriority]
              }`}
            >
              <Checkbox
                checked={isCompleted}
                className="mt-0.5"
                disabled
              />
              <div className="flex-1 space-y-1 min-w-0">
                <p className={`text-sm font-medium text-foreground ${isCompleted ? 'line-through' : ''}`}>
                  {task.title}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={status.variant} className="h-5 text-[10px]">
                    {status.label}
                  </Badge>
                  {!isCompleted && (
                    <span className={`text-xs ${isOverdue ? 'font-medium text-destructive' : isUrgent ? 'text-warning' : 'text-muted-foreground'}`}>
                      {dueDateText}
                    </span>
                  )}
                  {assignee && (
                    <span className="text-xs text-muted-foreground">
                      {assignee.first_name} {assignee.last_name}
                    </span>
                  )}
                </div>
                {caseData && (
                  <p className="text-xs text-muted-foreground truncate">
                    {caseData.case_number} · {caseData.title}
                  </p>
                )}
              </div>
            </Link>
          )
        })}
      </CardContent>
    </Card>
  )
}

/**
 * Empty state component
 */
function EmptyTasksState({ completed }: { completed?: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16">
      <CheckSquare className="mb-4 h-12 w-12 text-muted-foreground/50" />
      <h3 className="text-lg font-medium text-foreground">
        {completed ? 'No hay tareas completadas' : 'No hay tareas pendientes'}
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">
        {completed ? 'Las tareas completadas aparecerán aquí' : '¡Excelente! No tiene tareas pendientes'}
      </p>
    </div>
  )
}
