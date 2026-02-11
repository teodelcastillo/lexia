/**
 * Root Page - Entry Point
 * 
 * Redirects users based on their authentication and role:
 * - Unauthenticated: Login page
 * - Internal users (admin, lawyer, assistant): Dashboard
 * - External users (clients): Client Portal
 */
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function RootPage() {
  const supabase = await createClient()
  
  // Check if user is authenticated
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    // Not authenticated - redirect to login
    redirect('/auth/login')
  }

  // Get user's profile to determine their role
  const { data: profile } = await supabase
    .from('profiles')
    .select('system_role')
    .eq('id', user.id)
    .single()

  // Redirect based on user role
  if (profile?.system_role === 'client') {
    // External client - redirect to client portal
    redirect('/portal')
  } else {
    // Internal user - redirect to dashboard
    redirect('/dashboard')
  }
}
