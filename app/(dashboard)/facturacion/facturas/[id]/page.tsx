import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { InvoiceDetail } from '@/components/billing/invoice-detail'

export const metadata = {
  title: 'Detalle de Factura',
  description: 'Detalle de la factura emitida',
}

interface Props {
  params: Promise<{ id: string }>
}

export default async function FacturaDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: invoice } = await supabase
    .from('invoices')
    .select(`
      *,
      people:client_id(first_name, last_name, company_name, client_type, email, phone, address, cuit, dni),
      companies:company_id(company_name, legal_name, cuit, email, phone, address),
      created_by_profile:created_by(first_name, last_name)
    `)
    .eq('id', id)
    .single()

  if (!invoice) notFound()

  const { data: items } = await supabase
    .from('billing_items')
    .select(`
      *,
      cases:case_id(title, case_number)
    `)
    .eq('invoice_id', id)
    .order('created_at')

  const { data: payments } = await supabase
    .from('payments')
    .select('*')
    .eq('invoice_id', id)
    .order('payment_date', { ascending: false })

  return (
    <InvoiceDetail
      invoice={invoice}
      items={items || []}
      payments={payments || []}
    />
  )
}
