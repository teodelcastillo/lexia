import React from "react"
/**
 * Clients Module - Main View
 * 
 * Unified view for managing companies (empresas) and people (personas).
 * Provides tabbed navigation between company clients and individual contacts.
 */
import { Suspense } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Plus, 
  Search, 
  Building2, 
  User,
  Mail,
  Phone,
  MapPin,
  Users,
  Briefcase,
} from 'lucide-react'

export const metadata = {
  title: 'Clientes',
  description: 'Gestión de empresas y personas del estudio',
}

interface ClientsPageProps {
  searchParams: Promise<{
    search?: string
    tab?: 'empresas' | 'personas'
  }>
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

  // Admins can view everything, other team members stay on this page
  return { user, profile }
}

/**
 * Fetches companies with case counts
 */
async function getCompanies(search?: string) {
  const supabase = await createClient()

  let query = supabase
    .from('companies')
    .select(`
      id,
      company_name,
      name,
      email,
      phone,
      address,
      created_at,
      cases:cases(count)
    `)
    .order('company_name', { ascending: true })

  if (search) {
    query = query.or(`company_name.ilike.%${search}%,name.ilike.%${search}%,email.ilike.%${search}%`)
  }

  const { data: companies, error } = await query

  if (error) {
    console.error('Error fetching companies:', error)
    return []
  }

  return companies || []
}

/**
 * Fetches people with filters
 */
