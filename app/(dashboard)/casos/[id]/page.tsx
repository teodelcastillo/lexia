/**
 * Case Detail Page
 * 
 * Displays comprehensive information about a single case.
 * Shows tabs for overview, timeline, tasks, documents, and activity.
 * Permissions adapt based on the user's role in that case.
 */
import { Suspense } from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { 
  ArrowLeft, 
  Edit, 
  MoreHorizontal,
  Briefcase,
  User,
  Calendar,
  Scale,
  Building2,
  Clock,
  CheckSquare,
  FileText,
  Users,
  Activity,
  MessageSquare,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { CaseOverview } from '@/components/cases/case-overview'
import { CaseTimeline } from '@/components/cases/case-timeline'
import { CaseTasks } from '@/components/cases/case-tasks'
import { CaseDocuments } from '@/components/cases/case-documents'
import { CaseTeam } from '@/components/cases/case-team'
import { CaseActivityLog } from '@/components/cases/case-activity-log'
import { CaseNotes } from '@/components/cases/case-notes'
import { CaseLexiaButton } from '@/components/cases/case-lexia-button'
import type { CaseStatus, TaskPriority, CaseRole } from '@/lib/types'

export const metadata = {
  title: 'Detalle de Caso',
}

interface CaseDetailPageProps {
  params: Promise<{ id: string }>
}

/**
 * Status badge configuration with variants
 */
const statusConfig: Record<CaseStatus, { 
  label: string
  variant: 'default' | 'secondary' | 'destructive' | 'outline'
  className?: string 
}> = {
  active: { label: 'Activo', variant: 'default', className: 'bg-success text-success-foreground' },
  pending: { label: 'Pendiente', variant: 'secondary', className: 'bg-warning/20 text-warning border-warning/30' },
  on_hold: { label: 'En Espera', variant: 'outline' },
  closed: { label: 'Cerrado', variant: 'secondary' },
  archived: { label: 'Archivado', variant: 'outline', className: 'opacity-60' },
}

/**
 * Priority configuration with colors
 */
const priorityConfig: Record<TaskPriority, { label: string; className: string }> = {
  urgent: { label: 'Urgente', className: 'bg-destructive/10 text-destructive border-destructive/30' },
  high: { label: 'Alta', className: 'bg-warning/10 text-warning border-warning/30' },
  medium: { label: 'Media', className: 'bg-chart-2/10 text-chart-2 border-chart-2/30' },
  low: { label: 'Baja', className: 'bg-muted text-muted-foreground' },
}

/**
 * Role labels for display
 */
const roleLabels: Record<CaseRole, string> = {
  leader: 'Responsable',
  lawyer: 'Abogado',
  assistant: 'Asistente',
}

/**
 * Fetches case data by ID with all related information
 */
async function getCaseById(id: string) {
  const supabase = await createClient()

  const { data: caseData, error } = await supabase
    .from('cases')
    .select(`
      *,
      companies (
        id,
        company_name,
        name,
        email,
        phone
      ),
      case_assignments (
        id,
        case_role,
        assigned_at,
        profiles (
          id,
          first_name,
          last_name,
          email,
          system_role
        )
      ),
      case_participants (
        id,
        role,
        is_active,
        notes,
        people (
          id,
          name,
          first_name,
          last_name,
          email,
          phone,
          person_type
        )
      )
    `)
    .eq('id', id)
    .single()

  if (error || !caseData) {
    return null
  }

  return caseData
}

/**
 * Fetches case notes for the notes tab
 */
async function getCaseNotes(caseId: string) {
  const supabase = await createClient()

  const { data: notes, error } = await supabase
    .from('case_notes')
    .select(`
      id,
      content,
      is_pinned,
      is_visible_to_client,
      created_at,
      updated_at,
      profiles!case_notes_created_by_fkey (
        id,
        first_name,
        last_name
      )
    `)
    .eq('case_id', caseId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching case notes:', error)
    return []
  }

  return notes
}

/**
 * Validates user has access to view this case
 * Returns user permissions specific to this case
 */
async function validateAccess(caseId: string) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('system_role')
    .eq('id', user.id)
    .single()

  // Admins can view and edit all cases
  if (profile?.system_role === 'admin_general') {
    return { 
      user, 
      profile, 
      canEdit: true, 
      canManageTeam: true,
      caseRole: 'admin_general' as const 
    }
  }

  // Clients redirect to portal
  if (profile?.system_role === 'client') {
    redirect('/portal')
  }

  // Check user's assignment to this case
  const { data: assignment } = await supabase
    .from('case_assignments')
    .select('case_role')
    .eq('case_id', caseId)
    .eq('user_id', user.id)
    .single()

  if (!assignment) {
    // User has no assignment to this case - no access
    redirect('/casos')
  }

  const caseRole = assignment.case_role as CaseRole

  return {
    user,
    profile,
    canEdit: caseRole === 'leader' || caseRole === 'case_leader',
    canManageTeam: caseRole === 'leader',
    caseRole,
  }
}

