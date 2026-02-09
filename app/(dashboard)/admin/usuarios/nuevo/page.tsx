/**
 * Add New Team Member Page
 * 
 * Admin-only page for adding new team members to the law firm.
 * Creates both Supabase auth account and profile record.
 */

import { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { NewUserForm } from '@/components/admin/new-user-form'

export const metadata: Metadata = {
  title: 'Agregar Usuario | Admin',
  description: 'Agregar nuevo miembro al equipo',
}

/**
 * Server component that verifies admin access before showing the form
 */
export default async function NewUserPage() {
  const supabase = await createClient()
  
  // Check if user is authenticated and is admin
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  
  if (authError || !user) {
    redirect('/auth/login')
  }
  
  // Get user profile to check role
  const { data: profile } = await supabase
    .from('profiles')
    .select('system_role')
    .eq('id', user.id)
    .single()
  
  if (profile?.system_role !== 'admin_general') {
    redirect('/dashboard')
  }

  return (
    <div className="container max-w-3xl py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Agregar Nuevo Usuario
        </h1>
        <p className="mt-2 text-muted-foreground">
          Cree una cuenta para un nuevo miembro del equipo. Se le enviará un email con instrucciones para establecer su contraseña.
        </p>
      </div>

      <NewUserForm />
    </div>
  )
}
