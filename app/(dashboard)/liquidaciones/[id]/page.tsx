import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { CompensationDetail } from '@/components/billing/compensation-detail'

export const metadata = {
  title: 'Detalle de Liquidación',
  description: 'Desglose de la liquidación mensual',
}

interface Props {
  params: Promise<{ id: string }>
}

export default async function LiquidacionDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: compensation } = await supabase
    .from('lawyer_compensations')
    .select(`
      *,
      profiles:lawyer_id(first_name, last_name, email, bar_number)
    `)
    .eq('id', id)
    .single()

  if (!compensation) notFound()

  const { data: participations } = await supabase
    .from('case_participations')
    .select(`
      *,
      cases:case_id(title, case_number, status)
    `)
    .eq('lawyer_id', compensation.lawyer_id)
    .in('status', ['approved', 'paid'])

  return (
    <CompensationDetail
      compensation={compensation}
      participations={participations || []}
    />
  )
}
