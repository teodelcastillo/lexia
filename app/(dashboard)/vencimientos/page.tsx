/**
 * Deadlines Management Page
 * 
 * Centralized view for all legal deadlines and due dates.
 * Provides filtering, priority indicators, and quick actions.
 */
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Clock,
  Plus,
  Search,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Briefcase,
  MoreHorizontal,
  Bell,
} from 'lucide-react'
import Link from 'next/link'
import { Suspense } from 'react'
import Loading from './loading'

export const metadata = {
  title: 'Vencimientos',
  description: 'Gestión de vencimientos y plazos legales',
}

interface DeadlinesPageProps {
  searchParams: Promise<{
    status?: string
    type?: string
    search?: string
  }>
}

/** Calculates days until deadline and returns status */
function getDeadlineStatus(dueDate: string): {
  label: string
  variant: 'destructive' | 'outline' | 'secondary' | 'default'
  daysText: string
} {
  const now = new Date()
  const due = new Date(dueDate)
  const diffTime = due.getTime() - now.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

  if (diffDays < 0) {
    return {
      label: 'Vencido',
      variant: 'destructive',
      daysText: `${Math.abs(diffDays)} días de atraso`,
    }
  } else if (diffDays === 0) {
    return {
      label: 'Hoy',
      variant: 'destructive',
      daysText: 'Vence hoy',
    }
  } else if (diffDays <= 3) {
    return {
      label: 'Urgente',
      variant: 'outline',
      daysText: `${diffDays} día${diffDays > 1 ? 's' : ''}`,
    }
  } else if (diffDays <= 7) {
    return {
      label: 'Esta semana',
      variant: 'secondary',
      daysText: `${diffDays} días`,
    }
  } else {
    return {
      label: 'Pendiente',
      variant: 'default',
      daysText: `${diffDays} días`,
    }
  }
}

/** Maps deadline type to label */
function getDeadlineTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    legal: 'Legal',
    judicial: 'Judicial',
    administrative: 'Administrativo',
    internal: 'Interno',
    hearing: 'Audiencia',
  }
  return labels[type] || type
}

