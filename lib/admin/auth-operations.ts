/**
 * Admin Auth Operations - Server-only
 *
 * Encapsulates auth.admin calls using service role. Never expose to client.
 * Callers must validate admin role and organization before invoking.
 */
import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import type { User } from '@supabase/supabase-js'

export interface CreateAuthUserParams {
  email: string
  password: string
  emailConfirm?: boolean
  metadata: {
    first_name?: string
    last_name?: string
    system_role?: string
    organization_id?: string | null
  }
}

export interface CreateAuthUserResult {
  user: User | null
  error: string | null
}

export async function createAuthUser(
  params: CreateAuthUserParams
): Promise<CreateAuthUserResult> {
  const admin = createAdminClient()
  const { data, error } = await admin.auth.admin.createUser({
    email: params.email,
    password: params.password,
    email_confirm: params.emailConfirm ?? true,
    user_metadata: params.metadata,
  })
  return {
    user: data?.user ?? null,
    error: error?.message ?? null,
  }
}

export async function deleteAuthUser(userId: string): Promise<{ error: string | null }> {
  const admin = createAdminClient()
  const { error } = await admin.auth.admin.deleteUser(userId)
  return { error: error?.message ?? null }
}

export interface ListUsersResult {
  users: User[]
  error: string | null
}

export async function listAuthUsers(): Promise<ListUsersResult> {
  const admin = createAdminClient()
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 })
  return {
    users: data?.users ?? [],
    error: error?.message ?? null,
  }
}
