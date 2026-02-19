/**
 * Lawyer/Assistant Dashboard Component
 * 
 * Personal workspace dashboard showing:
 * - Personal task list with priorities
 * - Upcoming deadlines assigned to the user
 * - Cases where the user is assigned
 * - Quick access to daily workflow actions
 */
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUserOrganizationId } from '@/lib/utils/organization'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  ArrowRight,
  Briefcase,
  CheckSquare,
  Clock,
  AlertTriangle,
  Calendar,
  FileText,
  CheckCircle2,
  Circle,
  Timer,
} from 'lucide-react'
import type { CaseStatus, TaskStatus, TaskPriority } from '@/lib/types'

interface LawyerDashboardProps {
  userId: string
}

/**
 * Task priority configuration
 */
const taskPriorityConfig: Record<TaskPriority, { label: string; color: string; bgColor: string }> = {
  low: { label: 'Baja', color: 'text-muted-foreground', bgColor: 'border-l-muted-foreground/30' },
  medium: { label: 'Media', color: 'text-chart-2', bgColor: 'border-l-chart-2' },
  high: { label: 'Alta', color: 'text-warning', bgColor: 'border-l-warning' },
  urgent: { label: 'Urgente', color: 'text-destructive', bgColor: 'border-l-destructive' },
}

/**
 * Task status configuration
 */
const taskStatusConfig: Record<TaskStatus, { label: string; icon: typeof Circle }> = {
  pending: { label: 'Pendiente', icon: Circle },
  in_progress: { label: 'En Progreso', icon: Timer },
  under_review: { label: 'En Revisión', icon: Circle },
  completed: { label: 'Completada', icon: CheckCircle2 },
  cancelled: { label: 'Cancelada', icon: Circle },
}

/**
 * Case status configuration
 */
const caseStatusConfig: Record<CaseStatus, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
  active: { label: 'Activo', variant: 'default' },
  pending: { label: 'Pendiente', variant: 'secondary' },
  on_hold: { label: 'En Espera', variant: 'outline' },
  closed: { label: 'Cerrado', variant: 'secondary' },
  archived: { label: 'Archivado', variant: 'outline' },
}

/**
 * Fetches personal statistics for the user
 */
async function getPersonalStats(userId: string, organizationId: string | null) {
  const supabase = await createClient()

  const today = new Date().toISOString().split('T')[0]
  const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  // Build queries with organization filter
  const buildQuery = (table: string, baseQuery: any) => {
    if (organizationId) {
      return baseQuery.eq('organization_id', organizationId)
    }
    return baseQuery
  }

  const [
    { count: pendingTasks },
    { count: inProgressTasks },
    { count: completedToday },
    { count: overdueTasks },
    { count: assignedCases },
    { count: upcomingDeadlines },
  ] = await Promise.all([
    // Pending tasks assigned to user
    buildQuery('tasks', supabase.from('tasks').select('*', { count: 'exact', head: true })
      .eq('assigned_to', userId)
      .eq('status', 'pending')),
    // In progress tasks
    buildQuery('tasks', supabase.from('tasks').select('*', { count: 'exact', head: true })
      .eq('assigned_to', userId)
      .eq('status', 'in_progress')),
    // Completed today
    buildQuery('tasks', supabase.from('tasks').select('*', { count: 'exact', head: true })
      .eq('assigned_to', userId)
      .eq('status', 'completed')
      .gte('completed_at', today)),
    // Overdue tasks
    buildQuery('tasks', supabase.from('tasks').select('*', { count: 'exact', head: true })
      .eq('assigned_to', userId)
      .in('status', ['pending', 'in_progress'])
      .lt('due_date', today)),
    // Cases assigned to user (filtered by organization via case_assignments)
    buildQuery('case_assignments', supabase.from('case_assignments').select('*', { count: 'exact', head: true })
      .eq('user_id', userId)),
    // Upcoming deadlines in assigned cases
    buildQuery('deadlines', supabase.from('deadlines').select(`
      id,
      case_id,
      cases!inner (
        case_assignments!inner (user_id)
      )
    `, { count: 'exact', head: true })
      .eq('is_completed', false)
      .gte('due_date', today)
      .lte('due_date', nextWeek)
      .eq('cases.case_assignments.user_id', userId)),
  ])

  return {
    pendingTasks: pendingTasks || 0,
    inProgressTasks: inProgressTasks || 0,
    completedToday: completedToday || 0,
    overdueTasks: overdueTasks || 0,
    assignedCases: assignedCases || 0,
    upcomingDeadlines: upcomingDeadlines || 0,
  }
}

