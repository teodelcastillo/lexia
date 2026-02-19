/**
 * Client Profile Page
 * 
 * Detailed view of a single client with:
 * - General information
 * - Linked cases (with quick access)
 * - Shared documents
 * - Internal notes (not visible to client)
 */
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  ArrowLeft, 
  Building2, 
  User, 
  Mail, 
  Phone, 
  MapPin,
  FileText,
  Briefcase,
  MessageSquare,
  Edit,
  ExternalLink,
  Calendar,
  Clock,
  AlertCircle,
  CheckCircle2,
  Pause,
  Archive,
} from 'lucide-react'
import { ClientInfoCard } from '@/components/clients/client-info-card'
import { ClientCasesList } from '@/components/clients/client-cases-list'
import { ClientDocuments } from '@/components/clients/client-documents'
import { ClientNotes } from '@/components/clients/client-notes'
import type { CaseStatus } from '@/lib/types'

export const metadata = {
  title: 'Perfil de Cliente',
  description: 'Información detallada del cliente',
}

interface ClientProfilePageProps {
  params: Promise<{ id: string }>
}

/**
 * Validates user access and returns profile
 */
async function validateAccess() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, system_role, first_name, last_name')
    .eq('id', user.id)
    .single()

  if (profile?.system_role === 'client') {
    redirect('/portal')
  }

  return { user, profile }
}

/**
 * Fetches client with all related data
 */
async function getClientWithRelations(clientId: string) {
  const supabase = await createClient()

  // Fetch person basic info (this is a person detail page, not company)
  const { data: client, error: clientError } = await supabase
    .from('people')
    .select('*')
    .eq('id', clientId)
    .eq('person_type', 'client')
    .single()

  if (clientError || !client) {
    return null
  }

  // Fetch linked cases with assignments
  const { data: cases } = await supabase
    .from('cases')
    .select(`
      id,
      case_number,
      title,
      status,
      case_type,
      opened_at,
      case_assignments (
        user_id,
        case_role,
        profiles:user_id (
          first_name,
          last_name
        )
      )
    `)
    .order('opened_at', { ascending: false })

  // Fetch documents shared with client (from all their cases)
  const caseIds = cases?.map(c => c.id) || []
  let documents: Array<{
    id: string
    name: string
    file_type: string | null
    file_size: number | null
    is_visible_to_client: boolean
    created_at: string
    case_id: string
    cases: { case_number: string; title: string } | null
  }> = []
  
  if (caseIds.length > 0) {
    const { data: docs } = await supabase
      .from('documents')
      .select(`
        id,
        name,
        file_type,
        file_size,
        is_visible_to_client,
        created_at,
        case_id,
        cases:case_id (
          case_number,
          title
        )
      `)
      .in('case_id', caseIds)
      .eq('is_visible_to_client', true)
      .order('created_at', { ascending: false })
      .limit(10)

    // Normalize: Supabase may return cases relation as object or array
    const raw = docs ?? []
    documents = raw.map((row: (typeof raw)[number]) => {
      const casesRel = row.cases
      const caseData = Array.isArray(casesRel) ? casesRel[0] ?? null : casesRel ?? null
      return { ...row, cases: caseData }
    })
  }

  // Fetch internal notes about this client
  const { data: notes } = await supabase
    .from('case_notes')
    .select(`
      id,
      content,
      created_at,
      is_private,
      profiles:created_by (
        first_name,
        last_name
      )
    `)
    .in('case_id', caseIds)
    .eq('is_private', true)
    .order('created_at', { ascending: false })
    .limit(20)

  return {
    client,
    cases: cases || [],
    documents,
    notes: notes || [],
  }
}

