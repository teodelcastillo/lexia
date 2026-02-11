/**
 * Company Detail Page
 * 
 * Shows detailed information about a company including:
 * - General information (name, CUIT, contact)
 * - Associated people/members
 * - Related cases
 * - Internal notes
 */
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { 
  ArrowLeft, 
  Building2, 
  Mail, 
  Phone, 
  MapPin, 
  Edit,
  Briefcase,
  Users,
  FileText,
  Plus,
  User,
  ExternalLink,
} from 'lucide-react'

interface CompanyDetailPageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: CompanyDetailPageProps) {
  const { id } = await params
  const supabase = await createClient()
  
  const { data: company } = await supabase
    .from('companies')
    .select('name')
    .eq('id', id)
    .single()

  return {
    title: company?.name || 'Empresa',
    description: `Detalles de ${company?.name}`,
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

export default async function CompanyDetailPage({ params }: CompanyDetailPageProps) {
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

  // Fetch company data
  const { data: company, error } = await supabase
    .from('companies')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !company) {
    notFound()
  }

  // Fetch associated people
  const { data: people } = await supabase
    .from('people')
    .select('*')
    .eq('company_id', id)
    .eq('is_active', true)
    .order('name')

  // Fetch related cases
  const { data: cases } = await supabase
    .from('cases')
    .select('id, case_number, title, status, priority, case_type, opened_at')
    .eq('company_id', id)
    .order('created_at', { ascending: false })

  const canEdit = ['admin_general', 'case_leader'].includes(profile?.system_role || '')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/companias">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-chart-2/10">
              <Building2 className="h-6 w-6 text-chart-2" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                {company.company_name || company.name || 'Sin nombre'}
              </h1>
              <div className="mt-1">
                <Badge variant="outline" className="text-xs">
                  {company.company_type === 'supplier' ? 'Proveedor' : 'Cliente'}
                </Badge>
              </div>
            </div>
          </div>
        </div>
        {canEdit && (
          <Button variant="outline" asChild>
            <Link href={`/empresas/${id}/editar`}>
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
              <p className="text-2xl font-semibold">{cases?.length || 0}</p>
              <p className="text-sm text-muted-foreground">Casos</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-chart-2/10">
              <Users className="h-5 w-5 text-chart-2" />
            </div>
            <div>
              <p className="text-2xl font-semibold">{people?.length || 0}</p>
              <p className="text-sm text-muted-foreground">Personas</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10">
              <FileText className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-semibold">
                {cases?.filter(c => c.status === 'active').length || 0}
              </p>
              <p className="text-sm text-muted-foreground">Casos Activos</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="info" className="space-y-4">
        <TabsList>
          <TabsTrigger value="info">Información</TabsTrigger>
          <TabsTrigger value="people">Personas ({people?.length || 0})</TabsTrigger>
          <TabsTrigger value="cases">Casos ({cases?.length || 0})</TabsTrigger>
        </TabsList>

        {/* Info Tab */}
        <TabsContent value="info" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Datos Fiscales</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {company.cuit && (
                  <div>
                    <p className="text-xs text-muted-foreground">CUIT</p>
                    <p className="text-sm font-medium">{company.cuit}</p>
                  </div>
                )}
                {company.legal_name && (
                  <div>
                    <p className="text-xs text-muted-foreground">Razón Social</p>
                    <p className="text-sm font-medium">{company.legal_name}</p>
                  </div>
                )}
                {company.tax_category && (
                  <div>
                    <p className="text-xs text-muted-foreground">Categoría Fiscal</p>
                    <p className="text-sm font-medium">{company.tax_category}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Contacto</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {company.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <a href={`mailto:${company.email}`} className="text-sm hover:underline">
                      {company.email}
                    </a>
                  </div>
                )}
                {company.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <a href={`tel:${company.phone}`} className="text-sm hover:underline">
                      {company.phone}
                    </a>
                  </div>
                )}
                {(company.address || company.city || company.province) && (
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div className="text-sm">
                      {company.address && <p>{company.address}</p>}
                      <p>{[company.city, company.province, company.postal_code].filter(Boolean).join(', ')}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {company.notes && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Notas</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{company.notes}</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* People Tab */}
        <TabsContent value="people" className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">
              Personas vinculadas a esta empresa
            </p>
            {canEdit && (
              <Button size="sm" asChild>
                <Link href={`/personas/nueva?company_id=${id}`}>
                  <Plus className="mr-2 h-4 w-4" />
                  Agregar Persona
                </Link>
              </Button>
            )}
          </div>
          
          {people && people.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {people.map((person) => (
                <Link key={person.id} href={`/personas/${person.id}`}>
                  <Card className="hover:border-primary/50 transition-colors">
                    <CardContent className="flex items-center gap-3 p-4">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {person.name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{person.name}</p>
                        <div className="flex gap-1 mt-1">
                          <Badge variant="outline" className="h-5 text-[10px]">
                            {personTypeLabels[person.person_type] || 'Otro'}
                          </Badge>
                          {person.company_role && (
                            <Badge variant="secondary" className="h-5 text-[10px]">
                              {companyRoleLabels[person.company_role] || person.company_role}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <ExternalLink className="h-4 w-4 text-muted-foreground" />
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          ) : (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-8">
                <Users className="h-10 w-10 text-muted-foreground/50 mb-2" />
                <p className="text-sm text-muted-foreground">No hay personas vinculadas</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Cases Tab */}
        <TabsContent value="cases" className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">
              Casos relacionados a esta empresa
            </p>
            {canEdit && (
              <Button size="sm" asChild>
                <Link href={`/casos/nuevo?company_id=${id}`}>
                  <Plus className="mr-2 h-4 w-4" />
                  Nuevo Caso
                </Link>
              </Button>
            )}
          </div>
          
          {cases && cases.length > 0 ? (
            <div className="space-y-2">
              {cases.map((caseItem) => (
                <Link key={caseItem.id} href={`/casos/${caseItem.id}`}>
                  <Card className="hover:border-primary/50 transition-colors">
                    <CardContent className="flex items-center gap-4 p-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                        <Briefcase className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium truncate">{caseItem.title}</p>
                          <Badge variant={caseItem.status === 'active' ? 'default' : 'secondary'} className="h-5 text-[10px]">
                            {caseItem.status === 'active' ? 'Activo' : 
                             caseItem.status === 'pending' ? 'Pendiente' : 
                             caseItem.status === 'closed' ? 'Cerrado' : caseItem.status}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {caseItem.case_number} • {caseItem.case_type}
                        </p>
                      </div>
                      <ExternalLink className="h-4 w-4 text-muted-foreground" />
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          ) : (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-8">
                <Briefcase className="h-10 w-10 text-muted-foreground/50 mb-2" />
                <p className="text-sm text-muted-foreground">No hay casos relacionados</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
