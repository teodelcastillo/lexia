import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
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
import { compensationStatusConfig } from '@/lib/types'

export const metadata = {
  title: 'Liquidaciones',
  description: 'Liquidaciones mensuales del equipo',
}

export default async function LiquidacionesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('system_role')
    .eq('id', user.id)
    .single()

  if (profile?.system_role === 'client') redirect('/portal')

  const isAdmin = profile?.system_role === 'admin_general'

  let query = supabase
    .from('lawyer_compensations')
    .select(`
      *,
      profiles:lawyer_id(first_name, last_name, email)
    `)
    .order('period', { ascending: false })
    .order('created_at', { ascending: false })

  if (!isAdmin) {
    query = query.eq('lawyer_id', user.id)
  }

  const { data: compensations } = await query

  const { data: settings } = await supabase
    .from('organization_billing_settings')
    .select('current_jus_value, jus_currency')
    .single()

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Liquidaciones
          </h1>
          <p className="text-sm text-muted-foreground">
            {isAdmin ? 'Liquidaciones mensuales de todo el equipo' : 'Tus liquidaciones mensuales'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/liquidaciones/participaciones">
              Ver Participaciones
            </Link>
          </Button>
        </div>
      </div>

      {settings?.current_jus_value && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4 text-sm">
              <span className="text-muted-foreground">Valor JUS actual:</span>
              <span className="font-bold text-lg">
                {settings.jus_currency || 'ARS'} {settings.current_jus_value?.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Historial de Liquidaciones</CardTitle>
          <CardDescription>Compensaciones por período</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                {isAdmin && <TableHead>Abogado</TableHead>}
                <TableHead>Período</TableHead>
                <TableHead className="text-right">Base JUS</TableHead>
                <TableHead className="text-right">Valor JUS</TableHead>
                <TableHead className="text-right">Base ARS</TableHead>
                <TableHead className="text-right">Participaciones</TableHead>
                <TableHead className="text-right">Total Bruto</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {compensations && compensations.length > 0 ? (
                compensations.map((comp: any) => {
                  const statusCfg = compensationStatusConfig[comp.status as keyof typeof compensationStatusConfig]
                  return (
                    <TableRow key={comp.id}>
                      {isAdmin && (
                        <TableCell className="font-medium">
                          {comp.profiles?.first_name} {comp.profiles?.last_name}
                        </TableCell>
                      )}
                      <TableCell>
                        <Link href={`/liquidaciones/${comp.id}`} className="font-medium hover:underline">
                          {comp.period}
                        </Link>
                      </TableCell>
                      <TableCell className="text-right">
                        {comp.base_salary_jus?.toLocaleString('es-AR', { minimumFractionDigits: 2 }) || '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        ${comp.jus_value_at_period?.toLocaleString('es-AR', { minimumFractionDigits: 2 }) || '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        ${comp.base_amount_ars?.toLocaleString('es-AR', { minimumFractionDigits: 2 }) || '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        ${comp.participations_total?.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right font-bold">
                        ${comp.total_gross?.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
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
                  <TableCell colSpan={isAdmin ? 8 : 7} className="text-center py-8 text-muted-foreground">
                    No hay liquidaciones registradas
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
