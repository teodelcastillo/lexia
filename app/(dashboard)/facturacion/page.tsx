import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Plus, FileText, Receipt, Clock, CheckCircle2 } from 'lucide-react'
import { billingItemStatusConfig, invoiceStatusConfig } from '@/lib/types'

export const metadata = {
  title: 'Facturación',
  description: 'Gestión de facturación y conceptos a cobrar',
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

  if (profile?.system_role === 'client') redirect('/portal')
  return { user, profile }
}

export default async function FacturacionPage() {
  const { profile } = await validateAccess()
  const supabase = await createClient()
  const canManage = ['admin_general', 'case_leader'].includes(profile?.system_role || '')

  const { data: pendingItems, count: pendingCount } = await supabase
    .from('billing_items')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'draft')

  const { data: approvedItems, count: approvedCount } = await supabase
    .from('billing_items')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'approved')

  const { data: recentInvoices } = await supabase
    .from('invoices')
    .select(`
      *,
      people:client_id(first_name, last_name, company_name, client_type),
      companies:company_id(company_name)
    `)
    .order('created_at', { ascending: false })
    .limit(5)

  const { data: recentItems } = await supabase
    .from('billing_items')
    .select(`
      *,
      people:client_id(first_name, last_name, company_name, client_type),
      cases:case_id(title, case_number)
    `)
    .in('status', ['draft', 'approved'])
    .order('created_at', { ascending: false })
    .limit(10)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Facturación
          </h1>
          <p className="text-sm text-muted-foreground">
            Conceptos pendientes, facturas emitidas y acuerdos de honorarios
          </p>
        </div>
        {canManage && (
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href="/facturacion/items/nuevo">
                <Plus className="mr-2 h-4 w-4" />
                Nuevo Concepto
              </Link>
            </Button>
            <Button asChild>
              <Link href="/facturacion/facturas/nueva">
                <FileText className="mr-2 h-4 w-4" />
                Nueva Factura
              </Link>
            </Button>
          </div>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conceptos Borrador</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingCount ?? 0}</div>
            <p className="text-xs text-muted-foreground">Pendientes de aprobación</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conceptos Aprobados</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{approvedCount ?? 0}</div>
            <p className="text-xs text-muted-foreground">Listos para facturar</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Acuerdos</CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <Link href="/facturacion/acuerdos" className="text-2xl font-bold hover:underline">
              Ver todos
            </Link>
            <p className="text-xs text-muted-foreground">Acuerdos de honorarios</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Facturas</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <Link href="/facturacion/facturas" className="text-2xl font-bold hover:underline">
              Ver todas
            </Link>
            <p className="text-xs text-muted-foreground">Historial de facturas</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Billing Items */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Conceptos Pendientes</CardTitle>
              <CardDescription>Últimos conceptos cargados pendientes de facturación</CardDescription>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href="/facturacion/items">Ver todos</Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {recentItems && recentItems.length > 0 ? (
            <div className="space-y-3">
              {recentItems.map((item: any) => {
                const statusCfg = billingItemStatusConfig[item.status as keyof typeof billingItemStatusConfig]
                const clientName = item.people?.client_type === 'company'
                  ? item.people?.company_name
                  : `${item.people?.first_name} ${item.people?.last_name}`
                return (
                  <div key={item.id} className="flex items-center justify-between rounded-lg border p-3">
                    <div className="space-y-1">
                      <p className="text-sm font-medium">{item.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {clientName}
                        {item.cases && ` · ${item.cases.case_number}`}
                        {item.period && ` · ${item.period}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium">
                        ${item.line_total?.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </span>
                      <Badge variant="outline" className={`${statusCfg?.bgColor} ${statusCfg?.color} border-0`}>
                        {statusCfg?.label}
                      </Badge>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">
              No hay conceptos pendientes
            </p>
          )}
        </CardContent>
      </Card>

      {/* Recent Invoices */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Últimas Facturas</CardTitle>
              <CardDescription>Facturas emitidas recientemente</CardDescription>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href="/facturacion/facturas">Ver todas</Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {recentInvoices && recentInvoices.length > 0 ? (
            <div className="space-y-3">
              {recentInvoices.map((invoice: any) => {
                const statusCfg = invoiceStatusConfig[invoice.status as keyof typeof invoiceStatusConfig]
                const clientName = invoice.companies?.company_name
                  || (invoice.people?.client_type === 'company'
                    ? invoice.people?.company_name
                    : `${invoice.people?.first_name} ${invoice.people?.last_name}`)
                return (
                  <Link
                    key={invoice.id}
                    href={`/facturacion/facturas/${invoice.id}`}
                    className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50 transition-colors"
                  >
                    <div className="space-y-1">
                      <p className="text-sm font-medium">{invoice.invoice_number}</p>
                      <p className="text-xs text-muted-foreground">
                        {clientName} · {invoice.issue_date}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium">
                        ${invoice.total?.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </span>
                      <Badge variant="outline" className={`${statusCfg?.bgColor} ${statusCfg?.color} border-0`}>
                        {statusCfg?.label}
                      </Badge>
                    </div>
                  </Link>
                )
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">
              No hay facturas emitidas aún
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
