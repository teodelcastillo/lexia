/**
 * Client Portal - Main Dashboard
 * 
 * Simple, reassuring overview for clients.
 * Shows case status, upcoming dates, and recent updates in non-technical language.
 */
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getEffectivePortalUserId } from '@/lib/portal/view-as'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Briefcase,
  Clock,
  FileText,
  Calendar,
  ChevronRight,
  CheckCircle2,
  Scale,
  Bell,
  ArrowRight,
  Download,
  Shield,
} from 'lucide-react'
import Link from 'next/link'

export const metadata = {
  title: 'Mis Casos - Portal de Clientes',
  description: 'Visualice el estado de sus casos legales',
}

/** Maps case status to client-friendly display */
function getStatusDisplay(status: string): { 
  label: string
  description: string 
  variant: 'default' | 'secondary' | 'outline'
  icon: typeof CheckCircle2
} {
  const statusMap: Record<string, { 
    label: string
    description: string
    variant: 'default' | 'secondary' | 'outline'
    icon: typeof CheckCircle2
  }> = {
    active: { 
      label: 'En Curso', 
      description: 'Estamos trabajando activamente',
      variant: 'default',
      icon: Scale,
    },
    pending: { 
      label: 'En Trámite', 
      description: 'Aguardando respuesta',
      variant: 'secondary',
      icon: Clock,
    },
    on_hold: { 
      label: 'En Espera', 
      description: 'Próximas acciones programadas',
      variant: 'outline',
      icon: Clock,
    },
    closed: { 
      label: 'Finalizado', 
      description: 'Caso concluido',
      variant: 'secondary',
      icon: CheckCircle2,
    },
    archived: { 
      label: 'Archivado', 
      description: 'Documentación guardada',
      variant: 'outline',
      icon: FileText,
    },
  }
  return statusMap[status] || { 
    label: status, 
    description: '',
    variant: 'outline',
    icon: Briefcase,
  }
}

/** Maps case type to friendly label */
function getCaseTypeLabel(type: string): string {
  const typeLabels: Record<string, string> = {
    civil: 'Civil',
    criminal: 'Penal',
    labor: 'Laboral',
    family: 'Familia',
    commercial: 'Comercial',
    administrative: 'Administrativo',
    tax: 'Tributario',
    other: 'Otro',
  }
  return typeLabels[type] || type
}

