/**
 * Server Action: Create Team Member
 * 
 * Creates a new team member by:
 * 1. Creating an auth user in Supabase
 * 2. Automatically creating a profile via trigger
 * 3. Sending a password reset email for them to set their password
 */
'use server'

import { createClient } from '@/lib/supabase/server'
import { createAuthUser, deleteAuthUser } from '@/lib/admin/auth-operations'

interface CreateTeamMemberData {
  email: string
  firstName: string
  lastName: string
  role: 'admin_general' | 'case_leader' | 'lawyer_executive'
}

interface CreateTeamMemberResult {
  success?: boolean
  error?: string
}

/**
 * Creates a new team member account
 */
export async function createTeamMember(
  data: CreateTeamMemberData
): Promise<CreateTeamMemberResult> {
  try {
    const supabase = await createClient()

    // Verify the current user is an admin
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return { error: 'No autenticado' }
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('system_role, organization_id')
      .eq('id', user.id)
      .single()

    if (profile?.system_role !== 'admin_general') {
      return { error: 'No tiene permisos para crear usuarios' }
    }

    if (!profile?.organization_id) {
      return { error: 'Su usuario no está asociado a una organización' }
    }

    // Generate a temporary password (user will change it via email)
    const tempPassword = `Temp${Math.random().toString(36).slice(-8)}!`

    // Create the auth user using service role (server-only, never exposed to client)
    const { user: newUser, error: createUserError } = await createAuthUser({
      email: data.email,
      password: tempPassword,
      emailConfirm: true,
      metadata: {
        first_name: data.firstName,
        last_name: data.lastName,
        system_role: data.role,
        organization_id: profile.organization_id ? String(profile.organization_id) : null,
      },
    })

    if (createUserError) {
      console.error('[createTeamMember] Error creating user:', createUserError)
      if (createUserError.includes('already registered') || createUserError.includes('already exists')) {
        return { error: 'Este email ya está registrado en el sistema' }
      }
      return { error: 'Error al crear usuario. Intente nuevamente.' }
    }

    if (!newUser) {
      return { error: 'No se pudo crear el usuario' }
    }

    // The trigger will automatically create the profile
    // But let's verify it was created
    await new Promise(resolve => setTimeout(resolve, 500)) // Wait for trigger to execute
    
    const { data: createdProfile, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', newUser.id)
      .single()

    if (profileError || !createdProfile) {
      console.error('[createTeamMember] Profile not created by trigger:', profileError)
      
      // Manually create the profile as fallback with organization_id
      const { error: manualProfileError } = await supabase
        .from('profiles')
        .insert({
          id: newUser.id,
          email: data.email,
          first_name: data.firstName,
          last_name: data.lastName,
          system_role: data.role,
          organization_id: profile.organization_id, // Assign to admin's organization
          is_active: true,
        })

      if (manualProfileError) {
        console.error('[createTeamMember] Error creating profile manually:', manualProfileError)
        const { error: delErr } = await deleteAuthUser(newUser.id)
        if (delErr) console.error('[createTeamMember] Error cleaning up auth user:', delErr)
        return { error: 'Error al crear perfil. Intente nuevamente.' }
      }
    }

    // Send password reset email so they can set their own password
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      data.email,
      {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/auth/reset-password?next=/dashboard`,
      }
    )

    if (resetError) {
      console.error('[createTeamMember] Error sending password reset:', resetError)
      // Don't fail the whole operation if email fails, but log it
    }

    return { success: true }
  } catch (error) {
    console.error('[createTeamMember] Unexpected error creating team member:', error)
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido'
    
    // Check for database-related errors
    if (errorMessage.toLowerCase().includes('database') || errorMessage.toLowerCase().includes('constraint')) {
      return { error: `Error de base de datos: ${errorMessage}` }
    }
    
    return { error: `Error inesperado al crear el usuario: ${errorMessage}` }
  }
}