export default async function DeadlinesPage({ searchParams }: DeadlinesPageProps) {
  const supabase = await createClient()
  const params = await searchParams
  
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

  // Build query with filters
  let query = supabase
    .from('deadlines')
    .select(`
      *,
      case:cases(id, case_number, title, companies(id, company_name, name)),
      assigned_to_user:profiles!deadlines_assigned_to_fkey(id, first_name, last_name)
    `)
    .order('due_date', { ascending: true })

  if (params.status === 'overdue') {
    query = query.lt('due_date', new Date().toISOString())
    query = query.eq('status', 'pending')
  } else if (params.status === 'completed') {
    query = query.eq('status', 'completed')
  } else if (params.status !== 'all') {
    query = query.eq('status', 'pending')
    query = query.gte('due_date', new Date().toISOString())
  }

  if (params.type && params.type !== 'all') {
    query = query.eq('deadline_type', params.type)
  }

  if (params.search) {
    query = query.ilike('title', `%${params.search}%`)
  }

  const { data: deadlines } = await query.limit(100)

  // Calculate summary stats
  const now = new Date()
  const stats = {
    overdue: deadlines?.filter(d => 
      d.status === 'pending' && new Date(d.due_date) < now
    ).length || 0,
    today: deadlines?.filter(d => {
      const due = new Date(d.due_date)
      return d.status === 'pending' && 
        due.getDate() === now.getDate() && 
        due.getMonth() === now.getMonth() && 
        due.getFullYear() === now.getFullYear()
    }).length || 0,
    thisWeek: deadlines?.filter(d => {
      const due = new Date(d.due_date)
      const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      return d.status === 'pending' && diffDays > 0 && diffDays <= 7
    }).length || 0,
    total: deadlines?.filter(d => d.status === 'pending').length || 0,
  }

  return (
    <Suspense fallback={<Loading />}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Vencimientos
            </h1>
            <p className="text-sm text-muted-foreground">
              Controle los plazos y vencimientos de sus casos
            </p>
          </div>
          
          <Button asChild>
            <Link href="/vencimientos/nuevo">
              <Plus className="mr-2 h-4 w-4" />
              Nuevo Vencimiento
            </Link>
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className={stats.overdue > 0 ? 'border-destructive' : ''}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className={`
                  flex h-12 w-12 items-center justify-center rounded-lg
                  ${stats.overdue > 0 ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground'}
                `}>
                  <AlertTriangle className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Vencidos</p>
                  <p className={`text-2xl font-bold ${stats.overdue > 0 ? 'text-destructive' : ''}`}>
                    {stats.overdue}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className={stats.today > 0 ? 'border-amber-500' : ''}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className={`
                  flex h-12 w-12 items-center justify-center rounded-lg
                  ${stats.today > 0 ? 'bg-amber-500/10 text-amber-500' : 'bg-muted text-muted-foreground'}
                `}>
                  <Bell className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Hoy</p>
                  <p className={`text-2xl font-bold ${stats.today > 0 ? 'text-amber-500' : ''}`}>
                    {stats.today}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Calendar className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Esta semana</p>
                  <p className="text-2xl font-bold">{stats.thisWeek}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <Clock className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total pendientes</p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar vencimientos..."
                  className="pl-9"
                  defaultValue={params.search}
                />
              </div>
              
              <Select defaultValue={params.status || 'pending'}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pendientes</SelectItem>
                  <SelectItem value="overdue">Vencidos</SelectItem>
                  <SelectItem value="completed">Completados</SelectItem>
                  <SelectItem value="all">Todos</SelectItem>
                </SelectContent>
              </Select>

              <Select defaultValue={params.type || 'all'}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los tipos</SelectItem>
                  <SelectItem value="legal">Legal</SelectItem>
                  <SelectItem value="judicial">Judicial</SelectItem>
                  <SelectItem value="administrative">Administrativo</SelectItem>
                  <SelectItem value="internal">Interno</SelectItem>
                  <SelectItem value="hearing">Audiencia</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Deadlines Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="h-5 w-5" />
              Lista de Vencimientos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vencimiento</TableHead>
                  <TableHead>Caso</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Asignado a</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deadlines && deadlines.length > 0 ? (
                  deadlines.map((deadline) => {
                    const status = getDeadlineStatus(deadline.due_date)
                    
                    return (
                      <TableRow key={deadline.id}>
                        <TableCell>
                          <div className="font-medium">{deadline.title}</div>
                          {deadline.description && (
                            <div className="text-sm text-muted-foreground truncate max-w-[200px]">
                              {deadline.description}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {deadline.case ? (
                            <Link 
                              href={`/casos/${deadline.case.id}`}
                              className="text-primary hover:underline font-medium"
                            >
                              {deadline.case.case_number}
                            </Link>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {(() => {
                            const company = deadline.case?.companies as { company_name?: string; name?: string } | null
                            return company?.company_name || company?.name || '-'
                          })()}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {getDeadlineTypeLabel(deadline.deadline_type || 'legal')}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">
                              {new Date(deadline.due_date).toLocaleDateString('es-AR', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                              })}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {status.daysText}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={status.variant}>
                            {deadline.status === 'completed' ? (
                              <span className="flex items-center gap-1">
                                <CheckCircle2 className="h-3 w-3" />
                                Completado
                              </span>
                            ) : (
                              status.label
                            )}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {deadline.assigned_to_user ? (
                            <span className="text-sm">
                              {deadline.assigned_to_user.first_name} {deadline.assigned_to_user.last_name}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {deadline.status !== 'completed' && (
                              <Button variant="ghost" size="sm">
                                <CheckCircle2 className="h-4 w-4" />
                                <span className="sr-only">Marcar completado</span>
                              </Button>
                            )}
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                              <span className="sr-only">Más opciones</span>
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={8} className="h-24 text-center">
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <Clock className="h-8 w-8" />
                        <p>No se encontraron vencimientos</p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </Suspense>
  )
}
