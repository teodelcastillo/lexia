/**
 * Case Leader Dashboard Component
 * 
 * Dashboard for users who lead cases, showing:
 * - Overview of cases they lead
 * - Upcoming deadlines for their cases
 * - Team task status and assignment overview
 * - Quick actions for case management
 */
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUserOrganizationId } from '@/lib/utils/organization'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Progress } from '@/components/ui/progress'
import {
  ArrowRight,
  Briefcase,
  CheckSquare,
  Clock,
  AlertTriangle,
  Calendar,
  Users,
  FileText,
  Plus,
} from 'lucide-react'
import type { CaseStatus, TaskPriority, TaskStatus } from '@/lib/types'

interface LeaderDashboardProps {
  userId: string
}

/**
 * Status configuration for cases
 */
const caseStatusConfig: Record<CaseStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  active: { label: 'Activo', variant: 'default' },
  pending: { label: 'Pendiente', variant: 'secondary' },
  on_hold: { label: 'En Espera', variant: 'outline' },
  closed: { label: 'Cerrado', variant: 'secondary' },
  archived: { label: 'Archivado', variant: 'outline' },
}

/**
 * Task status configuration
 */
const taskStatusConfig: Record<TaskStatus, { label: string; color: string }> = {
  pending: { label: 'Pendiente', color: 'text-muted-foreground' },
  in_progress: { label: 'En Progreso', color: 'text-chart-1' },
  under_review: { label: 'En Revisión', color: 'text-warning' },
  completed: { label: 'Completada', color: 'text-chart-2' },
  cancelled: { label: 'Cancelada', color: 'text-muted-foreground' },
}

/**
 * Fetches cases where the user is a leader
 */
async function getLeadCases(userId: string, organizationId: string | null) {
  const supabase = await createClient()

  // Get case IDs where user is leader
  const { data: assignments } = await supabase
    .from('case_assignments')
    .select('case_id')
    .eq('user_id', userId)
    .eq('case_role', 'leader')

  if (!assignments || assignments.length === 0) return []

  const caseIds = assignments.map(a => a.case_id)

  // Get case details with organization filter
  const query = supabase
    .from('cases')
    .select(`
      id,
      case_number,
      title,
      status,
      updated_at,
      companies (id, company_name, name)
    `)
    .in('id', caseIds)
    .in('status', ['active', 'pending', 'on_hold'])
    .order('updated_at', { ascending: false })

  // Add organization filter for defense in depth
  if (organizationId) {
    query.eq('organization_id', organizationId)
  }

  const { data: cases } = await query

  return cases || []
}

/**
 * Fetches leader's case statistics
 */
async function getLeaderStats(userId: string, organizationId: string | null) {
  const supabase = await createClient()

  // Get case IDs where user is leader
  const { data: assignments } = await supabase
    .from('case_assignments')
    .select('case_id')
    .eq('user_id', userId)
    .eq('case_role', 'leader')

  if (!assignments || assignments.length === 0) {
    return {
      totalCases: 0,
      activeCases: 0,
      totalTasks: 0,
      pendingTasks: 0,
      completedTasks: 0,
      upcomingDeadlines: 0,
    }
  }

  const caseIds = assignments.map(a => a.case_id)

  // Build queries with organization filter for defense in depth
  const buildQuery = (table: string, baseQuery: any) => {
    if (organizationId) {
      return baseQuery.eq('organization_id', organizationId)
    }
    return baseQuery
  }

  const [
    { count: totalCases },
    { count: activeCases },
    { count: totalTasks },
    { count: pendingTasks },
    { count: completedTasks },
    { count: upcomingDeadlines },
  ] = await Promise.all([
    buildQuery('cases', supabase.from('cases').select('*', { count: 'exact', head: true }).in('id', caseIds)),
    buildQuery('cases', supabase.from('cases').select('*', { count: 'exact', head: true }).in('id', caseIds).eq('status', 'active')),
    buildQuery('tasks', supabase.from('tasks').select('*', { count: 'exact', head: true }).in('case_id', caseIds)),
    buildQuery('tasks', supabase.from('tasks').select('*', { count: 'exact', head: true }).in('case_id', caseIds).in('status', ['pending', 'in_progress'])),
    buildQuery('tasks', supabase.from('tasks').select('*', { count: 'exact', head: true }).in('case_id', caseIds).eq('status', 'completed')),
    buildQuery('deadlines', supabase.from('deadlines').select('*', { count: 'exact', head: true })
      .in('case_id', caseIds)
      .eq('is_completed', false)
      .gte('due_date', new Date().toISOString().split('T')[0])
      .lte('due_date', new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])),
  ])

  return {
    totalCases: totalCases || 0,
    activeCases: activeCases || 0,
    totalTasks: totalTasks || 0,
    pendingTasks: pendingTasks || 0,
    completedTasks: completedTasks || 0,
    upcomingDeadlines: upcomingDeadlines || 0,
  }
}

