import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { BillingItemForm } from '@/components/billing/billing-item-form'

export const metadata = {
  title: 'Nuevo Concepto',
  description: 'Cargar un nuevo concepto a cobrar',
}

export default async function NuevoItemPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: clients } = await supabase
    .from('people')
    .select('id, first_name, last_name, company_name, client_type')
    .eq('person_type', 'client')
    .eq('is_active', true)
    .order('first_name')

  const { data: cases } = await supabase
    .from('cases')
    .select('id, title, case_number, client_id')
    .in('status', ['active', 'pending'])
    .order('case_number')

  const { data: agreements } = await supabase
    .from('fee_agreements')
    .select('id, type, client_id, company_id, currency')
    .eq('status', 'active')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Nuevo Concepto a Cobrar
        </h1>
        <p className="text-sm text-muted-foreground">
          Cargue un concepto que se acumulará en la cuenta del cliente
        </p>
      </div>

      <BillingItemForm
        clients={clients || []}
        cases={cases || []}
        agreements={agreements || []}
        userId={user.id}
      />
    </div>
  )
}
