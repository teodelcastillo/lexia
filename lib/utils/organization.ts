import { createClient } from '@/lib/supabase/server'

/**
 * Gets the organization_id of the currently authenticated user
 * 
 * This function should only be used in Server Components or Server Actions.
 * For Client Components, pass organization_id as a prop from the parent Server Component.
 * 
 * @returns The organization_id UUID string, or null if user is not authenticated or has no organization
 */
export async function getCurrentUserOrganizationId(): Promise<string | null> {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return null
  }
  
  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single()
  
  return profile?.organization_id || null
}

/**
 * Validates that a given organization_id matches the current user's organization
 * 
 * @param organizationId - The organization_id to validate
 * @returns true if the organization_id matches the user's organization, false otherwise
 */
export async function validateUserOrganization(organizationId: string | null): Promise<boolean> {
  if (!organizationId) {
    return false
  }
  
  const userOrgId = await getCurrentUserOrganizationId()
  return userOrgId === organizationId
}