/**
 * Fetches user's personal task list
 */
async function getMyTasks(userId: string, organizationId: string | null) {
  const supabase = await createClient()

  const query = supabase
    .from('tasks')
    .select(`
      id,
      title,
      status,
      due_date,
      cases (id, case_number, title)
    `)
    .eq('assigned_to', userId)
    .in('status', ['pending', 'in_progress'])
    .order('due_date', { ascending: true, nullsFirst: false })
    .limit(8)

  // Add organization filter for defense in depth
  if (organizationId) {
    query.eq('organization_id', organizationId)
  }

  const { data: tasks } = await query

  return tasks || []
}

/**
 * Fetches user's assigned cases
 */
async function getMyCases(userId: string, organizationId: string | null) {
  const supabase = await createClient()

  // Get case IDs where user is assigned
  const { data: assignments } = await supabase
    .from('case_assignments')
    .select('case_id, case_role')
    .eq('user_id', userId)

  if (!assignments || assignments.length === 0) return []

  const caseIds = assignments.map(a => a.case_id)
  const roleMap = new Map(assignments.map(a => [a.case_id, a.case_role]))

  const query = supabase
    .from('cases')
    .select(`
      id,
      case_number,
      title,
      status,
      companies (id, company_name)
    `)
    .in('id', caseIds)
    .in('status', ['active', 'pending'])
    .order('updated_at', { ascending: false })
    .limit(6)

  // Add organization filter for defense in depth
  if (organizationId) {
    query.eq('organization_id', organizationId)
  }

  const { data: cases } = await query

  return (cases || []).map(c => ({
    ...c,
    role: roleMap.get(c.id) || 'case_leader',
  }))
}

/**
 * Fetches upcoming deadlines for user's cases
 */
async function getMyDeadlines(userId: string, organizationId: string | null) {
  const supabase = await createClient()

  // Get case IDs where user is assigned
  const { data: assignments } = await supabase
    .from('case_assignments')
    .select('case_id')
    .eq('user_id', userId)

  if (!assignments || assignments.length === 0) return []

  const caseIds = assignments.map(a => a.case_id)
  const today = new Date().toISOString().split('T')[0]
  const twoWeeks = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  const query = supabase
    .from('deadlines')
    .select(`
      id,
      title,
      deadline_type,
      due_date,
      cases (id, case_number, title)
    `)
    .in('case_id', caseIds)
    .eq('is_completed', false)
    .gte('due_date', today)
    .lte('due_date', twoWeeks)
    .order('due_date', { ascending: true })
    .limit(5)

  // Add organization filter for defense in depth
  if (organizationId) {
    query.eq('organization_id', organizationId)
  }

  const { data: deadlines } = await query

  return deadlines || []
}

/**
 * Calculate days until or since a date
 */
function getDaysUntil(dateString: string | null): { days: number; text: string; isOverdue: boolean } {
  if (!dateString) return { days: 999, text: 'Sin fecha', isOverdue: false }

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const date = new Date(dateString)
  date.setHours(0, 0, 0, 0)
  const days = Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

  if (days < 0) return { days, text: `Vencido hace ${Math.abs(days)}d`, isOverdue: true }
  if (days === 0) return { days, text: 'Hoy', isOverdue: false }
  if (days === 1) return { days, text: 'Mañana', isOverdue: false }
  if (days <= 7) return { days, text: `En ${days} días`, isOverdue: false }

  return {
    days,
    text: date.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }),
    isOverdue: false,
  }
}

