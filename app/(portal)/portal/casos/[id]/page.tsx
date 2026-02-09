/**
 * Client Portal - Case Detail Page
 * 
 * Read-only view of case details for clients.
 * Shows limited information based on what's shared with the client.
 */
import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { getEffectivePortalUserId } from '@/lib/portal/view-as'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  ArrowLeft,
  Briefcase,
  Calendar,
  FileText,
  Clock,
  User,
  Download,
  Eye,
  Scale,
  CheckCircle2,
} from 'lucide-react'
import Link from 'next/link'

interface PortalCasePageProps {
  params: Promise<{ id: string }>
}

/** Maps case status to display properties */
function getStatusDisplay(status: string): { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' } {
  const statusMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    active: { label: 'Activo', variant: 'default' },
    pending: { label: 'Pendiente', variant: 'secondary' },
    on_hold: { label: 'En espera', variant: 'outline' },
    closed: { label: 'Cerrado', variant: 'secondary' },
    archived: { label: 'Archivado', variant: 'outline' },
  }
  return statusMap[status] || { label: status, variant: 'outline' }
}

export default async function PortalCasePage({ params }: PortalCasePageProps) {
  const { id } = await params
  const supabase = await createClient()
  const effectiveUserId = await getEffectivePortalUserId()
  if (!effectiveUserId) redirect('/auth/portal-login')

  // Get person (client) record linked to this user via portal_user_id
  const { data: person } = await supabase
    .from('people')
    .select('id, company_id')
    .eq('portal_user_id', effectiveUserId)
    .eq('person_type', 'client')
    .single()

  if (!person) {
    redirect('/auth/portal-login')
  }

  // Check if this case belongs to the client via case_participants or company_id
  const { data: participantCase } = await supabase
    .from('case_participants')
    .select('case_id')
    .eq('case_id', id)
    .eq('person_id', person.id)
    .eq('role', 'client_representative')
    .eq('is_active', true)
    .single()

  const { data: companyCase } = person.company_id
    ? await supabase
        .from('cases')
        .select('id')
        .eq('id', id)
        .eq('company_id', person.company_id)
        .single()
    : { data: null }

  // Case must belong to client via one of the methods
  if (!participantCase && !companyCase) {
    notFound()
  }

  // Fetch case details
  const { data: caseData } = await supabase
    .from('cases')
    .select(`
      *,
      case_assignments(
        case_role,
        profiles(id, first_name, last_name, email)
      )
    `)
    .eq('id', id)
    .single()

  if (!caseData) {
    notFound()
  }

  const statusDisplay = getStatusDisplay(caseData.status)

  // Fetch documents shared with client
  const { data: documents } = await supabase
    .from('documents')
    .select('*')
    .eq('case_id', id)
    .eq('is_visible_to_client', true)
    .order('created_at', { ascending: false })

  // Fetch deadlines visible to client
  const { data: deadlines } = await supabase
    .from('deadlines')
    .select('*')
    .eq('case_id', id)
    .eq('is_visible_to_client', true)
    .gte('due_date', new Date().toISOString())
    .order('due_date', { ascending: true })
    .limit(10)

  // Get lead lawyer
  const leadLawyer = caseData.case_assignments?.find(
    (a: { case_role: string }) => a.case_role === 'leader'
  )

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Button variant="ghost" size="sm" asChild>
        <Link href="/portal" className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Volver a mis casos
        </Link>
      </Button>

      {/* Case Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-primary/10 text-primary flex-shrink-0">
            <Scale className="h-7 w-7" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-sm text-muted-foreground">
                {caseData.case_number}
              </span>
              <Badge variant={statusDisplay.variant}>
                {statusDisplay.label}
              </Badge>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight mt-1">
              {caseData.title}
            </h1>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Case Overview */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Briefcase className="h-5 w-5" />
                Información del Caso
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {caseData.description && (
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-1">
                    Descripción
                  </h4>
                  <p className="text-sm">{caseData.description}</p>
                </div>
              )}
              
              <Separator />
              
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-1">
                    Tipo de Caso
                  </h4>
                  <p className="text-sm capitalize">{caseData.case_type}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-1">
                    Fecha de Inicio
                  </h4>
                  <p className="text-sm">
                    {new Date(caseData.created_at).toLocaleDateString('es-AR', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-1">
                    Jurisdicción
                  </h4>
                  <p className="text-sm">{caseData.jurisdiction || 'No especificada'}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-1">
                    Última Actualización
                  </h4>
                  <p className="text-sm">
                    {new Date(caseData.updated_at).toLocaleDateString('es-AR', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Documents */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-5 w-5" />
                Documentos Compartidos
              </CardTitle>
            </CardHeader>
            <CardContent>
              {documents && documents.length > 0 ? (
                <div className="space-y-2">
                  {documents.map((doc) => (
                    <div 
                      key={doc.id}
                      className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">
                            {doc.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(doc.created_at).toLocaleDateString('es-AR')}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <Eye className="h-4 w-4" />
                          <span className="sr-only">Ver</span>
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <Download className="h-4 w-4" />
                          <span className="sr-only">Descargar</span>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-8 w-8 mx-auto mb-2" />
                  <p className="text-sm">No hay documentos compartidos</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Lead Lawyer */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <User className="h-5 w-5" />
                Abogado a Cargo
              </CardTitle>
            </CardHeader>
            <CardContent>
              {leadLawyer?.profile ? (
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary font-medium">
                    {leadLawyer.profile.first_name.charAt(0)}
                    {leadLawyer.profile.last_name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-medium">
                      {leadLawyer.profile.first_name} {leadLawyer.profile.last_name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {leadLawyer.profile.email}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No hay abogado asignado
                </p>
              )}
            </CardContent>
          </Card>

          {/* Upcoming Dates */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Calendar className="h-5 w-5" />
                Próximas Fechas
              </CardTitle>
            </CardHeader>
            <CardContent>
              {deadlines && deadlines.length > 0 ? (
                <div className="space-y-3">
                  {deadlines.map((deadline) => {
                    const dueDate = new Date(deadline.due_date)
                    const isUrgent = (dueDate.getTime() - Date.now()) < 3 * 24 * 60 * 60 * 1000

                    return (
                      <div 
                        key={deadline.id}
                        className="flex gap-3 pb-3 border-b border-border last:border-0 last:pb-0"
                      >
                        <div className={`
                          flex h-9 w-9 items-center justify-center rounded-lg flex-shrink-0
                          ${isUrgent 
                            ? 'bg-destructive/10 text-destructive' 
                            : 'bg-muted text-muted-foreground'
                          }
                        `}>
                          <Clock className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">
                            {deadline.title}
                          </p>
                          <p className={`text-xs ${isUrgent ? 'text-destructive' : 'text-muted-foreground'}`}>
                            {dueDate.toLocaleDateString('es-AR', {
                              weekday: 'long',
                              day: 'numeric',
                              month: 'long',
                            })}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="text-center py-4 text-muted-foreground">
                  <CheckCircle2 className="h-8 w-8 mx-auto mb-2" />
                  <p className="text-sm">No hay fechas próximas</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
