/**
 * Person Detail Page
 * 
 * Shows detailed information about a person including:
 * - General information (name, contact, type)
 * - Company association if any
 * - Cases where they participate
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
  User, 
  Mail, 
  Phone, 
  MapPin, 
  Edit,
  Briefcase,
  Building2,
  ExternalLink,
  Calendar,
  FileText,
} from 'lucide-react'

interface PersonDetailPageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: PersonDetailPageProps) {
  const { id } = await params
  const supabase = await createClient()
  
  const { data: person } = await supabase
    .from('people')
    .select('name')
    .eq('id', id)
    .single()

  return {
    title: person?.name || 'Persona',
    description: `Detalles de ${person?.name}`,
  }
}

/**
 * Person type labels in Spanish
 */
const personTypeLabels: Record<string, string> = {
  client: 'Cliente',
  judge: 'Juez',
  opposing_lawyer: 'Abogado Contraparte',
  prosecutor: 'Fiscal',
  witness: 'Testigo',
  expert: 'Perito',
  notary: 'Escribano',
  court_clerk: 'Secretario Judicial',
  other: 'Otro',
}

/**
 * Person type colors for badges
 */
const personTypeColors: Record<string, string> = {
  client: 'bg-primary/10 text-primary border-primary/20',
  judge: 'bg-amber-500/10 text-amber-700 border-amber-500/20',
  opposing_lawyer: 'bg-red-500/10 text-red-700 border-red-500/20',
  prosecutor: 'bg-orange-500/10 text-orange-700 border-orange-500/20',
  witness: 'bg-blue-500/10 text-blue-700 border-blue-500/20',
  expert: 'bg-purple-500/10 text-purple-700 border-purple-500/20',
  notary: 'bg-teal-500/10 text-teal-700 border-teal-500/20',
  court_clerk: 'bg-slate-500/10 text-slate-700 border-slate-500/20',
  other: 'bg-gray-500/10 text-gray-700 border-gray-500/20',
}

/**
 * Company role labels
 */
const companyRoleLabels: Record<string, string> = {
  legal_representative: 'Representante Legal',
  proxy: 'Apoderado',
  contact: 'Contacto',
  shareholder: 'Accionista',
  director: 'Director',
  employee: 'Empleado',
}

/**
 * Participant role labels
 */
const participantRoleLabels: Record<string, string> = {
  responsible: 'Responsable',
  opposing_lawyer: 'Abogado Contraparte',
  judge: 'Juez',
  expert: 'Perito',
  witness: 'Testigo',
  prosecutor: 'Fiscal',
  notary: 'Escribano',
  court_clerk: 'Secretario Judicial',
  interested_party: 'Parte Interesada',
  other: 'Otro',
}

