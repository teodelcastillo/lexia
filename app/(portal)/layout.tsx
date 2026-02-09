import React from "react"
/**
 * Client Portal Layout
 * 
 * Separate layout for external client access.
 * Provides a limited, read-only view of case information.
 */
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PortalHeader } from '@/components/portal/portal-header'

interface PortalLayoutProps {
  children: React.ReactNode
}

/**
 * Validates that the user is a client and redirects if not
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

  // Only clients can access the portal
  if (profile?.system_role !== 'client') {
    redirect('/dashboard')
  }

  return { user, profile }
}

export default async function PortalLayout({ children }: PortalLayoutProps) {
  const { profile } = await validateClientAccess()

  return (
    <div className="min-h-screen bg-background">
      {/* Portal Header */}
      <PortalHeader 
        userName={`${profile?.first_name || ''} ${profile?.last_name || ''}`}
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
