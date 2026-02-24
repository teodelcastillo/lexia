'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ArrowLeft, ArrowDownRight, ArrowUpRight } from 'lucide-react'
import { accountMovementTypeConfig, billingItemStatusConfig } from '@/lib/types'

interface AccountStatementProps {
  clientName: string
  clientId: string
  isCompany: boolean
  movements: any[]
  accountConfig: any
  pendingItems: any[]
}

export function AccountStatement({
  clientName,
  clientId,
  isCompany,
  movements,
  accountConfig,
  pendingItems,
}: AccountStatementProps) {
  const totalInvoiced = movements
    .filter((m: any) => m.type === 'invoice' || m.type === 'adjustment')
    .reduce((sum: number, m: any) => sum + (m.amount || 0), 0)

  const totalPaid = movements
    .filter((m: any) => m.type === 'payment' || m.type === 'credit_note')
    .reduce((sum: number, m: any) => sum + (m.amount || 0), 0)

  const balance = totalInvoiced - totalPaid

  const pendingTotal = pendingItems.reduce((sum: number, item: any) => sum + ((item.amount || 0) * (item.quantity || 1)), 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/cuentas">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Estado de Cuenta: {clientName}
          </h1>
          <p className="text-sm text-muted-foreground">
            Movimientos y saldo actual
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Facturado</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${totalInvoiced.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Pagado</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">
              ${totalPaid.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Saldo Actual</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${balance > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
              ${balance.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
            </div>
            {accountConfig?.credit_limit && (
              <p className="text-xs text-muted-foreground">
                Límite: ${accountConfig.credit_limit.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Pendiente Facturar</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              ${pendingTotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground">
              {pendingItems.length} conceptos
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Movements Timeline */}
      <Card>
        <CardHeader>
          <CardTitle>Movimientos</CardTitle>
          <CardDescription>Historial de facturación y pagos</CardDescription>
        </CardHeader>
        <CardContent>
          {movements.length > 0 ? (
            <div className="space-y-3">
              {movements.map((movement: any) => {
                const cfg = accountMovementTypeConfig[movement.type as keyof typeof accountMovementTypeConfig]
                const isDebit = cfg?.sign === 1

                return (
                  <div key={movement.id} className="flex items-center gap-4 border-b pb-3 last:border-0">
                    <div className={`rounded-full p-2 ${isDebit ? 'bg-blue-50' : 'bg-emerald-50'}`}>
                      {isDebit
                        ? <ArrowUpRight className="h-4 w-4 text-blue-600" />
                        : <ArrowDownRight className="h-4 w-4 text-emerald-600" />
                      }
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">{cfg?.label}</p>
                        {movement.invoices?.invoice_number && (
                          <Badge variant="outline" className="text-xs">
                            {movement.invoices.invoice_number}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {movement.movement_date}
                        {movement.notes && ` · ${movement.notes}`}
                      </p>
                    </div>
                    <span className={`text-sm font-bold ${isDebit ? 'text-blue-600' : 'text-emerald-600'}`}>
                      {isDebit ? '+' : '-'}${movement.amount?.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">
              No hay movimientos registrados
            </p>
          )}
        </CardContent>
      </Card>

      {/* Pending Items */}
      {pendingItems.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Conceptos Pendientes de Facturar</CardTitle>
            <CardDescription>Conceptos en borrador o aprobados</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {pendingItems.map((item: any) => {
                const statusCfg = billingItemStatusConfig[item.status as keyof typeof billingItemStatusConfig]
                return (
                  <div key={item.id} className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <p className="text-sm font-medium">{item.description}</p>
                      <p className="text-xs text-muted-foreground">{item.period || 'Sin período'}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium">
                        ${((item.amount || 0) * (item.quantity || 1)).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </span>
                      <Badge variant="outline" className={`${statusCfg?.bgColor} ${statusCfg?.color} border-0`}>
                        {statusCfg?.label}
                      </Badge>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
