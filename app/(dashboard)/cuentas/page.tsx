import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
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

export const metadata = {
  title: 'Cuentas Corrientes',
  description: 'Estado de cuenta de cada cliente',
}

export default async function CuentasCorrientesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('system_role')
    .eq('id', user.id)
    .single()

  if (profile?.system_role === 'client') redirect('/portal')

  const { data: accounts } = await supabase
    .from('client_account_summary')
    .select('*')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Cuentas Corrientes
        </h1>
        <p className="text-sm text-muted-foreground">
          Saldos y movimientos de cada cliente
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Facturado</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${accounts?.reduce((sum: number, a: any) => sum + (a.total_invoiced || 0), 0)
                .toLocaleString('es-AR', { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Cobrado</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">
              ${accounts?.reduce((sum: number, a: any) => sum + (a.total_paid || 0), 0)
                .toLocaleString('es-AR', { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Saldo Pendiente Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">
              ${accounts?.reduce((sum: number, a: any) => sum + (a.balance || 0), 0)
                .toLocaleString('es-AR', { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Resumen por Cliente</CardTitle>
          <CardDescription>Estado de cuenta corriente de cada cliente</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead className="text-right">Facturado</TableHead>
                <TableHead className="text-right">Cobrado</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
                <TableHead>Última Factura</TableHead>
                <TableHead>Último Pago</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts && accounts.length > 0 ? (
                accounts.map((account: any, idx: number) => {
                  const balance = account.balance || 0
                  const balanceStatus = balance <= 0 ? 'Al día' : balance > (account.credit_limit || Infinity) ? 'Excede límite' : 'Saldo pendiente'
                  const balanceColor = balance <= 0 ? 'text-emerald-700 bg-emerald-50' : balance > (account.credit_limit || Infinity) ? 'text-red-700 bg-red-50' : 'text-amber-700 bg-amber-50'

                  return (
                    <TableRow key={idx}>
                      <TableCell>
                        <Link
                          href={`/cuentas/${account.client_id || account.company_id}`}
                          className="font-medium hover:underline"
                        >
                          {account.client_id || account.company_id}
                        </Link>
                      </TableCell>
                      <TableCell className="text-right">
                        ${account.total_invoiced?.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right">
                        ${account.total_paid?.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        ${balance.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {account.last_invoice_date || '-'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {account.last_payment_date || '-'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`${balanceColor} border-0`}>
                          {balanceStatus}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  )
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No hay movimientos en cuentas corrientes
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
