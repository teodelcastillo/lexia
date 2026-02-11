/**
 * Auth hook and provider – single source of truth aligned with server session.
 *
 * Session truth is established on the server (proxy → updateSession in middleware,
 * then dashboard/portal layouts with createClient). This module syncs with that:
 * AuthProvider is seeded with initialUser/initialProfile from the server and
 * only uses onAuthStateChange as a secondary sync (e.g. signOut in another tab).
 * It does not create a separate session truth.
 */
'use client'

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import type { UserProfile } from '@/lib/types'

/** Enable auth debug logs in development. Set to false to silence. */
const DEBUG_AUTH = process.env.NODE_ENV === 'development'

function logAuth(message: string, data?: Record<string, unknown>) {
  if (DEBUG_AUTH) {
    const payload = data ? ` ${JSON.stringify(data)}` : ''
    console.log(`[auth]${payload} ${message}`)
  }
}

export interface GlobalPermissions {
  is_admin: boolean
  can_create_cases: boolean
  can_create_clients: boolean
  can_manage_users: boolean
  can_view_all_cases: boolean
  can_access_settings: boolean
}

function computePermissions(profile: UserProfile | null): GlobalPermissions {
  const role = profile?.system_role
  return {
    is_admin: role === 'admin_general',
    can_create_cases: role === 'admin_general' || role === 'case_leader',
    can_create_clients:
      role === 'admin_general' || role === 'case_leader' || role === 'lawyer_executive',
    can_manage_users: role === 'admin_general',
    can_view_all_cases: role === 'admin_general',
    can_access_settings: role === 'admin_general',
  }
}

export interface AuthContextValue {
  user: User | null
  profile: UserProfile | null
  isLoading: boolean
  permissions: GlobalPermissions
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
  hasRole: (role: UserProfile['system_role']) => boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

export interface AuthProviderProps {
  initialUser: User | null
  initialProfile: UserProfile | null
  children: React.ReactNode
}

export function AuthProvider({ initialUser, initialProfile, children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(initialUser)
  const [profile, setProfile] = useState<UserProfile | null>(initialProfile)
  const [isLoading, setIsLoading] = useState(false)

  logAuth('AuthProvider init from server', {
    hasUser: !!initialUser,
    userId: initialUser?.id,
    role: initialProfile?.system_role,
  })

  const supabase = createClient()

  const refreshProfile = useCallback(async () => {
    if (!user?.id) return
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()
    if (data) {
      setProfile(data as UserProfile)
      logAuth('refreshProfile', { role: (data as UserProfile).system_role })
    }
  }, [user?.id, supabase])

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      logAuth('onAuthStateChange', { event, hasSession: !!session?.user?.id })

      if (event === 'SIGNED_OUT') {
        setUser(null)
        setProfile(null)
        logAuth('state set to unauthenticated (SIGNED_OUT)')
        return
      }

      const nextUser = session?.user ?? null
      if (nextUser) {
        setUser(nextUser)
        if (!profile || nextUser.id !== profile.id) {
          supabase
            .from('profiles')
            .select('*')
            .eq('id', nextUser.id)
            .single()
            .then(({ data }) => {
              if (data) {
                setProfile(data as UserProfile)
                logAuth('profile synced from listener', { role: (data as UserProfile).system_role })
              }
            })
        }
      } else if (event === 'INITIAL_SESSION' && initialUser) {
        setUser(initialUser)
        setProfile(initialProfile)
        logAuth('kept initial server snapshot (INITIAL_SESSION)')
      }
    })
    return () => sub.subscription.unsubscribe()
  }, [initialUser, initialProfile, profile, supabase])

  const signOut = useCallback(async () => {
    logAuth('signOut called')
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
  }, [supabase])

  const hasRole = useCallback(
    (role: UserProfile['system_role']) => profile?.system_role === role,
    [profile?.system_role],
  )

  const value = useMemo<AuthContextValue>(() => {
    const perms = computePermissions(profile)
    return {
      user,
      profile,
      isLoading,
      permissions: perms,
      signOut,
      refreshProfile,
      hasRole,
    }
  }, [user, profile, isLoading, signOut, refreshProfile, hasRole])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return ctx
}
