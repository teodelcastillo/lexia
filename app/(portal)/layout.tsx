import React from "react"
/**
 * Client Portal Layout
 * 
 * Separate layout for external client access.
 * Provides a limited, read-only view of case information.
 */
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PortalHeader, type PortalClientOption } from '@/components/portal/portal-header'
import { getViewAsClientProfile } from '@/lib/portal/view-as'

interface PortalLayoutProps {
  children: React.ReactNode
}

/**
 * Validates that the user can access the portal: clients (their own view) or
 * admins (preview of what clients see). Other roles are redirected to dashboard.
 */
async function validateClientAccess() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/portal-login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('system_role, first_name, last_name')
    .eq('id', user.id)
    .single()

  const role = profile?.system_role
  const canAccessPortal = role === 'client' || role === 'admin_general'

  if (!canAccessPortal) {
    redirect('/dashboard')
  }

  return { user, profile }
}

export default async function PortalLayout({ children }: PortalLayoutProps) {
  const { profile } = await validateClientAccess()
  const isAdmin = profile?.system_role === 'admin_general'

  const viewAsProfile = isAdmin ? await getViewAsClientProfile() : null
  const displayName = viewAsProfile
    ? `${viewAsProfile.first_name || ''} ${viewAsProfile.last_name || ''}`.trim() || 'Cliente'
    : `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim() || 'Usuario'

  let clientsList: PortalClientOption[] = []
  if (isAdmin) {
    const supabase = await createClient()
    const { data } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, email')
      .eq('system_role', 'client')
      .order('last_name', { ascending: true })
    clientsList = (data || []).map((p) => ({
      id: p.id,
      first_name: p.first_name ?? '',
      last_name: p.last_name ?? '',
      email: p.email ?? '',
    }))
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Portal Header (admins see "Vista previa", selector "Ver como" and link back to dashboard) */}
      <PortalHeader 
        userName={displayName}
        isAdminPreview={isAdmin}
        clientsList={clientsList}
        viewAsClientId={viewAsProfile?.id ?? null}
      />

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 max-w-6xl">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-border mt-auto">
        <div className="container mx-auto px-4 py-6 max-w-6xl">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
            <p>Portal de Clientes - LegalHub</p>
            <p>Para consultas, contacte a su abogado asignado</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
