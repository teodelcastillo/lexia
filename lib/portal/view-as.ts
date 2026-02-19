/**
 * Portal "View as client" helpers
 *
 * Used when an admin previews the portal as a specific client. Cookie
 * view_as_client is set in lib/supabase/middleware.ts when admin visits
 * /portal?as=CLIENT_ID and is cleared when leaving /portal, so the
 * dashboard (admin returning to /dashboard) never sees this cookie and
 * session/layout remain correct.
 */
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'

const VIEW_AS_COOKIE = 'view_as_client'

/**
 * Returns the user id to use for portal data (current user, or viewed-as client if admin).
 * Use this in portal server components instead of user.id when fetching client-specific data.
 */
export async function getEffectivePortalUserId(): Promise<string | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('system_role')
    .eq('id', user.id)
    .single()

  // Clients always see their own data
  if (profile?.system_role === 'client') {
    return user.id
  }

  // Admins can view as a client via cookie (only when enabled; org isolation enforced below)
  if (profile?.system_role !== 'admin_general') {
    return null
  }

  const { isViewAsEnabled } = await import('@/lib/utils/feature-flags')
  if (!isViewAsEnabled()) {
    return user.id
  }

  const cookieStore = await cookies()
  const viewAs = cookieStore.get(VIEW_AS_COOKIE)?.value
  if (!viewAs) return user.id

  // Validate: target must be client AND same organization as admin (multi-tenant isolation)
  const { data: adminProfile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  const { data: targetProfile } = await supabase
    .from('profiles')
    .select('system_role, organization_id')
    .eq('id', viewAs)
    .single()

  if (
    targetProfile?.system_role === 'client' &&
    adminProfile?.organization_id &&
    targetProfile.organization_id === adminProfile.organization_id
  ) {
    return viewAs
  }

  return user.id
}

/**
 * Returns the profile (name) for the user currently being "viewed as" in the portal.
 * Only returns data if target is in same organization as current admin.
 */
export async function getViewAsClientProfile(): Promise<{
  id: string
  first_name: string
  last_name: string
} | null> {
  const cookieStore = await cookies()
  const viewAs = cookieStore.get(VIEW_AS_COOKIE)?.value
  if (!viewAs) return null

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: adminProfile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  const { data } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, organization_id')
    .eq('id', viewAs)
    .single()

  if (
    !data ||
    data.organization_id !== adminProfile?.organization_id
  ) {
    return null
  }

  return { id: data.id, first_name: data.first_name ?? '', last_name: data.last_name ?? '' }
}

export { VIEW_AS_COOKIE }