/** Format date in friendly way */
function formatFriendlyDate(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffTime = date.getTime() - now.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  
  if (diffDays === 0) return 'Hoy'
  if (diffDays === 1) return 'Mañana'
  if (diffDays > 1 && diffDays <= 7) return `En ${diffDays} días`
  
  return date.toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

export default async function PortalDashboard() {
  const supabase = await createClient()
  const effectiveUserId = await getEffectivePortalUserId()
  if (!effectiveUserId) redirect('/auth/portal-login')

  // Get client record linked to this user (or viewed-as client when admin)
  const { data: client } = await supabase
    .from('clients')
    .select('id, name')
    .eq('user_id', effectiveUserId)
    .single()

  // Fetch cases for this client
  const { data: cases } = await supabase
    .from('cases')
    .select(`
      id,
      case_number,
      title,
      case_type,
      status,
      created_at,
      updated_at,
      case_assignments(
        role,
        profile:profiles(first_name, last_name)
      )
    `)
    .eq('client_id', client?.id)
    .order('updated_at', { ascending: false })

  // Fetch upcoming deadlines for client's cases
  const caseIds = cases?.map(c => c.id) || []
  const { data: upcomingDeadlines } = caseIds.length > 0 
    ? await supabase
        .from('deadlines')
        .select(`
          id,
          title,
          due_date,
          deadline_type,
          case:cases(case_number, title)
        `)
        .in('case_id', caseIds)
        .eq('status', 'pending')
        .eq('is_visible_to_client', true)
        .gte('due_date', new Date().toISOString())
        .order('due_date', { ascending: true })
        .limit(5)
    : { data: [] }

  // Fetch recent activity/updates visible to client
  const { data: recentUpdates } = caseIds.length > 0
    ? await supabase
        .from('activity_log')
        .select(`
          id,
          action,
          description,
          created_at,
          case:cases(case_number, title)
        `)
        .in('case_id', caseIds)
        .eq('is_visible_to_client', true)
        .order('created_at', { ascending: false })
        .limit(5)
    : { data: [] }

  // Fetch recent documents shared with client
  const { data: recentDocuments } = caseIds.length > 0
    ? await supabase
        .from('documents')
        .select(`
          id,
          file_name,
          created_at,
          case:cases(case_number)
        `)
        .in('case_id', caseIds)
        .eq('is_visible_to_client', true)
        .order('created_at', { ascending: false })
        .limit(3)
    : { data: [] }

  // Get client's first name for greeting
  const firstName = client?.name?.split(' ')[0] || 'Cliente'
  const activeCases = cases?.filter(c => c.status === 'active' || c.status === 'pending').length || 0

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Bienvenido, {firstName}
          </h1>
          <p className="text-muted-foreground mt-1">
            Aquí puede consultar el estado de sus asuntos legales
          </p>
        </div>
        {activeCases > 0 && (
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/5 border border-primary/20">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            <span className="text-sm font-medium text-primary">
              {activeCases} {activeCases === 1 ? 'caso activo' : 'casos activos'}
            </span>
          </div>
        )}
      </div>

      {/* Status Reassurance Banner */}
      <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
        <CardContent className="flex items-start gap-4 pt-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/20 text-primary flex-shrink-0">
            <Shield className="h-6 w-6" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">
              Su caso está siendo atendido
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Nuestro equipo legal trabaja continuamente en sus asuntos. 
              Le notificaremos sobre cualquier novedad importante que requiera su atención.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content - Cases */}
        <div className="lg:col-span-2 space-y-6">
          {/* My Cases */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Mis Casos</h2>
              <span className="text-sm text-muted-foreground">
                {cases?.length || 0} {cases?.length === 1 ? 'caso' : 'casos'} en total
              </span>
            </div>
            
            {cases && cases.length > 0 ? (
              <div className="space-y-3">
                {cases.map((caseItem) => {
                  const statusDisplay = getStatusDisplay(caseItem.status)
                  const StatusIcon = statusDisplay.icon
                  const leadLawyer = caseItem.case_assignments?.find(
                    (a: { role: string }) => a.role === 'leader'
                  )

                  return (
                    <Card key={caseItem.id} className="hover:shadow-md transition-all hover:border-primary/30">
                      <Link href={`/portal/casos/${caseItem.id}`}>
                        <CardContent className="p-5">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex items-start gap-4 min-w-0">
                              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary flex-shrink-0">
                                <StatusIcon className="h-6 w-6" />
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap mb-1">
                                  <Badge variant={statusDisplay.variant} className="text-xs">
                                    {statusDisplay.label}
                                  </Badge>
                                  <span className="text-xs text-muted-foreground">
                                    {getCaseTypeLabel(caseItem.case_type)}
                                  </span>
                                </div>
                                <h3 className="font-medium text-foreground truncate">
                                  {caseItem.title}
                                </h3>
                                <p className="text-sm text-muted-foreground mt-0.5">
                                  {statusDisplay.description}
                                </p>
                                {leadLawyer?.profile && (
                                  <p className="text-xs text-muted-foreground mt-2">
                                    Abogado: {leadLawyer.profile.first_name} {leadLawyer.profile.last_name}
                                  </p>
                                )}
                              </div>
                            </div>
                            <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-3" />
                          </div>
                        </CardContent>
                      </Link>
                    </Card>
                  )
                })}
              </div>
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted mb-4">
                    <Briefcase className="h-7 w-7 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-medium">No hay casos registrados</h3>
                  <p className="text-sm text-muted-foreground mt-1 max-w-xs">
                    Cuando tenga casos activos con nuestro estudio, aparecerán aquí.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Recent Documents */}
          {recentDocuments && recentDocuments.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Documentos Recientes</h2>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/portal/documentos" className="gap-1">
                    Ver todos
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
              
              <Card>
                <CardContent className="p-4">
                  <div className="space-y-2">
                    {recentDocuments.map((doc) => (
                      <div 
                        key={doc.id}
                        className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted flex-shrink-0">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{doc.file_name}</p>
                            <p className="text-xs text-muted-foreground">
                              {doc.case?.case_number} • {new Date(doc.created_at).toLocaleDateString('es-AR')}
                            </p>
                          </div>
                        </div>
                        <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0">
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Upcoming Dates */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Calendar className="h-5 w-5 text-primary" />
                Próximas Fechas
              </CardTitle>
              <CardDescription>
                Eventos importantes de sus casos
              </CardDescription>
            </CardHeader>
            <CardContent>
              {upcomingDeadlines && upcomingDeadlines.length > 0 ? (
                <div className="space-y-4">
                  {upcomingDeadlines.map((deadline) => {
                    const daysUntil = Math.ceil(
                      (new Date(deadline.due_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
                    )
                    const isUrgent = daysUntil <= 3

                    return (
                      <div 
                        key={deadline.id}
                        className={`
                          p-3 rounded-lg border
                          ${isUrgent 
                            ? 'bg-destructive/5 border-destructive/20' 
                            : 'bg-muted/50 border-border'
                          }
                        `}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`
                            flex h-9 w-9 items-center justify-center rounded-lg flex-shrink-0
                            ${isUrgent 
                              ? 'bg-destructive/10 text-destructive' 
                              : 'bg-primary/10 text-primary'
                            }
                          `}>
                            <Calendar className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <p className={`text-sm font-medium ${isUrgent ? 'text-destructive' : 'text-foreground'}`}>
                              {formatFriendlyDate(deadline.due_date)}
                            </p>
                            <p className="text-sm text-foreground mt-0.5 truncate">
                              {deadline.title}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {deadline.case?.case_number}
                            </p>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="text-center py-6">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted mx-auto mb-3">
                    <CheckCircle2 className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    No hay fechas próximas programadas
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Updates */}
          {recentUpdates && recentUpdates.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Bell className="h-5 w-5 text-primary" />
                  Actualizaciones
                </CardTitle>
                <CardDescription>
                  Novedades de sus casos
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {recentUpdates.map((update) => (
                    <div 
                      key={update.id}
                      className="pb-3 border-b border-border last:border-0 last:pb-0"
                    >
                      <p className="text-sm">{update.description}</p>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        <span>{update.case?.case_number}</span>
                        <span>•</span>
                        <span>
                          {new Date(update.created_at).toLocaleDateString('es-AR')}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Help Card */}
          <Card className="bg-muted/50">
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-background mx-auto mb-3">
                  <Scale className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-medium">¿Tiene preguntas?</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Estamos aquí para ayudarle
                </p>
                <Button variant="outline" size="sm" className="mt-4 bg-transparent" asChild>
                  <Link href="/portal/ayuda">
                    Ver información de contacto
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
