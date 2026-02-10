/**
 * Authentication Context & Hook
 *
 * Single source of truth for auth state on the client.
 * The server (via proxy + lib/supabase/server) is the primary source of truth
 * for the session; this module synchronizes a shared client-side view of that
 * session for all dashboard components.
 */
'use client'

import { useEffect, useState, useCallback, useRef, createContext, useContext } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'
import type { UserProfile, GlobalPermissions } from '@/lib/types'

interface AuthState {
  /** The authenticated user from Supabase */
  user: User | null
  /** The user's profile from our profiles table */
  profile: UserProfile | null
  /** Whether we're currently loading auth state */
  isLoading: boolean
  /** Any error that occurred during auth operations */
  error: Error | null
}

interface UseAuthReturn extends AuthState {
  /** Sign out the current user */
  signOut: () => Promise<void>
  /** Refresh the user's profile data */
  refreshProfile: () => Promise<void>
  /** Check if user has a specific system role */
  hasRole: (role: UserProfile['system_role']) => boolean
  /** Get the user's global permissions */
  permissions: GlobalPermissions
}

const AuthContext = createContext<UseAuthReturn | null>(null)

/**
 * Internal implementation hook that manages Supabase auth state.
 * It can optionally be seeded with a server-resolved user/profile snapshot.
 */
function useAuthImpl(initialUser: User | null, initialProfile: UserProfile | null): UseAuthReturn {
  const [state, setState] = useState<AuthState>(() => ({
    user: initialUser,
    profile: initialProfile,
    isLoading: !initialUser,
    error: null,
  }))

  // Use ref to store supabase client to avoid re-creating on every render
  const supabaseRef = useRef(createClient())
  const mountedRef = useRef(true)

  // Handle unhandled promise rejections from AbortError globally
  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (event.reason?.name === 'AbortError') {
        event.preventDefault()
      }
    }
    
    window.addEventListener('unhandledrejection', handleUnhandledRejection)
    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection)
    }
  }, [])

  /**
   * Fetches the user's profile from the database
   */
  const fetchProfile = useCallback(async (userId: string): Promise<UserProfile | null> => {
    try {
      const { data, error } = await supabaseRef.current
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) {
        console.error('Error fetching profile:', error)
        return null
      }

      return data as UserProfile
    } catch (err) {
      console.error('Error fetching profile:', err)
      return null
    }
  }, [])

  /**
   * Refreshes the current user's profile data
   */
  const refreshProfile = useCallback(async () => {
    if (!state.user) return

    const profile = await fetchProfile(state.user.id)
    setState(prev => ({ ...prev, profile }))
  }, [state.user, fetchProfile])

  /**
   * Signs out the current user
   */
  const signOut = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true }))
    
    try {
      const { error } = await supabaseRef.current.auth.signOut()
      
      if (error) {
        setState(prev => ({ ...prev, error, isLoading: false }))
        return
      }

      setState({
        user: null,
        profile: null,
        isLoading: false,
        error: null,
      })
    } catch (err) {
      setState(prev => ({ 
        ...prev, 
        error: err instanceof Error ? err : new Error('Sign out failed'), 
        isLoading: false 
      }))
    }
  }, [])

  /**
   * Checks if the user has a specific system role
   */
  const hasRole = useCallback((role: UserProfile['system_role']): boolean => {
    return state.profile?.system_role === role
  }, [state.profile])

  /**
   * Computes global permissions based on the user's system role
   */
  const permissions: GlobalPermissions = {
    is_admin: state.profile?.system_role === 'admin_general',
    can_create_cases: ['admin_general', 'case_leader'].includes(state.profile?.system_role || ''),
    can_create_clients: ['admin_general', 'case_leader', 'lawyer_executive'].includes(state.profile?.system_role || ''),
    can_manage_users: state.profile?.system_role === 'admin_general',
    can_view_all_cases: state.profile?.system_role === 'admin_general',
    can_access_settings: state.profile?.system_role === 'admin_general',
  }

  // Initialize auth state and listen for changes
  useEffect(() => {
    const supabase = supabaseRef.current
    mountedRef.current = true
    let initializedByListener = false

    // Helper to load user + profile and set state
    const loadUserState = async (user: User | null) => {
      if (!mountedRef.current) return

      if (!user) {
        setState({
          user: null,
          profile: null,
          isLoading: false,
          error: null,
        })
        return
      }

      const profile = await fetchProfile(user.id)
      if (!mountedRef.current) return

      setState({
        user,
        profile,
        isLoading: false,
        error: null,
      })
    }

    // Listen for ALL auth state changes - this is the primary mechanism
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mountedRef.current) return

        if (process.env.NODE_ENV !== 'production') {
          // Lightweight debug log to help trace intermittent auth issues in development.
          console.log('[useAuth] auth event', { event, hasSessionUser: !!session?.user })
        }

        // INITIAL_SESSION fires on page load/refresh with existing session
        // SIGNED_IN fires after login
        // TOKEN_REFRESHED fires when token is refreshed
        if (
          event === 'INITIAL_SESSION' ||
          event === 'SIGNED_IN' ||
          event === 'TOKEN_REFRESHED'
        ) {
          initializedByListener = true
          await loadUserState(session?.user ?? null)
        } else if (event === 'SIGNED_OUT') {
          setState({
            user: null,
            profile: null,
            isLoading: false,
            error: null,
          })
        }
      }
    )

    // Fallback: if the listener hasn't fired after a short delay, initialize manually
    // This handles edge cases where onAuthStateChange might not fire
    const fallbackTimeout = setTimeout(async () => {
      if (initializedByListener || !mountedRef.current) return

      try {
        const { data: { user }, error } = await supabase.auth.getUser()
        if (!mountedRef.current || initializedByListener) return

        if (error) {
          setState({
            user: null,
            profile: null,
            isLoading: false,
            error: null,
          })
          return
        }

        await loadUserState(user)
      } catch {
        if (!mountedRef.current) return
        setState({
          user: null,
          profile: null,
          isLoading: false,
          error: null,
        })
      }
    }, 1500)

    // Safety: never leave isLoading true indefinitely (e.g. after returning from
    // portal with corrupted session). Force resolve after 3s so sidebar doesn't hang.
    const maxLoadingTimeout = setTimeout(() => {
      if (!mountedRef.current) return
      setState((prev) => {
        if (!prev.isLoading) return prev
        return {
          ...prev,
          isLoading: false,
        }
      })
    }, 3000)

    return () => {
      mountedRef.current = false
      subscription.unsubscribe()
      clearTimeout(fallbackTimeout)
      clearTimeout(maxLoadingTimeout)
    }
  }, [fetchProfile])

  return {
    ...state,
    signOut,
    refreshProfile,
    hasRole,
    permissions,
  }
}

/**
 * AuthProvider
 *
 * Wraps dashboard client components with a shared auth context.
 * Should be seeded from the server with the current user/profile snapshot.
 */
export function AuthProvider({
  initialUser,
  initialProfile,
  children,
}: {
  initialUser: User | null
  initialProfile: UserProfile | null
  children: React.ReactNode
}) {
  const value = useAuthImpl(initialUser, initialProfile)

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

/**
 * Public hook for consuming authentication state.
 * Must be used within an <AuthProvider>.
 */
export function useAuth(): UseAuthReturn {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within an <AuthProvider>')
  }
  return ctx
}