export async function LawyerDashboard({ userId }: LawyerDashboardProps) {
  const organizationId = await getCurrentUserOrganizationId()
  
  const [stats, myTasks, myCases, myDeadlines] = await Promise.all([
    getPersonalStats(userId, organizationId),
    getMyTasks(userId, organizationId),
    getMyCases(userId, organizationId),
    getMyDeadlines(userId, organizationId),
  ])

  const totalActiveTasks = stats.pendingTasks + stats.inProgressTasks

  return (
    <div className="space-y-6">
      {/* Personal Stats Row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Active Tasks */}
        <Card className="border-border/60">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Tareas Activas
            </CardTitle>
            <CheckSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold">{totalActiveTasks}</span>
              {stats.overdueTasks > 0 && (
                <Badge variant="destructive" className="text-[10px]">
                  {stats.overdueTasks} vencidas
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats.pendingTasks} pendientes · {stats.inProgressTasks} en curso
            </p>
          </CardContent>
        </Card>

        {/* Completed Today */}
        <Card className="border-border/60">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Completadas Hoy
            </CardTitle>
            <CheckCircle2 className="h-4 w-4 text-chart-2" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-chart-2">{stats.completedToday}</div>
            <p className="text-xs text-muted-foreground">
              tareas finalizadas
            </p>
          </CardContent>
        </Card>

        {/* Assigned Cases */}
        <Card className="border-border/60">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Casos Asignados
            </CardTitle>
            <Briefcase className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.assignedCases}</div>
            <p className="text-xs text-muted-foreground">
              casos activos
            </p>
          </CardContent>
        </Card>

        {/* Upcoming Deadlines */}
        <Card className="border-border/60">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Vencimientos (7 días)
            </CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.upcomingDeadlines}</div>
            <p className="text-xs text-muted-foreground">
              próximos vencimientos
            </p>
          </CardContent>
        </Card>
      </div>

 {/* Main Content Grid */}
<div className="grid gap-6 lg:grid-cols-5">
  {/* Left Column - Task List (takes more space) */}
  <div className="lg:col-span-3">
    <Card className="border-border/60 h-full">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base font-semibold">Mi Lista de Tareas</CardTitle>
          <CardDescription>Tareas pendientes y en progreso</CardDescription>
        </div>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/tareas?assigned=me" className="text-xs">
            Ver todas
            <ArrowRight className="ml-1 h-3 w-3" />
          </Link>
        </Button>
      </CardHeader>

      <CardContent>
        {myTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <CheckSquare className="mb-3 h-10 w-10 text-muted-foreground/50" />
            <p className="text-sm font-medium text-foreground">No tiene tareas pendientes</p>
            <p className="text-xs text-muted-foreground mt-1">
              ¡Buen trabajo! Todas las tareas están al día.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {myTasks.map((task) => {
              const c = task.cases
              const caseData = (Array.isArray(c) ? c[0] ?? null : c ?? null) as {
                id: string
                case_number: string
                title: string
              } | null

              // Si querés usar el icono según status, usalo; si no, borrá estas 2 líneas para evitar "unused"
              // const status = taskStatusConfig[task.status as TaskStatus]
              // const StatusIcon = status.icon

              const dueInfo = getDaysUntil(task.due_date)

              return (
                <Link
                  key={task.id}
                  href={`/tareas/${task.id}`}
                  className="flex items-start gap-3 rounded-md border-l-2 p-3 transition-colors hover:bg-muted/50 border-l-muted-foreground/30"
                >
                  {/* Status checkbox/indicator */}
                  <div className="mt-0.5">
                    {task.status === "in_progress" ? (
                      <Timer className="h-4 w-4 text-chart-1" />
                    ) : (
                      <Checkbox checked={false} disabled className="rounded-full" />
                    )}
                  </div>

                  {/* Task content */}
                  <div className="flex-1 min-w-0 space-y-1">
                    <p className="text-sm font-medium text-foreground line-clamp-1">{task.title}</p>

                    <div className="flex flex-wrap items-center gap-2">
                      {task.status === "in_progress" && (
                        <Badge variant="default" className="h-5 text-[10px]">
                          En Progreso
                        </Badge>
                      )}

                      {caseData && (
                        <span className="text-xs text-muted-foreground">{caseData.case_number}</span>
                      )}
                    </div>
                  </div>

                  {/* Due date */}
                  <div
                    className={`text-right ${
                      dueInfo.isOverdue ? "text-destructive" : "text-muted-foreground"
                    }`}
                  >
                    <p
                      className={`text-xs ${
                        dueInfo.isOverdue || dueInfo.days <= 2 ? "font-medium" : ""
                      }`}
                    >
                      {dueInfo.text}
                    </p>
                    {dueInfo.isOverdue && <AlertTriangle className="h-3 w-3 inline ml-1" />}
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  </div>

  {/* Right Column - Cases & Deadlines */}
  <div className="space-y-6 lg:col-span-2">
    {/* My Cases */}
    <Card className="border-border/60">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base font-semibold">Mis Casos</CardTitle>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/casos?assigned=me" className="text-xs">
            Ver todos
            <ArrowRight className="ml-1 h-3 w-3" />
          </Link>
        </Button>
      </CardHeader>

      <CardContent>
        {myCases.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <Briefcase className="mb-2 h-6 w-6 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">No tiene casos asignados</p>
          </div>
        ) : (
          <div className="space-y-3">
            {myCases.slice(0, 4).map((caseItem) => {
              const co = caseItem.companies
              const company = (Array.isArray(co) ? co[0] ?? null : co ?? null) as {
                id: string
                company_name: string | null
                name: string | null
              } | null

              // const status = caseStatusConfig[caseItem.status as CaseStatus] // si no lo usás, borrarlo

              return (
                <Link
                  key={caseItem.id}
                  href={`/casos/${caseItem.id}`}
                  className="flex items-start gap-3 rounded-md p-2 transition-colors hover:bg-muted/50"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{caseItem.case_number}</span>
                      <Badge variant="outline" className="h-4 text-[9px]">
                        {caseItem.role === "leader"
                          ? "Líder"
                          : caseItem.role === "case_leader"
                            ? "Abogado"
                            : "Asistente"}
                      </Badge>
                    </div>

                    <p className="text-sm font-medium text-foreground truncate">{caseItem.title}</p>

                    <p className="text-xs text-muted-foreground truncate">
                      {company?.company_name || company?.name || "Sin empresa"}
                    </p>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>

    {/* Upcoming Deadlines */}
    <Card className="border-border/60">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base font-semibold">Próximos Vencimientos</CardTitle>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/vencimientos" className="text-xs">
            Ver todos
            <ArrowRight className="ml-1 h-3 w-3" />
          </Link>
        </Button>
      </CardHeader>

      <CardContent>
        {myDeadlines.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <Calendar className="mb-2 h-6 w-6 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">No hay vencimientos próximos</p>
          </div>
        ) : (
          <div className="space-y-3">
            {myDeadlines.map((deadline) => {
              const c = deadline.cases
              const caseData = (Array.isArray(c) ? c[0] ?? null : c ?? null) as {
                id: string
                case_number: string
                title: string
              } | null

              const daysUntil = getDaysUntil(deadline.due_date).days
              const isUrgent = daysUntil <= 2

              return (
                <div
                  key={deadline.id}
                  className={`rounded-md border p-3 ${
                    isUrgent ? "border-destructive/50 bg-destructive/5" : "border-border"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground line-clamp-1">
                        {deadline.title}
                      </p>
                      <p className="text-xs text-muted-foreground">{caseData?.case_number}</p>
                    </div>

                    <div
                      className={`text-right ${
                        isUrgent ? "text-destructive" : "text-muted-foreground"
                      }`}
                    >
                      <p className="text-xs font-medium">
                        {new Date(deadline.due_date).toLocaleDateString("es-AR", {
                          day: "numeric",
                          month: "short",
                        })}
                      </p>
                    </div>
                  </div>

                  {isUrgent && (
                    <div className="mt-2 flex items-center gap-1 text-destructive">
                      <AlertTriangle className="h-3 w-3" />
                      <span className="text-[10px] font-medium">
                        {daysUntil === 0
                          ? "Hoy"
                          : daysUntil === 1
                            ? "Mañana"
                            : `En ${daysUntil} días`}
                      </span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  </div>
      </div>  
    </div>    
  )
}
