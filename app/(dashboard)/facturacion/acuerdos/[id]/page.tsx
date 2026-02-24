import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft } from 'lucide-react'
import { feeAgreementTypeConfig, feeAgreementStatusConfig } from '@/lib/types'

export const metadata = {
  title: 'Detalle de Acuerdo',
  description: 'Detalle del acuerdo de honorarios',
}

interface Props {
  params: Promise<{ id: string }>
}

export default async function AcuerdoDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: agreement } = await supabase
    .from('fee_agreements')
    .select(`
      *,
      people:client_id(first_name, last_name, company_name, client_type, email, phone),
      companies:company_id(company_name, email, phone),
      cases:case_id(title, case_number, status),
      profiles:created_by(first_name, last_name)
    `)
    .eq('id', id)
    .single()

  if (!agreement) notFound()

  const typeCfg = feeAgreementTypeConfig[agreement.type as keyof typeof feeAgreementTypeConfig]
  const statusCfg = feeAgreementStatusConfig[agreement.status as keyof typeof feeAgreementStatusConfig]

  const clientName = (agreement as any).companies?.company_name
    || ((agreement as any).people?.client_type === 'company'
      ? (agreement as any).people?.company_name
      : `${(agreement as any).people?.first_name} ${(agreement as any).people?.last_name}`)

  const terms = agreement.terms as Record<string, any>

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/facturacion/acuerdos">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Acuerdo: {clientName}
          </h1>
          <p className="text-sm text-muted-foreground">
            {typeCfg?.label} · {agreement.currency}
          </p>
        </div>
        <Badge variant="outline" className={`${statusCfg?.bgColor} ${statusCfg?.color} border-0`}>
          {statusCfg?.label}
        </Badge>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Información General</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Tipo</p>
                <p className="font-medium">{typeCfg?.label}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Moneda</p>
                <p className="font-medium">{agreement.currency}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Vigencia desde</p>
                <p className="font-medium">{agreement.valid_from}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Vigencia hasta</p>
                <p className="font-medium">{agreement.valid_until || 'Indefinido'}</p>
              </div>
            </div>
            {agreement.notes && (
              <div>
                <p className="text-sm text-muted-foreground">Notas</p>
                <p className="text-sm">{agreement.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Términos</CardTitle>
            <CardDescription>{typeCfg?.description}</CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="rounded-lg bg-muted p-4 text-sm overflow-auto">
              {JSON.stringify(terms, null, 2)}
            </pre>
          </CardContent>
        </Card>
      </div>

      {(agreement as any).cases && (
        <Card>
          <CardHeader>
            <CardTitle>Causa Vinculada</CardTitle>
          </CardHeader>
          <CardContent>
            <Link
              href={`/casos/${(agreement as any).cases.id}`}
              className="text-sm font-medium hover:underline"
            >
              {(agreement as any).cases.case_number} - {(agreement as any).cases.title}
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