/**
 * Fetches deadlines for leader's cases
 */
async function getLeaderDeadlines(userId: string, organizationId: string | null) {
  const supabase = await createClient()

  // Get case IDs where user is leader
  const { data: assignments } = await supabase
    .from('case_assignments')
    .select('case_id')
    .eq('user_id', userId)
    .eq('case_role', 'leader')

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
    .limit(6)

  // Add organization filter for defense in depth
  if (organizationId) {
    query.eq('organization_id', organizationId)
  }

  const { data: deadlines } = await query

  return deadlines || []
}

/**
 * Fetches team task assignments for leader's cases
 */
async function getTeamTaskStatus(userId: string, organizationId: string | null) {
  const supabase = await createClient()

  // Get case IDs where user is leader
  const { data: caseAssignments } = await supabase
    .from('case_assignments')
    .select('case_id')
    .eq('user_id', userId)
    .eq('case_role', 'leader')

  if (!caseAssignments || caseAssignments.length === 0) return []

  const caseIds = caseAssignments.map(a => a.case_id)

  // Get all team members assigned to these cases
  const { data: teamAssignments } = await supabase
    .from('case_assignments')
    .select(`
      user_id,
      case_role,
      profiles (id, first_name, last_name)
    `)
    .in('case_id', caseIds)
    .neq('user_id', userId)

  if (!teamAssignments) return []

  // Deduplicate team members
  const uniqueMembers = new Map<string, { id: string; first_name: string; last_name: string }>()
  for (const assignment of teamAssignments) {
    const profilesRaw = assignment.profiles as unknown
    const profiles = profilesRaw as { id: string; first_name: string; last_name: string }[] | { id: string; first_name: string; last_name: string } | null
    const profile = Array.isArray(profiles) ? (profiles.length > 0 ? profiles[0] : null) : profiles
    if (profile && !uniqueMembers.has(profile.id)) {
      uniqueMembers.set(profile.id, profile)
    }
  }

  // Build task queries with organization filter
  const buildTaskQuery = (baseQuery: any) => {
    if (organizationId) {
      return baseQuery.eq('organization_id', organizationId)
    }
    return baseQuery
  }

  // Get task counts for each team member
  const teamStats = await Promise.all(
    Array.from(uniqueMembers.values()).map(async (member: { id: string; first_name: string; last_name: string }) => {
      const [{ count: pending }, { count: inProgress }, { count: completed }] = await Promise.all([
        buildTaskQuery(supabase.from('tasks').select('*', { count: 'exact', head: true })
          .in('case_id', caseIds)
          .eq('assigned_to', member.id)
          .eq('status', 'pending')),
        buildTaskQuery(supabase.from('tasks').select('*', { count: 'exact', head: true })
          .in('case_id', caseIds)
          .eq('assigned_to', member.id)
          .eq('status', 'in_progress')),
        buildTaskQuery(supabase.from('tasks').select('*', { count: 'exact', head: true })
          .in('case_id', caseIds)
          .eq('assigned_to', member.id)
          .eq('status', 'completed')),
      ])

      return {
        ...member,
        pending: pending || 0,
        inProgress: inProgress || 0,
        completed: completed || 0,
        total: (pending || 0) + (inProgress || 0) + (completed || 0),
      }
    })
  )

  return teamStats.filter(m => m.total > 0).sort((a, b) => (b.pending + b.inProgress) - (a.pending + a.inProgress))
}

