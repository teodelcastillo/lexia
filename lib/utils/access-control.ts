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

/**
 * Server-side check: can this user perform the given permission on this case?
 * Use in API routes and server components. Handles admin, client (portal), and case_assignments.
 */
export async function checkCasePermission(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  caseId: string,
  permission: 'can_view' | 'can_edit' | 'can_manage_team' | 'can_delete'
): Promise<boolean> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('system_role')
    .eq('id', userId)
    .single()

  if (profile?.system_role === 'admin_general') {
    return true
  }

  if (profile?.system_role === 'client') {
    if (permission !== 'can_view') return false
    const { data: caseRow } = await supabase
      .from('cases')
      .select('company_id')
      .eq('id', caseId)
      .single()
    if (!caseRow?.company_id) return false
    const { data: person } = await supabase
      .from('people')
      .select('id')
      .eq('portal_user_id', userId)
      .eq('company_id', caseRow.company_id)
      .limit(1)
      .single()
    return !!person
  }

  const { data: assignment } = await supabase
    .from('case_assignments')
    .select('case_role')
    .eq('case_id', caseId)
    .eq('user_id', userId)
    .single()

  if (!assignment) return false

  const role = assignment.case_role as string
  if (permission === 'can_view' || permission === 'can_edit') return true
  if (permission === 'can_manage_team' || permission === 'can_delete') return role === 'leader'
  return false
}
