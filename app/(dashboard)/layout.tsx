import React from "react"
/**
 * Dashboard Layout
 *
 * Layout component for all internal dashboard pages.
 * Resolves the authenticated user/profile on the server and seeds
 * a shared AuthProvider for all client-side dashboard components.
 */
import { redirect } from 'next/navigation'
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/dashboard/app-sidebar'
import { DashboardHeader } from '@/components/dashboard/dashboard-header'
import { AuthProvider } from '@/lib/hooks/use-auth'
import { createClient } from '@/lib/supabase/server'
import type { UserProfile } from '@/lib/types'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile) {
    redirect('/auth/login')
  }

  // Clients nunca deberían entrar al dashboard: redirigirlos a su portal.
  if ((profile as UserProfile).system_role === 'client') {
    redirect('/portal')
  }

  return (
    <AuthProvider initialUser={user} initialProfile={profile as UserProfile}>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <DashboardHeader />
          <main className="flex-1 overflow-auto p-4 md:p-6">
            {children}
          </main>
        </SidebarInset>
      </SidebarProvider>
    </AuthProvider>
  )
}
