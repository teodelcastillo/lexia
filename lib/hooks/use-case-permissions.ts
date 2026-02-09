/**
 * Case Permissions Hook
 * 
 * Provides contextual permissions for a specific case.
 * Determines what actions a user can perform based on their role in that case.
 */
'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from './use-auth'
import type { CasePermissionContext, CaseRole } from '@/lib/types'

interface UseCasePermissionsReturn {
  /** Permission context for the case */
  permissions: CasePermissionContext | null
  /** Whether permissions are being loaded */
  isLoading: boolean
  /** Any error that occurred */
  error: Error | null
  /** Refresh the permissions */
  refresh: () => Promise<void>
}

/**
 * Hook for determining user permissions within a specific case context.
 * 
 * Permission logic:
 * - Admin: Full access to all cases
 * - Case Leader: Full access to assigned case, can manage team
 * - Lawyer/Assistant: Can view and edit assigned cases, but not manage team
 * - Client: Read-only access to their own cases
 */
export function useCasePermissions(caseId: string | null): UseCasePermissionsReturn {
  const { user, profile, permissions: globalPermissions } = useAuth()
  const [state, setState] = useState<{
    permissions: CasePermissionContext | null
    isLoading: boolean
    error: Error | null
  }>({
    permissions: null,
    isLoading: true,
    error: null,
  })

  const supabase = createClient()

  /**
   * Fetches the user's assignment for a specific case
   */
  const fetchCasePermissions = useCallback(async () => {
    if (!caseId || !user || !profile) {
      setState({
        permissions: null,
        isLoading: false,
        error: null,
      })
      return
    }

    // Admins have full access to all cases
    if (globalPermissions.is_admin) {
      setState({
        permissions: {
          case_id: caseId,
          can_view: true,
          can_edit: true,
          can_manage_team: true,
          can_delete: true,
          role: null, // Admin doesn't need a specific role
        },
        isLoading: false,
        error: null,
      })
      return
    }

    // Clients can only view their own cases (handled by RLS)
    if (profile.system_role === 'client') {
      // Check if case belongs to client
      const { data: caseData, error } = await supabase
        .from('cases')
        .select('id, client_id, clients!inner(portal_user_id)')
        .eq('id', caseId)
        .single()

      if (error || !caseData) {
        setState({
          permissions: {
            case_id: caseId,
            can_view: false,
            can_edit: false,
            can_manage_team: false,
            can_delete: false,
            role: null,
          },
          isLoading: false,
          error: error ? new Error(error.message) : null,
        })
        return
      }

      // Check if the client's portal user matches
      const clientData = caseData.clients as unknown as { portal_user_id: string | null }
      const hasAccess = clientData?.portal_user_id === user.id

      setState({
        permissions: {
          case_id: caseId,
          can_view: hasAccess,
          can_edit: false,
          can_manage_team: false,
          can_delete: false,
          role: null,
        },
        isLoading: false,
        error: null,
      })
      return
    }

    // For internal users, check their case assignment
    const { data: assignment, error } = await supabase
      .from('case_assignments')
      .select('case_role')
      .eq('case_id', caseId)
      .eq('user_id', user.id)
      .single()

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      setState({
        permissions: null,
        isLoading: false,
        error: new Error(error.message),
      })
      return
    }

    const caseRole = assignment?.case_role as CaseRole | undefined

    // Determine permissions based on case role
    const permissions: CasePermissionContext = {
      case_id: caseId,
      can_view: !!caseRole,
      can_edit: !!caseRole,
      can_manage_team: caseRole === 'leader',
      can_delete: caseRole === 'leader',
      role: caseRole || null,
    }

    setState({
      permissions,
      isLoading: false,
      error: null,
    })
  }, [caseId, user, profile, globalPermissions.is_admin, supabase])

  // Fetch permissions when case or user changes
  useEffect(() => {
    fetchCasePermissions()
  }, [fetchCasePermissions])

  return {
    ...state,
    refresh: fetchCasePermissions,
  }
}

/**
 * Utility function to check if a user has a specific permission for a case.
 * Can be used in server components or API routes.
 */
export async function checkCasePermission(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  caseId: string,
  permission: keyof Omit<CasePermissionContext, 'case_id' | 'role'>
): Promise<boolean> {
  // First check if user is admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('system_role')
    .eq('id', userId)
    .single()

  if (profile?.system_role === 'admin_general') {
    return true
  }

  // Check case assignment
  const { data: assignment } = await supabase
    .from('case_assignments')
    .select('case_role')
    .eq('case_id', caseId)
    .eq('user_id', userId)
    .single()

  if (!assignment) {
    return false
  }

  const caseRole = assignment.case_role as CaseRole

  switch (permission) {
    case 'can_view':
    case 'can_edit':
      return true
    case 'can_manage_team':
    case 'can_delete':
      return caseRole === 'leader'
    default:
      return false
  }
}
