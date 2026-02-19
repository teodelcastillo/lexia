/**
 * Admin Dashboard Component
 * 
 * Global overview for administrators showing:
 * - Studio-wide statistics and metrics
 * - All active cases with priority indicators
 * - Upcoming deadlines across all cases
 * - Team activity and workload overview
 * - Tasks requiring attention
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
  Users,
  CheckSquare,
  Clock,
  AlertTriangle,
  TrendingUp,
  Calendar,
  Activity,
} from 'lucide-react'
import type { CaseStatus, TaskStatus, UserProfile } from '@/lib/types'

interface AdminDashboardProps {
  userId: string
}

/**
 * Status badge configuration for cases
 */
const caseStatusConfig: Record<CaseStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  active: { label: 'Activo', variant: 'default' },
  pending: { label: 'Pendiente', variant: 'secondary' },
  on_hold: { label: 'En Espera', variant: 'outline' },
  closed: { label: 'Cerrado', variant: 'secondary' },
  archived: { label: 'Archivado', variant: 'outline' },
}



/**
 * Fetches global statistics for the admin dashboard
 */
async function getGlobalStats(organizationId: string | null) {
  const supabase = await createClient()

  // Build queries with organization filter
  const buildQuery = (table: string, baseQuery: any) => {
    if (organizationId) {
      return baseQuery.eq('organization_id', organizationId)
    }
    return baseQuery
  }

  const [
    { count: totalCases },
    { count: activeCases },
    { count: totalCompanies },
    { count: activeCompanies },
    { count: pendingTasks },
    { count: overdueTasks },
    { count: upcomingDeadlines },
    { count: urgentDeadlines },
    { count: teamMembers },
  ] = await Promise.all([
    buildQuery('cases', supabase.from('cases').select('*', { count: 'exact', head: true })),
    buildQuery('cases', supabase.from('cases').select('*', { count: 'exact', head: true }).eq('status', 'active')),
    buildQuery('companies', supabase.from('companies').select('*', { count: 'exact', head: true })),
    buildQuery('companies', supabase.from('companies').select('*', { count: 'exact', head: true }).or('is_active.eq.true,is_active.is.null')),
    buildQuery('tasks', supabase.from('tasks').select('*', { count: 'exact', head: true }).in('status', ['pending', 'in_progress'])),
    buildQuery('tasks', supabase.from('tasks').select('*', { count: 'exact', head: true })
      .in('status', ['pending', 'in_progress'])
      .lt('due_date', new Date().toISOString().split('T')[0])),
    buildQuery('deadlines', supabase.from('deadlines').select('*', { count: 'exact', head: true })
      .eq('is_completed', false)
      .gte('due_date', new Date().toISOString().split('T')[0])
      .lte('due_date', new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])),
    buildQuery('deadlines', supabase.from('deadlines').select('*', { count: 'exact', head: true })
      .eq('is_completed', false)
      .lte('due_date', new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])),
    buildQuery('profiles', supabase.from('profiles').select('*', { count: 'exact', head: true })
      .neq('system_role', 'client')
      .eq('is_active', true)),
  ])

  return {
    totalCases: totalCases || 0,
    activeCases: activeCases || 0,
    totalCompanies: totalCompanies || 0,
    activeCompanies: activeCompanies || 0,
    pendingTasks: pendingTasks || 0,
    overdueTasks: overdueTasks || 0,
    upcomingDeadlines: upcomingDeadlines || 0,
    urgentDeadlines: urgentDeadlines || 0,
    teamMembers: teamMembers || 0,
  }
}

/**
 * Fetches priority cases that need attention
 */
async function getPriorityCases(organizationId: string | null) {
  const supabase = await createClient()

  const query = supabase
    .from('cases')
    .select(`
      id,
      case_number,
      title,
      status
    `)
    .eq('status', 'active')
    .order('updated_at', { ascending: false })
    .limit(5)

  if (organizationId) {
    query.eq('organization_id', organizationId)
  }

  const { data: cases } = await query

  return cases || []
}

/**
 * Fetches upcoming critical deadlines
 */
async function getCriticalDeadlines(organizationId: string | null) {
  const supabase = await createClient()
  const today = new Date().toISOString().split('T')[0]
  const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  const query = supabase
    .from('deadlines')
    .select(`
      id,
      title,
      deadline_type,
      due_date,
      cases (id, case_number, title)
    `)
    .eq('is_completed', false)
    .gte('due_date', today)
    .lte('due_date', nextWeek)
    .order('due_date', { ascending: true })
    .limit(6)

  if (organizationId) {
    query.eq('organization_id', organizationId)
  }

  const { data: deadlines } = await query

  return deadlines || []
}