export default async function PersonDetailPage({ params }: PersonDetailPageProps) {
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

  // Fetch person data with company
  const { data: person, error } = await supabase
    .from('people')
    .select(`
      *,
      companies (
        id,
        name,
        cuit
      )
    `)
    .eq('id', id)
    .single()

  if (error || !person) {
    notFound()
  }

  // Fetch cases where this person participates
  const { data: participations } = await supabase
    .from('case_participants')
    .select(`
      id,
      participant_role,
      notes,
      cases (
        id,
        case_number,
        title,
        status,
        case_type
      )
    `)
    .eq('person_id', id)

  const canEdit = ['admin_general', 'case_leader'].includes(profile?.system_role || '')
  const companyData = person.companies as { id: string; name: string; cuit: string } | null
  const personType = person.person_type || 'other'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/clientes?tab=personas">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
              <User className="h-6 w-6 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                  {person.name}
                </h1>
                <Badge 
                  variant="outline" 
                  className={personTypeColors[personType]}
                >
                  {personTypeLabels[personType]}
                </Badge>
              </div>
              {companyData && (
                <Link 
                  href={`/empresas/${companyData.id}`}
                  className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"
                >
                  <Building2 className="h-3 w-3" />
                  {companyData.name}
                </Link>
              )}
            </div>
          </div>
        </div>
        {canEdit && (
          <Button variant="outline" asChild>
            <Link href={`/personas/${id}/editar`}>
              <Edit className="mr-2 h-4 w-4" />
              Editar
            </Link>
          </Button>
        )}
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Briefcase className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-semibold">{participations?.length || 0}</p>
              <p className="text-sm text-muted-foreground">Casos</p>
            </div>
          </CardContent>
        </Card>
        {companyData && (
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-chart-2/10">
                <Building2 className="h-5 w-5 text-chart-2" />
              </div>
              <div>
                <p className="text-sm font-semibold truncate">{companyData.name}</p>
                <p className="text-xs text-muted-foreground">
                  {person.company_role ? companyRoleLabels[person.company_role] : 'Empresa'}
                </p>
              </div>
            </CardContent>
          </Card>
        )}
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10">
              <Calendar className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-sm font-semibold">
                {new Date(person.created_at).toLocaleDateString('es-AR', { 
                  day: 'numeric', 
                  month: 'short', 
                  year: 'numeric' 
                })}
              </p>
              <p className="text-xs text-muted-foreground">Fecha de Alta</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="info" className="space-y-4">
        <TabsList>
          <TabsTrigger value="info">Información</TabsTrigger>
          <TabsTrigger value="cases">Casos ({participations?.length || 0})</TabsTrigger>
        </TabsList>

        {/* Info Tab */}
        <TabsContent value="info" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Datos Personales</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {person.dni && (
                  <div>
                    <p className="text-xs text-muted-foreground">DNI</p>
                    <p className="text-sm font-medium">{person.dni}</p>
                  </div>
                )}
                {person.cuit && (
                  <div>
                    <p className="text-xs text-muted-foreground">CUIT/CUIL</p>
                    <p className="text-sm font-medium">{person.cuit}</p>
                  </div>
                )}
                {person.nationality && (
                  <div>
                    <p className="text-xs text-muted-foreground">Nacionalidad</p>
                    <p className="text-sm font-medium">{person.nationality}</p>
                  </div>
                )}
                {person.occupation && (
                  <div>
                    <p className="text-xs text-muted-foreground">Ocupación</p>
                    <p className="text-sm font-medium">{person.occupation}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Contacto</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {person.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <a href={`mailto:${person.email}`} className="text-sm hover:underline">
                      {person.email}
                    </a>
                  </div>
                )}
                {person.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <a href={`tel:${person.phone}`} className="text-sm hover:underline">
                      {person.phone}
                    </a>
                  </div>
                )}
                {(person.address || person.city || person.province) && (
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div className="text-sm">
                      {person.address && <p>{person.address}</p>}
                      <p>{[person.city, person.province, person.postal_code].filter(Boolean).join(', ')}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {person.notes && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Notas</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{person.notes}</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Cases Tab */}
        <TabsContent value="cases" className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Casos donde esta persona participa
          </p>
          
          {participations && participations.length > 0 ? (
            <div className="space-y-2">
              {participations.map((participation) => {
                const caseData = participation.cases as {
                  id: string
                  case_number: string
                  title: string
                  status: string
                  case_type: string
                } | null
                
                if (!caseData) return null
                
                return (
                  <Link key={participation.id} href={`/casos/${caseData.id}`}>
                    <Card className="hover:border-primary/50 transition-colors">
                      <CardContent className="flex items-center gap-4 p-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                          <Briefcase className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium truncate">{caseData.title}</p>
                            <Badge variant="secondary" className="h-5 text-[10px]">
                              {participantRoleLabels[participation.participant_role] || participation.participant_role}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {caseData.case_number} • {caseData.case_type}
                          </p>
                        </div>
                        <Badge variant={caseData.status === 'active' ? 'default' : 'secondary'} className="h-5 text-[10px]">
                          {caseData.status === 'active' ? 'Activo' : 
                           caseData.status === 'pending' ? 'Pendiente' : 
                           caseData.status === 'closed' ? 'Cerrado' : caseData.status}
                        </Badge>
                        <ExternalLink className="h-4 w-4 text-muted-foreground" />
                      </CardContent>
                    </Card>
                  </Link>
                )
              })}
            </div>
          ) : (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-8">
                <Briefcase className="h-10 w-10 text-muted-foreground/50 mb-2" />
                <p className="text-sm text-muted-foreground">No participa en ningún caso</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
