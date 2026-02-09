/**
 * Portal "View as client" helpers
 *
 * Used when an admin previews the portal as a specific client.
 * Cookie view_as_client stores the client's user id (auth.users.id).
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

  // Admins can view as a client via cookie
  if (profile?.system_role !== 'admin_general') {
    return null
  }

  const cookieStore = await cookies()
  const viewAs = cookieStore.get(VIEW_AS_COOKIE)?.value
  if (!viewAs) return user.id // admin without "view as" sees empty portal or we could return null

  // Validate that viewAs is a client (optional: prevent tampering)
  const { data: targetProfile } = await supabase
    .from('profiles')
    .select('system_role')
    .eq('id', viewAs)
    .single()

  if (targetProfile?.system_role === 'client') {
    return viewAs
  }

  return user.id
}

/**
 * Returns the profile (name) for the user currently being "viewed as" in the portal.
 * Used by layout/header to show the client name when admin is viewing as.
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
  const { data } = await supabase
    .from('profiles')
    .select('id, first_name, last_name')
    .eq('id', viewAs)
    .single()

  return data
}

export { VIEW_AS_COOKIE }
