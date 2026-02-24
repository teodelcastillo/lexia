import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus } from 'lucide-react'
import { feeAgreementTypeConfig, feeAgreementStatusConfig } from '@/lib/types'

export const metadata = {
  title: 'Acuerdos de Honorarios',
  description: 'Gestión de acuerdos de honorarios con clientes',
}

export default async function AcuerdosPage() {
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

  const { data: agreements } = await supabase
    .from('fee_agreements')
    .select(`
      *,
      people:client_id(first_name, last_name, company_name, client_type),
      companies:company_id(company_name),
      cases:case_id(title, case_number)
    `)
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Acuerdos de Honorarios
          </h1>
          <p className="text-sm text-muted-foreground">
            Contratos financieros con clientes y empresas
          </p>
        </div>
        {canCreate && (
          <Button asChild>
            <Link href="/facturacion/acuerdos/nuevo">
              <Plus className="mr-2 h-4 w-4" />
              Nuevo Acuerdo
            </Link>
          </Button>
        )}
      </div>

      {agreements && agreements.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {agreements.map((agreement: any) => {
            const typeCfg = feeAgreementTypeConfig[agreement.type as keyof typeof feeAgreementTypeConfig]
            const statusCfg = feeAgreementStatusConfig[agreement.status as keyof typeof feeAgreementStatusConfig]
            const clientName = agreement.companies?.company_name
              || (agreement.people?.client_type === 'company'
                ? agreement.people?.company_name
                : `${agreement.people?.first_name} ${agreement.people?.last_name}`)

            return (
              <Link key={agreement.id} href={`/facturacion/acuerdos/${agreement.id}`}>
                <Card className="hover:bg-muted/50 transition-colors cursor-pointer h-full">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-base">{clientName}</CardTitle>
                      <Badge variant="outline" className={`${statusCfg?.bgColor} ${statusCfg?.color} border-0`}>
                        {statusCfg?.label}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <Badge variant="secondary">{typeCfg?.label}</Badge>
                    {agreement.cases && (
                      <p className="text-xs text-muted-foreground">
                        Causa: {agreement.cases.case_number} - {agreement.cases.title}
                      </p>
                    )}
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Desde {agreement.valid_from}</span>
                      <span>{agreement.currency}</span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground mb-4">No hay acuerdos de honorarios registrados</p>
            {canCreate && (
              <Button asChild>
                <Link href="/facturacion/acuerdos/nuevo">
                  <Plus className="mr-2 h-4 w-4" />
                  Crear primer acuerdo
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
