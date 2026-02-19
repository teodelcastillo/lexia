/**
 * Cases Table Component
 * 
 * Server component that displays cases in a table format.
 * Supports filtering and pagination.
 */
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MoreHorizontal, Eye, Edit } from 'lucide-react'
import { EmptyState } from '@/components/shared/empty-state'
import type { CaseStatus } from '@/lib/types'

interface CasesTableProps {
  status?: string
  search?: string
  page: number
}

const ITEMS_PER_PAGE = 10

/**
 * Status badge configuration
 */
const statusConfig: Record<CaseStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  active: { label: 'Activo', variant: 'default' },
  pending: { label: 'Pendiente', variant: 'secondary' },
  on_hold: { label: 'En Espera', variant: 'outline' },
  closed: { label: 'Cerrado', variant: 'secondary' },
  archived: { label: 'Archivado', variant: 'outline' },
}

/**
 * Fetches cases with filters applied
 */
async function getCases(props: CasesTableProps) {
  const supabase = await createClient()
  const offset = (props.page - 1) * ITEMS_PER_PAGE

  // Build query - now uses company_id instead of client_id
  let query = supabase
    .from('cases')
    .select(`
      id,
      case_number,
      title,
      status,
      case_type,
      created_at,
      company_id,
      companies (
        id,
        name
      )
    `, { count: 'exact' })
    .order('updated_at', { ascending: false })
    .range(offset, offset + ITEMS_PER_PAGE - 1)

  // Apply status filter
  if (props.status && props.status !== 'all') {
    query = query.eq('status', props.status)
  }

  // Apply search filter
  if (props.search) {
    query = query.or(`case_number.ilike.%${props.search}%,title.ilike.%${props.search}%`)
  }

  const { data: cases, count, error } = await query

  if (error) {
    console.error('Error fetching cases:', error)
    return { cases: [], total: 0, totalPages: 0 }
  }

  return {
    cases: cases || [],
    total: count || 0,
    totalPages: Math.ceil((count || 0) / ITEMS_PER_PAGE),
  }
}

/**
 * Formats date for display
 */
function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export async function CasesTable(props: CasesTableProps) {
  const { cases, total, totalPages } = await getCases(props)

  if (cases.length === 0) {
    const hasFilters = props.search || props.status
    
    return (
      <div className="rounded-lg border border-dashed border-border">
        <EmptyState
          type={hasFilters ? 'search' : 'cases'}
          title={hasFilters ? 'Sin resultados' : 'No hay casos'}
          description={
            hasFilters
              ? 'No se encontraron casos con los filtros aplicados. Intente ajustar los criterios de búsqueda.'
              : 'Aún no hay casos registrados en el sistema. Comience creando el primer caso.'
          }
          action={
            hasFilters
              ? undefined
              : {
                  label: 'Crear Caso',
                  href: '/casos/nuevo',
                  requiresPermission: true,
                }
          }
          secondaryAction={
            hasFilters
              ? {
                  label: 'Limpiar filtros',
                  href: '/casos',
                }
              : undefined
          }
          size="lg"
        />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Results count */}
      <div className="text-sm text-muted-foreground">
        Mostrando {cases.length} de {total} casos
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-28">Número</TableHead>
              <TableHead>Título</TableHead>
              <TableHead className="hidden md:table-cell">Cliente</TableHead>
              <TableHead className="hidden sm:table-cell">Estado</TableHead>
              <TableHead className="hidden lg:table-cell">Fecha Apertura</TableHead>
              <TableHead className="w-12">
                <span className="sr-only">Acciones</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cases.map((caseItem) => {
              // Company data comes from the Supabase join
              const c = caseItem.companies
              const companyData = (Array.isArray(c) ? c[0] ?? null : c ?? null) as { id: string; name: string } | null
              
              const status = statusConfig[caseItem.status as CaseStatus]

              return (
                <TableRow key={caseItem.id}>
                  <TableCell className="font-medium">
                    <Link 
                      href={`/casos/${caseItem.id}`}
                      className="hover:text-primary hover:underline"
                    >
                      {caseItem.case_number}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <Link 
                        href={`/casos/${caseItem.id}`}
                        className="font-medium hover:text-primary hover:underline line-clamp-1"
                      >
                        {caseItem.title}
                      </Link>
                      <span className="text-xs text-muted-foreground line-clamp-1">
                        {caseItem.case_type}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {companyData?.name ? (
                      <Link 
                        href={`/empresas/${companyData.id}`}
                        className="text-sm hover:text-primary hover:underline"
                      >
                        {companyData.name}
                      </Link>
                    ) : (
                      <span className="text-sm text-muted-foreground">Sin empresa</span>
                    )}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <Badge variant={status.variant}>{status.label}</Badge>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                    {formatDate(caseItem.created_at)}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">Abrir menú</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/casos/${caseItem.id}`} className="flex items-center">
                            <Eye className="mr-2 h-4 w-4" />
                            Ver Detalle
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href={`/casos/${caseItem.id}/editar`} className="flex items-center">
                            <Edit className="mr-2 h-4 w-4" />
                            Editar
                          </Link>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Página {props.page} de {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={props.page <= 1}
              asChild={props.page > 1}
            >
              {props.page > 1 ? (
                <Link 
                  href={`/casos?page=${props.page - 1}${props.status ? `&status=${props.status}` : ''}${props.search ? `&search=${props.search}` : ''}`}
                >
                  Anterior
                </Link>
              ) : (
                'Anterior'
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={props.page >= totalPages}
              asChild={props.page < totalPages}
            >
              {props.page < totalPages ? (
                <Link 
                  href={`/casos?page=${props.page + 1}${props.status ? `&status=${props.status}` : ''}${props.search ? `&search=${props.search}` : ''}`}
                >
                  Siguiente
                </Link>
              ) : (
                'Siguiente'
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