async function getPeople(search?: string) {
  const supabase = await createClient()

  let query = supabase
    .from('people')
    .select(`
      id,
      name,
      person_type,
      email,
      phone,
      city,
      province,
      is_active,
      company_id,
      company_role,
      created_at,
      companies (
        id,
        name
      )
    `)
    .eq('is_active', true)
    .order('name', { ascending: true })

  if (search) {
    query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,dni.ilike.%${search}%`)
  }

  const { data: people, error } = await query

  if (error) {
    console.error('Error fetching people:', error)
    return []
  }

  return people || []
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

export default async function ClientsPage({ searchParams }: ClientsPageProps) {
  const { profile } = await validateAccess()
  const params = await searchParams
  const activeTab = params.tab || 'empresas'
  
  const canCreate = ['admin_general', 'case_leader', 'lawyer_executive'].includes(profile?.system_role || '')
  
  const [companies, people] = await Promise.all([
    getCompanies(params.search),
    getPeople(params.search),
  ])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Clientes
          </h1>
          <p className="text-sm text-muted-foreground">
            Gestione las empresas y personas relacionadas a su estudio
          </p>
        </div>
        
        {canCreate && (
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href="/personas/nueva">
                <User className="mr-2 h-4 w-4" />
                Nueva Persona
              </Link>
            </Button>
            <Button asChild>
              <Link href="/empresas/nueva">
                <Building2 className="mr-2 h-4 w-4" />
                Nueva Empresa
              </Link>
            </Button>
          </div>
        )}
      </div>

      {/* Search */}
      <form className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            name="search"
            placeholder="Buscar por nombre, email, CUIT o DNI..."
            className="pl-9"
            defaultValue={params.search}
          />
        </div>
        <input type="hidden" name="tab" value={activeTab} />
        <Button type="submit" variant="secondary">
          Buscar
        </Button>
      </form>

      {/* Tabs for Companies and People */}
      <Tabs defaultValue={activeTab} className="space-y-4">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="empresas" asChild>
            <Link href={`/clientes?tab=empresas${params.search ? `&search=${params.search}` : ''}`}>
              <Building2 className="mr-2 h-4 w-4" />
              Empresas ({companies.length})
            </Link>
          </TabsTrigger>
          <TabsTrigger value="personas" asChild>
            <Link href={`/clientes?tab=personas${params.search ? `&search=${params.search}` : ''}`}>
              <Users className="mr-2 h-4 w-4" />
              Personas ({people.length})
            </Link>
          </TabsTrigger>
        </TabsList>

        {/* Companies Tab */}
        <TabsContent value="empresas" className="space-y-4">
          <Suspense fallback={<GridSkeleton />}>
            {companies.length === 0 ? (
              <EmptyState 
                icon={Building2}
                title="No se encontraron empresas"
                description={params.search 
                  ? 'Intente con otros términos de búsqueda' 
                  : 'Comience agregando una nueva empresa cliente'
                }
                action={canCreate && !params.search ? (
                  <Button asChild>
                    <Link href="/empresas/nueva">Agregar Empresa</Link>
                  </Button>
                ) : undefined}
              />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {companies.map((company) => {
                  const casesCount = (company.cases as unknown as { count: number }[])?.[0]?.count || 0

                  return (
                    <Link key={company.id} href={`/empresas/${company.id}`}>
                      <Card className="h-full border-border/60 transition-colors hover:border-primary/50 hover:bg-muted/30">
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-chart-2/10">
                              <Building2 className="h-5 w-5 text-chart-2" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="text-sm font-medium text-foreground truncate">
                                {company.company_name || company.name || 'Sin nombre'}
                              </h3>
                              {company.address && (
                                <p className="text-xs text-muted-foreground truncate">
                                  {company.address}
                                </p>
                              )}

                              <div className="mt-2 space-y-1">
                                {company.email && (
                                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                    <Mail className="h-3 w-3" />
                                    <span className="truncate">{company.email}</span>
                                  </div>
                                )}
                                {company.phone && (
                                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                    <Phone className="h-3 w-3" />
                                    <span>{company.phone}</span>
                                  </div>
                                )}

                              </div>

                              <div className="mt-3 pt-3 border-t border-border flex items-center gap-2">
                                <Briefcase className="h-3 w-3 text-muted-foreground" />
                                <span className="text-xs text-muted-foreground">
                                  {casesCount} {casesCount === 1 ? 'caso' : 'casos'}
                                </span>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  )
                })}
              </div>
            )}
          </Suspense>
        </TabsContent>

        {/* People Tab */}
        <TabsContent value="personas" className="space-y-4">
          <Suspense fallback={<GridSkeleton />}>
            {people.length === 0 ? (
              <EmptyState 
                icon={Users}
                title="No se encontraron personas"
                description={params.search 
                  ? 'Intente con otros términos de búsqueda' 
                  : 'Comience agregando una nueva persona'
                }
                action={canCreate && !params.search ? (
                  <Button asChild>
                    <Link href="/personas/nueva">Agregar Persona</Link>
                  </Button>
                ) : undefined}
              />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {people.map((person) => {
                  const companyData = person.companies as unknown as { id: string; name: string } | null
                  const personType = person.person_type || 'other'

                  return (
                    <Link key={person.id} href={`/personas/${person.id}`}>
                      <Card className="h-full border-border/60 transition-colors hover:border-primary/50 hover:bg-muted/30">
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                              <User className="h-5 w-5 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <h3 className="text-sm font-medium text-foreground truncate">
                                  {person.name}
                                </h3>
                              </div>
                              
                              <div className="flex flex-wrap gap-1 mt-1">
                                <Badge 
                                  variant="outline" 
                                  className={`h-5 text-[10px] ${personTypeColors[personType] || personTypeColors.other}`}
                                >
                                  {personTypeLabels[personType] || 'Otro'}
                                </Badge>
                                {companyData && (
                                  <Badge variant="outline" className="h-5 text-[10px]">
                                    <Building2 className="mr-1 h-2.5 w-2.5" />
                                    {companyData.name}
                                  </Badge>
                                )}
                              </div>

                              <div className="mt-2 space-y-1">
                                {person.email && (
                                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                    <Mail className="h-3 w-3" />
                                    <span className="truncate">{person.email}</span>
                                  </div>
                                )}
                                {person.phone && (
                                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                    <Phone className="h-3 w-3" />
                                    <span>{person.phone}</span>
                                  </div>
                                )}
                                {(person.city || person.province) && (
                                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                    <MapPin className="h-3 w-3" />
                                    <span>{[person.city, person.province].filter(Boolean).join(', ')}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  )
                })}
              </div>
            )}
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  )
}

/**
 * Empty state component
 */
function EmptyState({ 
  icon: Icon, 
  title, 
  description, 
  action 
}: { 
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16">
      <Icon className="mb-4 h-12 w-12 text-muted-foreground/50" />
      <h3 className="text-lg font-medium text-foreground">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

/**
 * Loading skeleton for grid
 */
function GridSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {[...Array(6)].map((_, i) => (
        <Card key={i} className="border-border/60">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Skeleton className="h-10 w-10 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-3 w-2/3" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
