import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { AccountStatement } from '@/components/billing/account-statement'

export const metadata = {
  title: 'Estado de Cuenta',
  description: 'Detalle de cuenta corriente del cliente',
}

interface Props {
  params: Promise<{ id: string }>
}

export default async function CuentaDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: client } = await supabase
    .from('people')
    .select('id, first_name, last_name, company_name, client_type, email, phone')
    .eq('id', id)
    .single()

  let company = null
  if (!client) {
    const { data: comp } = await supabase
      .from('companies')
      .select('id, company_name, email, phone')
      .eq('id', id)
      .single()
    company = comp
  }

  if (!client && !company) notFound()

  const { data: movements } = await supabase
    .from('account_movements')
    .select(`
      *,
      invoices:invoice_id(invoice_number, status),
      created_by_profile:created_by(first_name, last_name)
    `)
    .or(client ? `client_id.eq.${id}` : `company_id.eq.${id}`)
    .order('movement_date', { ascending: false })

  const { data: accountConfig } = await supabase
    .from('client_accounts')
    .select('*')
    .or(client ? `client_id.eq.${id}` : `company_id.eq.${id}`)
    .single()

  const { data: pendingItems } = await supabase
    .from('billing_items')
    .select('*')
    .eq('client_id', id)
    .in('status', ['draft', 'approved'])
    .order('created_at', { ascending: false })

  const clientName = client
    ? (client.client_type === 'company' ? client.company_name : `${client.first_name} ${client.last_name}`)
    : company?.company_name

  return (
    <AccountStatement
      clientName={clientName || 'Cliente'}
      clientId={id}
      isCompany={!client}
      movements={movements || []}
      accountConfig={accountConfig}
      pendingItems={pendingItems || []}
    />
  )
}