export default async function ClientProfilePage({ params }: ClientProfilePageProps) {
  const { profile } = await validateAccess()
  const { id } = await params
  
  const data = await getClientWithRelations(id)
  
  if (!data) {
    notFound()
  }

  const { client, cases, documents, notes } = data
  const isCompany = client.client_type === 'company'
  const canEdit = ['admin_general', 'case_leader'].includes(profile?.system_role || '')

  // Calculate case statistics
  const caseStats = {
    total: cases.length,
    active: cases.filter(c => c.status === 'active').length,
    pending: cases.filter(c => c.status === 'pending').length,
    closed: cases.filter(c => c.status === 'closed').length,
  }

  return (
    <div className="space-y-6">
      {/* Header with back button */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <Button variant="ghost" size="icon" asChild className="shrink-0 mt-1">
            <Link href="/clientes">
              <ArrowLeft className="h-4 w-4" />
              <span className="sr-only">Volver a clientes</span>
            </Link>
          </Button>
          
          <div className="flex items-start gap-4">
            {/* Client icon */}
            <div className={`flex h-14 w-14 items-center justify-center rounded-xl ${
              isCompany ? 'bg-chart-2/10' : 'bg-primary/10'
            }`}>
              {isCompany ? (
                <Building2 className="h-7 w-7 text-chart-2" />
              ) : (
                <User className="h-7 w-7 text-primary" />
              )}
            </div>
            
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                  {client.name}
                </h1>
                <Badge variant="outline">
                  {isCompany ? 'Empresa' : 'Persona'}
                </Badge>
                {!client.is_active && (
                  <Badge variant="destructive">Inactivo</Badge>
                )}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {client.tax_id && `CUIT/CUIL: ${client.tax_id}`}
                {client.tax_id && client.email && ' · '}
                {client.email}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {profile?.system_role === 'admin_general' && client.portal_user_id && (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/portal?as=${client.portal_user_id}`} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" />
                Ver portal como este cliente
              </Link>
            </Button>
          )}
          {canEdit && (
            <Button variant="outline" asChild>
              <Link href={`/clientes/${id}/editar`}>
                <Edit className="mr-2 h-4 w-4" />
                Editar Cliente
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Quick stats for cases */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
        <Card className="border-border/60">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                <Briefcase className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-semibold text-foreground">{caseStats.total}</p>
                <p className="text-xs text-muted-foreground">Total Casos</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-border/60">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-chart-1/10">
                <CheckCircle2 className="h-4 w-4 text-chart-1" />
              </div>
              <div>
                <p className="text-2xl font-semibold text-foreground">{caseStats.active}</p>
                <p className="text-xs text-muted-foreground">Activos</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-border/60">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-chart-4/10">
                <Clock className="h-4 w-4 text-chart-4" />
              </div>
              <div>
                <p className="text-2xl font-semibold text-foreground">{caseStats.pending}</p>
                <p className="text-xs text-muted-foreground">Pendientes</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-border/60">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                <Archive className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-2xl font-semibold text-foreground">{caseStats.closed}</p>
                <p className="text-xs text-muted-foreground">Cerrados</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main content with tabs */}
      <Tabs defaultValue="info" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
          <TabsTrigger value="info" className="gap-2">
            <User className="h-4 w-4 hidden sm:inline" />
            Información
          </TabsTrigger>
          <TabsTrigger value="cases" className="gap-2">
            <Briefcase className="h-4 w-4 hidden sm:inline" />
            Casos ({caseStats.total})
          </TabsTrigger>
          <TabsTrigger value="documents" className="gap-2">
            <FileText className="h-4 w-4 hidden sm:inline" />
            Documentos
          </TabsTrigger>
          <TabsTrigger value="notes" className="gap-2">
            <MessageSquare className="h-4 w-4 hidden sm:inline" />
            Notas
          </TabsTrigger>
        </TabsList>

        {/* General Information Tab */}
        <TabsContent value="info" className="space-y-4">
          <ClientInfoCard client={client} />
        </TabsContent>

        {/* Cases Tab */}
        <TabsContent value="cases" className="space-y-4">
          <ClientCasesList cases={cases} clientId={id} />
        </TabsContent>

        {/* Documents Tab */}
        <TabsContent value="documents" className="space-y-4">
          <ClientDocuments documents={documents} clientId={id} />
        </TabsContent>

        {/* Internal Notes Tab */}
        <TabsContent value="notes" className="space-y-4">
          <ClientNotes notes={notes} clientId={id} userRole={profile?.system_role || 'case_leader'} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
