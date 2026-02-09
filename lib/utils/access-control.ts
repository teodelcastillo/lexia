import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

/**
 * Validates user access and applies rules based on role
 * - Admins: can access admin panel and can optionally view client portal
 * - Clients: automatically redirected to /portal
 * - Team members: can access dashboard
 */
export async function validateAndRedirectAccess() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('system_role')
    .eq('id', user.id)
    .single()

  // Clients go to their portal
  if (profile?.system_role === 'client') {
    redirect('/portal')
  }

  return { user, profile }
}

/**
 * Validates user is admin
 */
export async function validateAdminAccess() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('system_role')
    .eq('id', user.id)
    .single()

  if (profile?.system_role !== 'admin_general') {
    redirect('/')
  }

  return { user, profile }
}

/**
 * Validates user is not a client
 */
export async function validateTeamAccess() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('system_role')
    .eq('id', user.id)
    .single()

  if (profile?.system_role === 'client') {
    redirect('/portal')
  }

  return { user, profile }
}
