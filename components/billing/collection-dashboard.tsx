'use client'

import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { invoiceStatusConfig, paymentMethodConfig } from '@/lib/types'

interface CollectionDashboardProps {
  overdueInvoices: any[]
  accountSummaries: any[]
  recentPayments: any[]
}

export function CollectionDashboard({ overdueInvoices, accountSummaries, recentPayments }: CollectionDashboardProps) {
  const clientsAlDia = accountSummaries.filter(a => (a.balance || 0) <= 0).length
  const clientsConSaldo = accountSummaries.filter(a => (a.balance || 0) > 0 && (a.balance || 0) <= (a.credit_limit || Infinity)).length
  const clientsCriticos = accountSummaries.filter(a => (a.balance || 0) > (a.credit_limit || Infinity)).length

  const totalPendiente = accountSummaries.reduce((sum: number, a: any) => sum + Math.max(a.balance || 0, 0), 0)
  const totalOverdue = overdueInvoices
    .filter(i => i.status === 'overdue')
    .reduce((sum: number, i: any) => sum + (i.total || 0), 0)

  return (
    <div className="space-y-6">
      {/* Traffic Light Summary */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Al Día</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-emerald-600">{clientsAlDia}</div>
            <p className="text-xs text-muted-foreground">clientes sin saldo pendiente</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Con Saldo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-amber-600">{clientsConSaldo}</div>
            <p className="text-xs text-muted-foreground">dentro del límite de crédito</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Críticos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">{clientsCriticos}</div>
            <p className="text-xs text-muted-foreground">exceden límite de crédito</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Pendiente</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${totalPendiente.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
            </div>
            {totalOverdue > 0 && (
              <p className="text-xs text-red-600">
                ${totalOverdue.toLocaleString('es-AR', { minimumFractionDigits: 2 })} vencido
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Overdue Invoices */}
        <Card>
          <CardHeader>
            <CardTitle>Facturas Pendientes de Cobro</CardTitle>
            <CardDescription>{overdueInvoices.length} facturas con saldo</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Factura</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Vence</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {overdueInvoices.length > 0 ? (
                  overdueInvoices.map((invoice: any) => {
                    const statusCfg = invoiceStatusConfig[invoice.status as keyof typeof invoiceStatusConfig]
                    const clientName = invoice.companies?.company_name
                      || (invoice.people?.client_type === 'company'
                        ? invoice.people?.company_name
                        : `${invoice.people?.first_name} ${invoice.people?.last_name}`)

                    const isOverdue = invoice.due_date && new Date(invoice.due_date) < new Date()

                    return (
                      <TableRow key={invoice.id}>
                        <TableCell>
                          <Link href={`/facturacion/facturas/${invoice.id}`} className="font-medium hover:underline">
                            {invoice.invoice_number}
                          </Link>
                        </TableCell>
                        <TableCell className="text-sm">{clientName}</TableCell>
                        <TableCell className={`text-sm ${isOverdue ? 'text-red-600 font-medium' : ''}`}>
                          {invoice.due_date || '-'}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          ${invoice.total?.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`${statusCfg?.bgColor} ${statusCfg?.color} border-0`}>
                            {statusCfg?.label}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    )
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      No hay facturas pendientes
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Recent Payments */}
        <Card>
          <CardHeader>
            <CardTitle>Últimos Pagos Recibidos</CardTitle>
            <CardDescription>Pagos registrados recientemente</CardDescription>
          </CardHeader>
          <CardContent>
            {recentPayments.length > 0 ? (
              <div className="space-y-3">
                {recentPayments.map((payment: any) => {
                  const clientName = payment.companies?.company_name
                    || (payment.people?.client_type === 'company'
                      ? payment.people?.company_name
                      : `${payment.people?.first_name} ${payment.people?.last_name}`)

                  return (
                    <div key={payment.id} className="flex items-center justify-between border-b pb-3 last:border-0">
                      <div>
                        <p className="text-sm font-medium">{clientName}</p>
                        <p className="text-xs text-muted-foreground">
                          {payment.payment_date} ·{' '}
                          {paymentMethodConfig[payment.payment_method]?.label || payment.payment_method}
                          {payment.invoices?.invoice_number && ` · ${payment.invoices.invoice_number}`}
                        </p>
                      </div>
                      <span className="text-sm font-bold text-emerald-600">
                        +${payment.amount?.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">
                No hay pagos recientes
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