/**
 * Calculate days until deadline
 */
function getDaysUntil(dateString: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const deadline = new Date(dateString)
  deadline.setHours(0, 0, 0, 0)
  return Math.ceil((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

/**
 * Get user initials
 */
function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()
}

export async function LeaderDashboard({ userId }: LeaderDashboardProps) {
  const organizationId = await getCurrentUserOrganizationId()
  
  const [leadCases, stats, deadlines, teamStatus] = await Promise.all([
    getLeadCases(userId, organizationId),
    getLeaderStats(userId, organizationId),
    getLeaderDeadlines(userId, organizationId),
    getTeamTaskStatus(userId, organizationId),
  ])

  const taskCompletionRate = stats.totalTasks > 0 
    ? Math.round((stats.completedTasks / stats.totalTasks) * 100) 
    : 0

  return (
    <div className="space-y-6">
      {/* Statistics Row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Cases I Lead */}
        <Card className="border-border/60">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Mis Casos
            </CardTitle>
            <Briefcase className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeCases}</div>
            <p className="text-xs text-muted-foreground">
              casos activos que lidero
            </p>
          </CardContent>
        </Card>

        {/* Task Progress */}
        <Card className="border-border/60">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Progreso de Tareas
            </CardTitle>
            <CheckSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold">{taskCompletionRate}%</span>
              <span className="text-xs text-muted-foreground">completado</span>
            </div>
            <Progress value={taskCompletionRate} className="mt-2 h-1.5" />
          </CardContent>
        </Card>

        {/* Pending Tasks */}
        <Card className="border-border/60">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Tareas Pendientes
            </CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pendingTasks}</div>
            <p className="text-xs text-muted-foreground">
              en mis casos
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
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column - My Cases */}
        <div className="space-y-6 lg:col-span-2">
          {/* Cases I Lead */}
          <Card className="border-border/60">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold">Casos que Lidero</CardTitle>
                <CardDescription>Casos bajo su responsabilidad</CardDescription>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/casos?role=leader" className="text-xs">
                  Ver todos
                  <ArrowRight className="ml-1 h-3 w-3" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {leadCases.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Briefcase className="mb-2 h-8 w-8 text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground">
                    No tiene casos asignados como líder
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {leadCases.slice(0, 5).map((caseItem) => {
                    const company = Array.isArray(caseItem.companies) 
                      ? (caseItem.companies[0] as { id: string; company_name: string | null; name: string | null } | null)
                      : (caseItem.companies as { id: string; company_name: string | null; name: string | null } | null)
                    const status = caseStatusConfig[caseItem.status as CaseStatus]

                    return (
                <Link
                  key={caseItem.id}
                  href={`/casos/${caseItem.id}`}
                  className="flex items-start gap-3 rounded-md border border-border/60 p-3 transition-colors hover:bg-muted/50"
                >
                  <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-muted-foreground">
                              {caseItem.case_number}
                            </span>
                            <Badge variant={status.variant} className="h-5 text-[10px]">
                              {status.label}
                            </Badge>
                          </div>
                          <p className="text-sm font-medium text-foreground truncate">
                            {caseItem.title}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {company?.company_name || company?.name || 'Sin empresa'}
                          </p>
                        </div>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                            <Link href={`/casos/${caseItem.id}?tab=tasks`}>
                              <CheckSquare className="h-3.5 w-3.5" />
                            </Link>
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                            <Link href={`/casos/${caseItem.id}?tab=documents`}>
                              <FileText className="h-3.5 w-3.5" />
                            </Link>
                          </Button>
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
              <div>
                <CardTitle className="text-base font-semibold">Próximos Vencimientos</CardTitle>
                <CardDescription>De los casos que lidero</CardDescription>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/vencimientos" className="text-xs">
                  Ver todos
                  <ArrowRight className="ml-1 h-3 w-3" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {deadlines.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-6 text-center">
                  <Calendar className="mb-2 h-6 w-6 text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground">
                    No hay vencimientos próximos
                  </p>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {deadlines.map((deadline) => {
                    const caseData = Array.isArray(deadline.cases)
                      ? (deadline.cases[0] as { id: string; case_number: string; title: string } | null)
                      : (deadline.cases as { id: string; case_number: string; title: string } | null)
                    const daysUntil = getDaysUntil(deadline.due_date)
                    const isUrgent = daysUntil <= 2

                    return (
                      <div
                        key={deadline.id}
                        className={`rounded-md border p-3 ${
                          isUrgent ? 'border-destructive/50 bg-destructive/5' : 'border-border'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">
                              {deadline.title}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {caseData?.case_number}
                            </p>
                          </div>
                          <div className={`text-right ${isUrgent ? 'text-destructive' : 'text-muted-foreground'}`}>
                            <p className="text-xs font-medium">
                              {new Date(deadline.due_date).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}
  </p>
  </div>
                        </div>
                        {isUrgent && (
                          <div className="mt-2 flex items-center gap-1 text-destructive">
                            <AlertTriangle className="h-3 w-3" />
                            <span className="text-[10px] font-medium">
                              {daysUntil === 0 ? 'Hoy' : daysUntil === 1 ? 'Mañana' : `En ${daysUntil} días`}
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

        {/* Right Column - Team Status */}
        <div className="space-y-6">
          {/* Team Task Status */}
          <Card className="border-border/60">
            <CardHeader>
              <CardTitle className="text-base font-semibold">Estado del Equipo</CardTitle>
              <CardDescription>Tareas del equipo en mis casos</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {teamStatus.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-6 text-center">
                  <Users className="mb-2 h-6 w-6 text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground">
                    No hay equipo asignado
                  </p>
                </div>
              ) : (
                teamStatus.slice(0, 6).map((member: { id: string; first_name: string; last_name: string; pending: number; inProgress: number; completed: number; total: number }) => {
                  const completionRate = member.total > 0 
                    ? Math.round((member.completed / member.total) * 100) 
                    : 0

                  return (
                    <div key={member.id} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6">
                            <AvatarFallback className="bg-primary/10 text-[10px] text-primary">
                              {getInitials(member.first_name, member.last_name)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm font-medium">
                            {member.first_name} {member.last_name.charAt(0)}.
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {completionRate}%
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Progress value={completionRate} className="h-1.5 flex-1" />
                        <div className="flex gap-1 text-[10px]">
                          <span className="text-muted-foreground">{member.pending}P</span>
                          <span className="text-chart-1">{member.inProgress}E</span>
                          <span className="text-chart-2">{member.completed}C</span>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card className="border-border/60">
            <CardHeader>
              <CardTitle className="text-base font-semibold">Acciones Rápidas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" className="w-full justify-start gap-2 bg-transparent" asChild>
                <Link href="/tareas/nueva">
                  <Plus className="h-4 w-4" />
                  Nueva Tarea
                </Link>
              </Button>
              <Button variant="outline" className="w-full justify-start gap-2 bg-transparent" asChild>
                <Link href="/vencimientos/nuevo">
                  <Calendar className="h-4 w-4" />
                  Nuevo Vencimiento
                </Link>
              </Button>
              <Button variant="outline" className="w-full justify-start gap-2 bg-transparent" asChild>
                <Link href="/documentos/subir">
                  <FileText className="h-4 w-4" />
                  Subir Documento
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
