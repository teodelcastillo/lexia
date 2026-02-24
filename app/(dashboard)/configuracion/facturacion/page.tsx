import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import { BillingSettingsForm } from '@/components/billing/billing-settings-form'

export const metadata = {
  title: 'Configuración de Facturación',
  description: 'Configuración del módulo de facturación',
}

export default async function BillingSettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('system_role, organization_id')
    .eq('id', user.id)
    .single()

  if (profile?.system_role !== 'admin_general') {
    redirect('/dashboard')
  }

  const { data: settings } = await supabase
    .from('organization_billing_settings')
    .select('*')
    .single()

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/configuracion">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Configuración de Facturación
          </h1>
          <p className="text-sm text-muted-foreground">
            Moneda, impuestos, valor del JUS y porcentajes de participación
          </p>
        </div>
      </div>

      <BillingSettingsForm
        settings={settings}
        organizationId={profile?.organization_id || ''}
      />
    </div>
  )
}
