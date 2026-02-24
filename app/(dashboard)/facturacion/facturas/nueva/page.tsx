import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { InvoiceGenerator } from '@/components/billing/invoice-generator'

export const metadata = {
  title: 'Nueva Factura',
  description: 'Generar una nueva factura agrupando conceptos aprobados',
}

export default async function NuevaFacturaPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('system_role')
    .eq('id', user.id)
    .single()

  if (!['admin_general', 'case_leader'].includes(profile?.system_role || '')) {
    redirect('/facturacion/facturas')
  }

  const { data: approvedItems } = await supabase
    .from('billing_items')
    .select(`
      *,
      people:client_id(id, first_name, last_name, company_name, client_type),
      cases:case_id(title, case_number)
    `)
    .eq('status', 'approved')
    .order('client_id')
    .order('period')

  const { data: settings } = await supabase
    .from('organization_billing_settings')
    .select('*')
    .single()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Nueva Factura
        </h1>
        <p className="text-sm text-muted-foreground">
          Seleccione los conceptos aprobados para agrupar en una factura
        </p>
      </div>

      <InvoiceGenerator
        approvedItems={approvedItems || []}
        settings={settings}
        userId={user.id}
      />
    </div>
  )
}
