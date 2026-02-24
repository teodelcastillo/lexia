'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ArrowLeft } from 'lucide-react'
import { invoiceStatusConfig, billingItemTypeConfig, paymentMethodConfig } from '@/lib/types'

interface InvoiceDetailProps {
  invoice: any
  items: any[]
  payments: any[]
}

export function InvoiceDetail({ invoice, items, payments }: InvoiceDetailProps) {
  const statusCfg = invoiceStatusConfig[invoice.status as keyof typeof invoiceStatusConfig]

  const clientName = invoice.companies?.company_name
    || (invoice.people?.client_type === 'company'
      ? invoice.people?.company_name
      : `${invoice.people?.first_name} ${invoice.people?.last_name}`)

  const clientDetail = invoice.companies || invoice.people
  const totalPaid = payments.reduce((sum: number, p: any) => sum + (p.amount || 0), 0)
  const remaining = (invoice.total || 0) - totalPaid

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/facturacion/facturas">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Factura {invoice.invoice_number}
          </h1>
          <p className="text-sm text-muted-foreground">
            {clientName} · Emitida {invoice.issue_date}
          </p>
        </div>
        <Badge variant="outline" className={`${statusCfg?.bgColor} ${statusCfg?.color} border-0 text-sm px-3 py-1`}>
          {statusCfg?.label}
        </Badge>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Invoice Info */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Detalle de Factura</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm mb-6">
              <div>
                <p className="text-muted-foreground">Cliente</p>
                <p className="font-medium">{clientName}</p>
                {clientDetail?.email && <p className="text-muted-foreground">{clientDetail.email}</p>}
                {clientDetail?.cuit && <p className="text-muted-foreground">CUIT: {clientDetail.cuit}</p>}
              </div>
              <div>
                <p className="text-muted-foreground">Factura</p>
                <p className="font-medium">{invoice.invoice_number}</p>
                {invoice.period && <p className="text-muted-foreground">Período: {invoice.period}</p>}
              </div>
              <div>
                <p className="text-muted-foreground">Fecha de emisión</p>
                <p className="font-medium">{invoice.issue_date}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Fecha de vencimiento</p>
                <p className="font-medium">{invoice.due_date || 'No definida'}</p>
              </div>
            </div>

            <Separator className="my-4" />

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Concepto</TableHead>
                  <TableHead>Causa</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead className="text-right">Cant.</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item: any) => {
                  const typeCfg = billingItemTypeConfig[item.type as keyof typeof billingItemTypeConfig]
                  return (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.description}</TableCell>
                      <TableCell>{item.cases?.case_number || '-'}</TableCell>
                      <TableCell>{typeCfg?.label || item.type}</TableCell>
                      <TableCell className="text-right">
                        ${item.amount?.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right">{item.quantity}</TableCell>
                      <TableCell className="text-right font-medium">
                        ${item.line_total?.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>

            <div className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{invoice.currency} {invoice.subtotal?.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">IVA ({invoice.tax_rate}%)</span>
                <span>{invoice.currency} {invoice.tax_amount?.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
              </div>
              <Separator />
              <div className="flex justify-between text-lg font-bold">
                <span>Total</span>
                <span>{invoice.currency} {invoice.total?.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>

            {invoice.notes && (
              <div className="mt-4 rounded-lg bg-muted p-3">
                <p className="text-sm text-muted-foreground">{invoice.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payment Summary */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Resumen de Pagos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total factura</span>
                <span className="font-medium">${invoice.total?.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Pagado</span>
                <span className="font-medium text-emerald-600">${totalPaid.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
              </div>
              <Separator />
              <div className="flex justify-between text-sm font-bold">
                <span>Saldo pendiente</span>
                <span className={remaining > 0 ? 'text-amber-600' : 'text-emerald-600'}>
                  ${remaining.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Pagos Registrados</CardTitle>
              <CardDescription>{payments.length} pagos</CardDescription>
            </CardHeader>
            <CardContent>
              {payments.length > 0 ? (
                <div className="space-y-3">
                  {payments.map((payment: any) => (
                    <div key={payment.id} className="flex items-center justify-between text-sm border-b pb-2 last:border-0">
                      <div>
                        <p className="font-medium">{payment.payment_date}</p>
                        <p className="text-xs text-muted-foreground">
                          {paymentMethodConfig[payment.payment_method]?.label || payment.payment_method}
                        </p>
                      </div>
                      <span className="font-medium text-emerald-600">
                        ${payment.amount?.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Sin pagos registrados
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
