/**
 * Compañías - Listado de empresas con pestañas Clientes y Proveedores
 */
import React from "react"
import { Suspense } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Plus,
  Search,
  Building2,
  Mail,
  Phone,
  MapPin,
  Briefcase,
  Users,
  Package,
} from 'lucide-react'
import { EmptyState } from '@/components/shared/empty-state'

export const metadata = {
  title: 'Compañías',
  description: 'Gestión de empresas clientes y proveedores',
}

type CompanyTypeTab = 'clientes' | 'proveedores'

interface CompaniasPageProps {
  searchParams: Promise<{
    search?: string
    tab?: CompanyTypeTab
  }>
}

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

  return { user, profile }
}

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
      company_type,
      created_at,
      cases:cases(count)
    `)
    .order('company_name', { ascending: true })

  if (search) {
    query = query.or(
      `company_name.ilike.%${search}%,name.ilike.%${search}%,email.ilike.%${search}%,cuit.ilike.%${search}%`
    )
  }

  const { data: companies, error } = await query

  if (error) {
    console.error('Error fetching companies:', error)
    return []
  }

  return companies ?? []
}

function getCasesCount(company: { cases?: unknown }): number {
  const cases = company.cases
  if (cases == null) return 0
  if (Array.isArray(cases) && cases[0] != null && typeof cases[0] === 'object' && 'count' in cases[0]) {
    return Number((cases[0] as { count: number }).count) || 0
  }
  if (typeof cases === 'object' && cases !== null && 'count' in cases) {
    return Number((cases as { count: number }).count) || 0
  }
  return 0
}

function GridSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {[...Array(6)].map((_, i) => (
        <Card key={i} className="border-border/60">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-lg bg-muted animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-3/4 bg-muted rounded animate-pulse" />
                <div className="h-3 w-1/2 bg-muted rounded animate-pulse" />
                <div className="h-3 w-2/3 bg-muted rounded animate-pulse" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

export default async function CompaniasPage({ searchParams }: CompaniasPageProps) {
  const { profile } = await validateAccess()
  const params = await searchParams
  const activeTab = (params.tab === 'proveedores' ? 'proveedores' : 'clientes') as CompanyTypeTab

  const canCreate = ['admin_general', 'case_leader', 'lawyer_executive'].includes(
    profile?.system_role || ''
  )

  const allCompanies = await getCompanies(params.search)
  const clientes = allCompanies.filter(
    (c) => c.company_type === 'client' || c.company_type === null
  )
  const proveedores = allCompanies.filter((c) => c.company_type === 'supplier')

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Compañías
          </h1>
          <p className="text-sm text-muted-foreground">
            Empresas clientes y proveedores del estudio
          </p>
        </div>

        {canCreate && (
          <Button asChild>
            <Link href="/empresas/nueva">
              <Plus className="mr-2 h-4 w-4" />
              Nueva Empresa
            </Link>
          </Button>
        )}
      </div>

      <form className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            name="search"
            placeholder="Buscar por nombre, email o CUIT..."
            className="pl-9"
            defaultValue={params.search}
          />
        </div>
        <input type="hidden" name="tab" value={activeTab} />
        <Button type="submit" variant="secondary">
          Buscar
        </Button>
      </form>

      <Tabs defaultValue={activeTab} className="space-y-4">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="clientes" asChild>
            <Link
              href={`/companias?tab=clientes${params.search ? `&search=${params.search}` : ''}`}
            >
              <Users className="mr-2 h-4 w-4" />
              Clientes ({clientes.length})
            </Link>
          </TabsTrigger>
          <TabsTrigger value="proveedores" asChild>
            <Link
              href={`/companias?tab=proveedores${params.search ? `&search=${params.search}` : ''}`}
            >
              <Package className="mr-2 h-4 w-4" />
              Proveedores ({proveedores.length})
            </Link>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="clientes" className="space-y-4">
          <Suspense fallback={<GridSkeleton />}>
            {clientes.length === 0 ? (
              <EmptyState
                type="companies"
                title="No hay empresas clientes"
                description={
                  params.search
                    ? 'Intente con otros términos de búsqueda'
                    : 'Agregue una nueva empresa como cliente'
                }
                action={
                  !params.search
                    ? {
                        label: 'Nueva Empresa',
                        href: '/empresas/nueva',
                        requiresPermission: true,
                      }
                    : undefined
                }
                hasPermission={canCreate}
              />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {clientes.map((company) => {
                  const casesCount = getCasesCount(company)
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
                                    <Mail className="h-3 w-3 flex-shrink-0" />
                                    <span className="truncate">{company.email}</span>
                                  </div>
                                )}
                                {company.phone && (
                                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                    <Phone className="h-3 w-3 flex-shrink-0" />
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

        <TabsContent value="proveedores" className="space-y-4">
          <Suspense fallback={<GridSkeleton />}>
            {proveedores.length === 0 ? (
              <EmptyState
                type="suppliers"
                title="No hay empresas proveedoras"
                description={
                  params.search
                    ? 'Intente con otros términos de búsqueda'
                    : 'Agregue una empresa y márquela como proveedor'
                }
                action={
                  !params.search
                    ? {
                        label: 'Nueva Empresa',
                        href: '/empresas/nueva',
                        requiresPermission: true,
                      }
                    : undefined
                }
                hasPermission={canCreate}
              />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {proveedores.map((company) => {
                  const casesCount = getCasesCount(company)
                  return (
                    <Link key={company.id} href={`/empresas/${company.id}`}>
                      <Card className="h-full border-border/60 transition-colors hover:border-primary/50 hover:bg-muted/30">
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                              <Package className="h-5 w-5 text-primary" />
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
                                    <Mail className="h-3 w-3 flex-shrink-0" />
                                    <span className="truncate">{company.email}</span>
                                  </div>
                                )}
                                {company.phone && (
                                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                    <Phone className="h-3 w-3 flex-shrink-0" />
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
      </Tabs>
    </div>
  )
}