/**
 * Fetches team workload summary
 */
async function getTeamWorkload(organizationId: string | null) {
  const supabase = await createClient()

  // Get team members with their task counts
  const profilesQuery = supabase
    .from('profiles')
    .select('id, first_name, last_name, system_role')
    .neq('system_role', 'client')
    .eq('is_active', true)
    .limit(8)

  if (organizationId) {
    profilesQuery.eq('organization_id', organizationId)
  }

  const { data: profiles } = await profilesQuery

  if (!profiles) return []

  // Get task counts for each team member
  const workloadPromises = profiles.map(async (profile) => {
    const buildTaskQuery = (baseQuery: any) => {
      if (organizationId) {
        return baseQuery.eq('organization_id', organizationId)
      }
      return baseQuery
    }

    const [{ count: pendingTasks }, { count: completedThisWeek }] = await Promise.all([
      buildTaskQuery(supabase
        .from('tasks')
        .select('*', { count: 'exact', head: true })
        .eq('assigned_to', profile.id)
        .in('status', ['pending', 'in_progress'])),
      buildTaskQuery(supabase
        .from('tasks')
        .select('*', { count: 'exact', head: true })
        .eq('assigned_to', profile.id)
        .eq('status', 'completed')
        .gte('completed_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())),
    ])

    return {
      ...profile,
      pendingTasks: pendingTasks || 0,
      completedThisWeek: completedThisWeek || 0,
    }
  })

  const workload = await Promise.all(workloadPromises)
  return workload.sort((a, b) => b.pendingTasks - a.pendingTasks)
}

/**
 * Fetches recent activity across the studio
 */
async function getRecentActivity(organizationId: string | null) {
  const supabase = await createClient()

  const query = supabase
    .from('activity_log')
    .select(`
      id,
      entity_type,
      action_type,
      description,
      created_at,
      profiles (id, first_name, last_name)
    `)
    .order('created_at', { ascending: false })
    .limit(6)

  if (organizationId) {
    query.eq('organization_id', organizationId)
  }

  const { data: activities } = await query

  return activities || []
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
 * Format relative time for activity
 */
function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))

  if (diffMins < 1) return 'Ahora'
  if (diffMins < 60) return `${diffMins}m`
  if (diffHours < 24) return `${diffHours}h`
  return date.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
}

/**
 * Get user initials
 */
function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()
}

