import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { FeeAgreementForm } from '@/components/billing/fee-agreement-form'

export const metadata = {
  title: 'Nuevo Acuerdo de Honorarios',
  description: 'Crear un nuevo acuerdo de honorarios',
}

export default async function NuevoAcuerdoPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('system_role')
    .eq('id', user.id)
    .single()

  if (!['admin_general', 'case_leader'].includes(profile?.system_role || '')) {
    redirect('/facturacion/acuerdos')
  }

  const { data: clients } = await supabase
    .from('people')
    .select('id, first_name, last_name, company_name, client_type')
    .eq('person_type', 'client')
    .eq('is_active', true)
    .order('first_name')

  const { data: companies } = await supabase
    .from('companies')
    .select('id, company_name')
    .eq('is_active', true)
    .order('company_name')

  const { data: cases } = await supabase
    .from('cases')
    .select('id, title, case_number')
    .in('status', ['active', 'pending'])
    .order('case_number')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Nuevo Acuerdo de Honorarios
        </h1>
        <p className="text-sm text-muted-foreground">
          Defina los términos del acuerdo con el cliente
        </p>
      </div>

      <FeeAgreementForm
        clients={clients || []}
        companies={companies || []}
        cases={cases || []}
        userId={user.id}
      />
    </div>
  )
}
