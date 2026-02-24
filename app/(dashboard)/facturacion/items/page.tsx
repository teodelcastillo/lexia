import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { BillingItemsTable } from '@/components/billing/billing-items-table'

export const metadata = {
  title: 'Conceptos a Cobrar',
  description: 'Gestión de conceptos de facturación',
}

interface Props {
  searchParams: Promise<{
    status?: string
    client?: string
    period?: string
  }>
}

export default async function BillingItemsPage({ searchParams }: Props) {
  const params = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('system_role')
    .eq('id', user.id)
    .single()

  if (profile?.system_role === 'client') redirect('/portal')
  const canCreate = ['admin_general', 'case_leader', 'lawyer_executive'].includes(profile?.system_role || '')

  let query = supabase
    .from('billing_items')
    .select(`
      *,
      people:client_id(first_name, last_name, company_name, client_type),
      cases:case_id(title, case_number),
      fee_agreements:fee_agreement_id(type),
      created_by_profile:created_by(first_name, last_name),
      approved_by_profile:approved_by(first_name, last_name)
    `)
    .order('created_at', { ascending: false })

  if (params.status) {
    query = query.eq('status', params.status)
  }
  if (params.client) {
    query = query.eq('client_id', params.client)
  }
  if (params.period) {
    query = query.eq('period', params.period)
  }

  const { data: items } = await query

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Conceptos a Cobrar
          </h1>
          <p className="text-sm text-muted-foreground">
            Conceptos cargados por período, pendientes de aprobación y facturación
          </p>
        </div>
        {canCreate && (
          <Button asChild>
            <Link href="/facturacion/items/nuevo">
              <Plus className="mr-2 h-4 w-4" />
              Nuevo Concepto
            </Link>
          </Button>
        )}
      </div>

      <BillingItemsTable
        items={items || []}
        currentStatus={params.status}
        currentPeriod={params.period}
        userRole={profile?.system_role || 'lawyer_executive'}
        userId={user.id}
      />
    </div>
  )
}