export async function AdminDashboard({ userId }: AdminDashboardProps) {
  const organizationId = await getCurrentUserOrganizationId()
  
  const [stats, priorityCases, criticalDeadlines, teamWorkload, recentActivity] = await Promise.all([
    getGlobalStats(organizationId),
    getPriorityCases(organizationId),
    getCriticalDeadlines(organizationId),
    getTeamWorkload(organizationId),
    getRecentActivity(organizationId),
  ])

  return (
    <div className="space-y-6">
      {/* Key Metrics Row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Active Cases */}
        <Card className="border-border/60">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Casos Activos
            </CardTitle>
            <Briefcase className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeCases}</div>
            <p className="text-xs text-muted-foreground">
              de {stats.totalCases} casos totales
            </p>
          </CardContent>
        </Card>

        {/* Clients */}
        <Card className="border-border/60">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Clientes Activos
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeCompanies}</div>
            <p className="text-xs text-muted-foreground">
              de {stats.totalCompanies} empresas totales
            </p>
          </CardContent>
        </Card>

        {/* Tasks */}
        <Card className="border-border/60">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Tareas Pendientes
            </CardTitle>
            <CheckSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold">{stats.pendingTasks}</span>
              {stats.overdueTasks > 0 && (
                <Badge variant="destructive" className="text-[10px]">
                  {stats.overdueTasks} vencidas
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              en todo el estudio
            </p>
          </CardContent>
        </Card>

        {/* Deadlines */}
        <Card className="border-border/60">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Vencimientos (7 días)
            </CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold">{stats.upcomingDeadlines}</span>
              {stats.urgentDeadlines > 0 && (
                <Badge variant="destructive" className="text-[10px]">
                  {stats.urgentDeadlines} urgentes
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              próximos eventos
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column - Priority Cases & Deadlines */}
        <div className="space-y-6 lg:col-span-2">
          {/* Priority Cases */}
          <Card className="border-border/60">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold">Casos Prioritarios</CardTitle>
                <CardDescription>Casos de alta y urgente prioridad</CardDescription>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/casos?status=active" className="text-xs">
                  Ver todos
                  <ArrowRight className="ml-1 h-3 w-3" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {priorityCases.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <TrendingUp className="mb-2 h-8 w-8 text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground">
                    No hay casos de alta prioridad activos
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {priorityCases.map((caseItem) => {
                    const status = caseStatusConfig[caseItem.status as CaseStatus]

                    return (
                      <Link
                        key={caseItem.id}
                        href={`/casos/${caseItem.id}`}
                        className="flex items-center gap-3 rounded-md p-2 transition-colors hover:bg-muted/50"
                      >
                        <div className="h-2 w-2 rounded-full bg-warning" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-muted-foreground">
                              {caseItem.case_number}
                            </span>
                            <Badge variant="secondary" className="h-5 text-[10px]">
                              Activo
                            </Badge>
                          </div>
                          <p className="text-sm font-medium text-foreground truncate">
                            {caseItem.title}
                          </p>
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      </Link>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Critical Deadlines */}
          <Card className="border-border/60">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold">Eventos Críticos</CardTitle>
                <CardDescription>Próximos 7 días</CardDescription>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/calendario" className="text-xs">
                  Ver calendario
                  <ArrowRight className="ml-1 h-3 w-3" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {criticalDeadlines.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Calendar className="mb-2 h-8 w-8 text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground">
                    No hay eventos esta semana
                  </p>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {criticalDeadlines.map((deadline) => {
                    const c = deadline.cases
                    const caseData = (Array.isArray(c) ? c[0] ?? null : c ?? null) as { id: string; case_number: string; title: string } | null
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
                          <div className={`flex flex-col items-end ${isUrgent ? 'text-destructive' : 'text-muted-foreground'}`}>
                            <span className="text-xs font-medium">
                              {new Date(deadline.due_date).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}
                            </span>
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

        {/* Right Column - Team & Activity */}
        <div className="space-y-6">
          {/* Team Workload */}
          <Card className="border-border/60">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base font-semibold">Carga del Equipo</CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/admin/usuarios" className="text-xs">
                  Gestionar
                  <ArrowRight className="ml-1 h-3 w-3" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {teamWorkload.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No hay miembros del equipo
                </p>
              ) : (
                teamWorkload.slice(0, 5).map((member) => {
                  const maxTasks = Math.max(...teamWorkload.map(m => m.pendingTasks), 10)
                  const percentage = (member.pendingTasks / maxTasks) * 100

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
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{member.pendingTasks} pendientes</span>
                          {member.completedThisWeek > 0 && (
                            <Badge variant="outline" className="h-5 text-[10px]">
                              +{member.completedThisWeek} esta semana
                            </Badge>
                          )}
                        </div>
                      </div>
                      <Progress value={percentage} className="h-1.5" />
                    </div>
                  )
                })
              )}
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card className="border-border/60">
            <CardHeader>
              <CardTitle className="text-base font-semibold">Actividad Reciente</CardTitle>
            </CardHeader>
            <CardContent>
              {recentActivity.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-6 text-center">
                  <Activity className="mb-2 h-6 w-6 text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground">Sin actividad reciente</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentActivity.map((activity) => {
                    const p = activity.profiles
                    const profile = (Array.isArray(p) ? p[0] ?? null : p ?? null) as { id: string; first_name: string; last_name: string } | null
                    const actionLabels: Record<string, string> = {
                      created: 'creó',
                      updated: 'actualizó',
                      completed: 'completó',
                      assigned: 'asignó',
                    }
                    const entityLabels: Record<string, string> = {
                      case: 'caso',
                      client: 'cliente',
                      task: 'tarea',
                      document: 'documento',
                      deadline: 'evento',
                    }

                    return (
                      <div key={activity.id} className="flex items-start gap-2">
                        <Avatar className="h-5 w-5 mt-0.5">
                          <AvatarFallback className="bg-muted text-[8px]">
                            {profile ? getInitials(profile.first_name, profile.last_name) : 'U'}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-foreground">
                            <span className="font-medium">
                              {profile ? `${profile.first_name} ${profile.last_name.charAt(0)}.` : 'Usuario'}
                            </span>
                            {' '}{activity.description || (actionLabels[activity.action_type] || activity.action_type)}{' '}
                            {entityLabels[activity.entity_type] || activity.entity_type}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {formatRelativeTime(activity.created_at)}
                          </p>
                        </div>
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
