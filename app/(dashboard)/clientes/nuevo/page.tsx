/**
 * New Client Page
 * 
 * Form for creating a new client (individual or company).
 */
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import { ClientForm } from '@/components/clients/client-form'

export const metadata = {
  title: 'Nuevo Cliente',
  description: 'Registrar un nuevo cliente',
}

/**
 * Validates user access for creating clients
 */
async function validateAccess() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('system_role')
    .eq('id', user.id)
    .single()

  // Only admin, lawyer, and assistant can create clients
  if (!['admin_general', 'case_leader', 'lawyer_executive'].includes(profile?.system_role || '')) {
    redirect('/clientes')
  }

  return { user, profile }
}

export default async function NewClientPage() {
  await validateAccess()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/clientes">
            <ArrowLeft className="h-4 w-4" />
            <span className="sr-only">Volver a clientes</span>
          </Link>
        </Button>
        
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Nuevo Cliente
          </h1>
          <p className="text-sm text-muted-foreground">
            Complete la información para registrar un nuevo cliente
          </p>
        </div>
      </div>

      {/* Form */}
      <ClientForm />
    </div>
  )
}
