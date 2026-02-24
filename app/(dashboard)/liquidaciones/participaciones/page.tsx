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
import { participationTypeConfig } from '@/lib/types'

export const metadata = {
  title: 'Participaciones',
  description: 'Participaciones de abogados en causas',
}

export default async function ParticipacionesPage() {
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
    .from('case_participations')
    .select(`
      *,
      cases:case_id(title, case_number, status),
      profiles:lawyer_id(first_name, last_name)
    `)
    .order('created_at', { ascending: false })

  if (!isAdmin) {
    query = query.eq('lawyer_id', user.id)
  }

  const { data: participations } = await query

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Participaciones en Causas
        </h1>
        <p className="text-sm text-muted-foreground">
          {isAdmin ? 'Distribución de participaciones del equipo por causa' : 'Tus participaciones en causas'}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Participaciones</CardTitle>
          <CardDescription>Porcentajes y montos calculados por causa</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Causa</TableHead>
                {isAdmin && <TableHead>Abogado</TableHead>}
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Porcentaje</TableHead>
                <TableHead className="text-right">Base</TableHead>
                <TableHead className="text-right">Calculado</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {participations && participations.length > 0 ? (
                participations.map((p: any) => {
                  const typeCfg = participationTypeConfig[p.participation_type as keyof typeof participationTypeConfig]
                  const statusColor = p.status === 'paid'
                    ? 'text-emerald-700 bg-emerald-50'
                    : p.status === 'approved'
                    ? 'text-blue-700 bg-blue-50'
                    : 'text-gray-700 bg-gray-50'

                  return (
                    <TableRow key={p.id}>
                      <TableCell>
                        <Link href={`/casos/${p.case_id}`} className="font-medium hover:underline">
                          {p.cases?.case_number} - {p.cases?.title}
                        </Link>
                      </TableCell>
                      {isAdmin && (
                        <TableCell>{p.profiles?.first_name} {p.profiles?.last_name}</TableCell>
                      )}
                      <TableCell>
                        <Badge variant="secondary">{typeCfg?.label}</Badge>
                      </TableCell>
                      <TableCell className="text-right">{p.percentage}%</TableCell>
                      <TableCell className="text-right">
                        ${p.base_amount?.toLocaleString('es-AR', { minimumFractionDigits: 2 }) || '-'}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        ${p.calculated_amount?.toLocaleString('es-AR', { minimumFractionDigits: 2 }) || '-'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`${statusColor} border-0`}>
                          {p.status === 'paid' ? 'Pagado' : p.status === 'approved' ? 'Aprobado' : 'Pendiente'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  )
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={isAdmin ? 7 : 6} className="text-center py-8 text-muted-foreground">
                    No hay participaciones registradas
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
