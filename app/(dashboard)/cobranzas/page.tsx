import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CollectionDashboard } from '@/components/billing/collection-dashboard'

export const metadata = {
  title: 'Cobranzas',
  description: 'Dashboard de cobranzas y morosidad',
}

export default async function CobranzasPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('system_role')
    .eq('id', user.id)
    .single()

  if (profile?.system_role === 'client') redirect('/portal')

  const { data: overdueInvoices } = await supabase
    .from('invoices')
    .select(`
      *,
      people:client_id(first_name, last_name, company_name, client_type),
      companies:company_id(company_name)
    `)
    .in('status', ['issued', 'overdue', 'partially_paid'])
    .order('due_date', { ascending: true })

  const { data: accountSummaries } = await supabase
    .from('client_account_summary')
    .select('*')

  const { data: recentPayments } = await supabase
    .from('payments')
    .select(`
      *,
      people:client_id(first_name, last_name, company_name, client_type),
      companies:company_id(company_name),
      invoices:invoice_id(invoice_number)
    `)
    .order('payment_date', { ascending: false })
    .limit(10)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Cobranzas
        </h1>
        <p className="text-sm text-muted-foreground">
          Seguimiento de cobros, morosidad y pagos recibidos
        </p>
      </div>

      <CollectionDashboard
        overdueInvoices={overdueInvoices || []}
        accountSummaries={accountSummaries || []}
        recentPayments={recentPayments || []}
      />
    </div>
  )
}
