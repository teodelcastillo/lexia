'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CheckCircle2, X } from 'lucide-react'
import { toast } from 'sonner'
import { billingItemStatusConfig, billingItemTypeConfig } from '@/lib/types'

interface BillingItemsTableProps {
  items: any[]
  currentStatus?: string
  currentPeriod?: string
  userRole: string
  userId: string
}

export function BillingItemsTable({ items, currentStatus, currentPeriod, userRole, userId }: BillingItemsTableProps) {
  const router = useRouter()
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const canApprove = ['admin_general', 'case_leader'].includes(userRole)

  const handleApprove = async (itemId: string) => {
    setLoadingId(itemId)
    const supabase = createClient()
    const { error } = await supabase
      .from('billing_items')
      .update({
        status: 'approved',
        approved_by: userId,
        approved_at: new Date().toISOString(),
      })
      .eq('id', itemId)

    setLoadingId(null)
    if (error) {
      toast.error('Error al aprobar: ' + error.message)
    } else {
      toast.success('Concepto aprobado')
      router.refresh()
    }
  }

  const handleVoid = async (itemId: string) => {
    setLoadingId(itemId)
    const supabase = createClient()
    const { error } = await supabase
      .from('billing_items')
      .update({ status: 'void' })
      .eq('id', itemId)

    setLoadingId(null)
    if (error) {
      toast.error('Error al anular: ' + error.message)
    } else {
      toast.success('Concepto anulado')
      router.refresh()
    }
  }

  const handleFilterStatus = (status: string) => {
    const params = new URLSearchParams()
    if (status && status !== 'all') params.set('status', status)
    if (currentPeriod) params.set('period', currentPeriod)
    router.push(`/facturacion/items?${params.toString()}`)
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <Select value={currentStatus || 'all'} onValueChange={handleFilterStatus}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filtrar por estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            {(Object.entries(billingItemStatusConfig) as [string, { label: string }][]).map(([key, cfg]) => (
              <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Descripción</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Causa</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Período</TableHead>
                <TableHead className="text-right">Monto</TableHead>
                <TableHead className="text-right">Cant.</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Cargado por</TableHead>
                {canApprove && <TableHead>Acciones</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length > 0 ? (
                items.map((item: any) => {
                  const statusCfg = billingItemStatusConfig[item.status as keyof typeof billingItemStatusConfig]
                  const typeCfg = billingItemTypeConfig[item.type as keyof typeof billingItemTypeConfig]
                  const clientName = item.people?.client_type === 'company'
                    ? item.people?.company_name
                    : `${item.people?.first_name} ${item.people?.last_name}`

                  return (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium max-w-[200px] truncate">
                        {item.description}
                      </TableCell>
                      <TableCell>{clientName}</TableCell>
                      <TableCell>
                        {item.cases ? (
                          <Link href={`/casos/${item.case_id}`} className="text-sm hover:underline">
                            {item.cases.case_number}
                          </Link>
                        ) : '-'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={`${typeCfg?.bgColor} ${typeCfg?.color} border-0`}>
                          {typeCfg?.label}
                        </Badge>
                      </TableCell>
                      <TableCell>{item.period || '-'}</TableCell>
                      <TableCell className="text-right">
                        ${item.amount?.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right">{item.quantity}</TableCell>
                      <TableCell className="text-right font-medium">
                        ${item.line_total?.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`${statusCfg?.bgColor} ${statusCfg?.color} border-0`}>
                          {statusCfg?.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {item.created_by_profile?.first_name} {item.created_by_profile?.last_name}
                      </TableCell>
                      {canApprove && (
                        <TableCell>
                          <div className="flex gap-1">
                            {item.status === 'draft' && (
                              <>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7 text-emerald-600 hover:text-emerald-700"
                                  onClick={() => handleApprove(item.id)}
                                  disabled={loadingId === item.id}
                                  title="Aprobar"
                                >
                                  <CheckCircle2 className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7 text-red-600 hover:text-red-700"
                                  onClick={() => handleVoid(item.id)}
                                  disabled={loadingId === item.id}
                                  title="Anular"
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  )
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={canApprove ? 11 : 10} className="text-center py-8 text-muted-foreground">
                    No hay conceptos que coincidan con los filtros
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