export default async function CaseDetailPage({ params }: CaseDetailPageProps) {
  const { id } = await params
  const { user, canEdit, canManageTeam, caseRole } = await validateAccess(id)
  
  const [caseData, notes] = await Promise.all([
    getCaseById(id),
    getCaseNotes(id),
  ])
  
  if (!caseData) {
    // Caso no encontrado o RLS impide lectura (ej. organization_id del perfil no coincide).
    // Redirigir a listado en lugar de 404 para mejor UX.
    redirect('/casos?error=case_not_found')
  }

  const company = caseData.companies as { 
    id: string
    company_name: string | null
    name: string | null
    email: string | null
    phone: string | null
  } | null
  
  const status = statusConfig[caseData.status as CaseStatus]
  const priority = caseData.priority ? priorityConfig[caseData.priority as TaskPriority] : null

  // Map DB column names to UI expectations (court_name -> court, etc.)
  const overviewData = {
    ...caseData,
    court: (caseData as { court_name?: string; court?: string }).court_name ?? (caseData as { court?: string }).court,
    file_number: (caseData as { court_number?: string; file_number?: string }).court_number ?? (caseData as { file_number?: string }).file_number,
    opponent: (caseData as { opposing_party?: string; opponent?: string }).opposing_party ?? (caseData as { opponent?: string }).opponent,
    opponent_lawyer: (caseData as { opposing_counsel?: string; opponent_lawyer?: string }).opposing_counsel ?? (caseData as { opponent_lawyer?: string }).opponent_lawyer,
    judge: null as string | null,
  }

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col gap-4">
        {/* Back Link */}
        <Link 
          href="/casos" 
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          Volver a Casos
        </Link>

        {/* Case Title and Actions */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            {/* Badges Row */}
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="font-mono text-xs">
                {caseData.case_number}
              </Badge>
              <Badge variant={status.variant} className={status.className}>
                {status.label}
              </Badge>
              {priority && (
                <Badge variant="outline" className={priority.className}>
                  {priority.label}
                </Badge>
              )}
              {caseRole !== 'admin_general' && (
                <Badge variant="secondary" className="text-xs">
                  Tu rol: {roleLabels[caseRole]}
                </Badge>
              )}
            </div>
            
            {/* Title */}
            <h1 className="text-2xl font-semibold tracking-tight text-foreground text-balance">
              {caseData.title}
            </h1>
            
            {/* Case Type */}
            <p className="text-sm text-muted-foreground">
              {caseData.case_type}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 shrink-0">
<CaseLexiaButton caseId={id} />
  {canEdit && (
  <Button variant="outline" asChild className="bg-transparent">
  <Link href={`/casos/${id}/editar`}>
  <Edit className="mr-2 h-4 w-4" />
  Editar
  </Link>
  </Button>
  )}
  <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="bg-transparent">
                  <MoreHorizontal className="h-4 w-4" />
                  <span className="sr-only">Mas opciones</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link href={`/calendario/nuevo?caso=${id}`}>
                    <Calendar className="mr-2 h-4 w-4" />
                    Agregar Vencimiento
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href={`/tareas/nueva?caso=${id}`}>
                    <CheckSquare className="mr-2 h-4 w-4" />
                    Agregar Tarea
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href={`/documentos/subir?caso=${id}`}>
                    <FileText className="mr-2 h-4 w-4" />
                    Subir Documento
                  </Link>
                </DropdownMenuItem>
                {canManageTeam && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-destructive focus:text-destructive">
                      Archivar Caso
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Quick Info Cards */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* Company */}
          <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted">
              <Building2 className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">Empresa</p>
              {company ? (
                <Link 
                  href={`/empresas/${company.id}`}
                  className="text-sm font-medium hover:text-primary hover:underline truncate block"
                >
                  {company.company_name || company.name || 'Sin nombre'}
                </Link>
              ) : (
                <p className="text-sm text-muted-foreground">Sin asignar</p>
              )}
            </div>
          </div>

          {/* Court */}
          <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted">
              <Scale className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">Juzgado</p>
              <p className="text-sm font-medium truncate">
                {overviewData.court || 'No especificado'}
              </p>
            </div>
          </div>

          {/* Opened Date */}
          <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted">
              <Calendar className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">Fecha de Apertura</p>
              <p className="text-sm font-medium">
                {new Date(caseData.created_at).toLocaleDateString('es-AR', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </p>
            </div>
          </div>

          {/* Last Updated */}
          <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted">
              <Clock className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">Ultima Actualizacion</p>
              <p className="text-sm font-medium">
                {new Date(caseData.updated_at).toLocaleDateString('es-AR', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Section */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="w-full flex flex-wrap h-auto gap-1 p-1 bg-muted/50">
          <TabsTrigger value="overview" className="flex-1 min-w-fit gap-1.5">
            <Briefcase className="h-4 w-4" />
            <span className="hidden sm:inline">General</span>
          </TabsTrigger>
          <TabsTrigger value="timeline" className="flex-1 min-w-fit gap-1.5">
            <Clock className="h-4 w-4" />
            <span className="hidden sm:inline">Cronologia</span>
          </TabsTrigger>
          <TabsTrigger value="tasks" className="flex-1 min-w-fit gap-1.5">
            <CheckSquare className="h-4 w-4" />
            <span className="hidden sm:inline">Tareas</span>
          </TabsTrigger>
          <TabsTrigger value="documents" className="flex-1 min-w-fit gap-1.5">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Documentos</span>
          </TabsTrigger>
          <TabsTrigger value="team" className="flex-1 min-w-fit gap-1.5">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Equipo</span>
          </TabsTrigger>
          <TabsTrigger value="notes" className="flex-1 min-w-fit gap-1.5">
            <MessageSquare className="h-4 w-4" />
            <span className="hidden sm:inline">Notas</span>
          </TabsTrigger>
          <TabsTrigger value="activity" className="flex-1 min-w-fit gap-1.5">
            <Activity className="h-4 w-4" />
            <span className="hidden sm:inline">Actividad</span>
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview">
          <Suspense fallback={<Skeleton className="h-64 w-full" />}>
            <CaseOverview caseData={overviewData} />
          </Suspense>
        </TabsContent>

        {/* Timeline Tab */}
        <TabsContent value="timeline">
          <Suspense fallback={<Skeleton className="h-64 w-full" />}>
            <CaseTimeline 
              caseId={id} 
              openedAt={caseData.created_at} 
              canEdit={canEdit} 
            />
          </Suspense>
        </TabsContent>

        {/* Tasks Tab */}
        <TabsContent value="tasks">
          <Suspense fallback={<Skeleton className="h-64 w-full" />}>
            <CaseTasks caseId={id} canEdit={canEdit} />
          </Suspense>
        </TabsContent>

        {/* Documents Tab */}
        <TabsContent value="documents">
          <Suspense fallback={<Skeleton className="h-64 w-full" />}>
            <CaseDocuments caseId={id} canEdit={canEdit} />
          </Suspense>
        </TabsContent>

        {/* Team Tab */}
        <TabsContent value="team">
          <Suspense fallback={<Skeleton className="h-64 w-full" />}>
            <CaseTeam 
              caseId={id} 
              assignments={caseData.case_assignments || []} 
              canManageTeam={canManageTeam} 
            />
          </Suspense>
        </TabsContent>

        {/* Notes Tab */}
        <TabsContent value="notes">
          <CaseNotes 
            caseId={id} 
            initialNotes={notes} 
            currentUserId={user.id}
            canEdit={canEdit} 
          />
        </TabsContent>

        {/* Activity Tab */}
        <TabsContent value="activity">
          <Suspense fallback={<Skeleton className="h-64 w-full" />}>
            <CaseActivityLog caseId={id} />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  )
}
