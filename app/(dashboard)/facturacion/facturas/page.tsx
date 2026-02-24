import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
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
import { Plus } from 'lucide-react'
import { invoiceStatusConfig } from '@/lib/types'

export const metadata = {
  title: 'Facturas',
  description: 'Listado de facturas emitidas',
}

export default async function FacturasPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('system_role')
    .eq('id', user.id)
    .single()

  if (profile?.system_role === 'client') redirect('/portal')
  const canCreate = ['admin_general', 'case_leader'].includes(profile?.system_role || '')

  const { data: invoices } = await supabase
    .from('invoices')
    .select(`
      *,
      people:client_id(first_name, last_name, company_name, client_type),
      companies:company_id(company_name)
    `)
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Facturas
          </h1>
          <p className="text-sm text-muted-foreground">
            Historial de facturas emitidas
          </p>
        </div>
        {canCreate && (
          <Button asChild>
            <Link href="/facturacion/facturas/nueva">
              <Plus className="mr-2 h-4 w-4" />
              Nueva Factura
            </Link>
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Número</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Período</TableHead>
                <TableHead>Fecha Emisión</TableHead>
                <TableHead>Vencimiento</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices && invoices.length > 0 ? (
                invoices.map((invoice: any) => {
                  const statusCfg = invoiceStatusConfig[invoice.status as keyof typeof invoiceStatusConfig]
                  const clientName = invoice.companies?.company_name
                    || (invoice.people?.client_type === 'company'
                      ? invoice.people?.company_name
                      : `${invoice.people?.first_name} ${invoice.people?.last_name}`)

                  return (
                    <TableRow key={invoice.id}>
                      <TableCell>
                        <Link
                          href={`/facturacion/facturas/${invoice.id}`}
                          className="font-medium hover:underline"
                        >
                          {invoice.invoice_number}
                        </Link>
                      </TableCell>
                      <TableCell>{clientName}</TableCell>
                      <TableCell>{invoice.period || '-'}</TableCell>
                      <TableCell>{invoice.issue_date}</TableCell>
                      <TableCell>{invoice.due_date || '-'}</TableCell>
                      <TableCell className="text-right font-medium">
                        {invoice.currency} {invoice.total?.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
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
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No hay facturas registradas
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
