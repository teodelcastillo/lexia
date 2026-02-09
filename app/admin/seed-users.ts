/**
 * Seed Users Server Action
 * 
 * Creates test users for each role type in the system.
 * Only use in development environments.
 */
'use server'

import { createClient } from '@/lib/supabase/server'

/**
 * Test user credentials and metadata
 */
interface TestUser {
  email: string
  password: string
  firstName: string
  lastName: string
  role: 'admin_general' | 'case_leader' | 'lawyer_executive' | 'client'
  description: string
}

/**
 * Test users for each role
 */
const testUsers: TestUser[] = [
  {
    email: 'admin@estudiolegal.test',
    password: 'AdminTest2024!',
    firstName: 'Administrador',
    lastName: 'General',
    role: 'admin_general',
    description: 'Acceso completo a todas las funcionalidades del sistema',
  },
  {
    email: 'lider@estudiolegal.test',
    password: 'LiderTest2024!',
    firstName: 'María',
    lastName: 'González',
    role: 'case_leader',
    description: 'Responsable de casos - acceso completo a casos asignados',
  },
  {
    email: 'abogado@estudiolegal.test',
    password: 'AbogadoTest2024!',
    firstName: 'Carlos',
    lastName: 'Rodríguez',
    role: 'lawyer_executive',
    description: 'Abogado ejecutor - acceso a tareas y documentos de casos asignados',
  },
  {
    email: 'asistente@estudiolegal.test',
    password: 'AsistenteTest2024!',
    firstName: 'Patricia',
    lastName: 'López',
    role: 'lawyer_executive',
    description: 'Asistente legal - acceso limitado a tareas',
  },
  {
    email: 'cliente@estudiolegal.test',
    password: 'ClienteTest2024!',
    firstName: 'Juan',
    lastName: 'Pérez',
    role: 'client',
    description: 'Cliente externo - acceso solo lectura al portal de casos',
  },
]

/**
 * Seed database with test users
 * Returns array of created user credentials for testing
 */
export async function seedTestUsers() {
  const supabase = await createClient()

  console.log('[v0] Starting seed users process')

  // Get current user to verify admin access
  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser()

  if (!currentUser) {
    throw new Error('No autenticado. Por favor inicie sesión primero.')
  }

  console.log('[v0] Current user:', currentUser.id)

  // Get current user profile to check if admin
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('system_role')
    .eq('id', currentUser.id)
    .single()

  console.log('[v0] Current user profile:', profile, 'Error:', profileError)

  if (profile?.system_role !== 'admin_general') {
    throw new Error('Solo administradores pueden crear usuarios de prueba.')
  }

  const createdUsers = []
  const errors = []

  for (const testUser of testUsers) {
    try {
      console.log('[v0] Processing user:', testUser.email)

      // Check if user already exists in auth
      const { data: existingAuthUsers } = await supabase.auth.admin.listUsers()
      const existingUser = existingAuthUsers?.users?.find(
        (u) => u.email === testUser.email,
      )

      if (existingUser) {
        console.log('[v0] User already exists:', testUser.email)
        errors.push({
          email: testUser.email,
          error: 'El usuario ya existe en el sistema',
        })
        continue
      }

      // Create auth user using admin API
      console.log('[v0] Creating auth user:', testUser.email)
      const { data: authData, error: authError } =
        await supabase.auth.admin.createUser({
          email: testUser.email,
          password: testUser.password,
          email_confirm: true,
          user_metadata: {
            first_name: testUser.firstName,
            last_name: testUser.lastName,
            system_role: testUser.role,
          },
        })

      if (authError || !authData.user) {
        console.log('[v0] Auth error:', authError)
        errors.push({
          email: testUser.email,
          error: authError?.message || 'Error creating auth user',
        })
        continue
      }

      console.log('[v0] Auth user created:', authData.user.id)

      // Wait a bit for the trigger to create the profile
      await new Promise((resolve) => setTimeout(resolve, 1000))

      // Check if profile was auto-created by trigger
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', authData.user.id)
        .maybeSingle()

      if (existingProfile) {
        console.log('[v0] Profile auto-created by trigger')
        // Update the profile with correct data
        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            first_name: testUser.firstName,
            last_name: testUser.lastName,
            system_role: testUser.role,
            phone: '+54 9 351 000-0000',
            location: 'Córdoba, Argentina',
          })
          .eq('id', authData.user.id)

        if (updateError) {
          console.log('[v0] Profile update error:', updateError)
          await supabase.auth.admin.deleteUser(authData.user.id)
          errors.push({
            email: testUser.email,
            error: 'Error actualizando perfil: ' + updateError.message,
          })
          continue
        }
      } else {
        // Create profile manually if trigger didn't work
        // Get default organization for seed users
        const { data: defaultOrg } = await supabase
          .from('organizations')
          .select('id')
          .eq('slug', 'default')
          .single()
        
        console.log('[v0] Creating profile manually')
        const { error: profileError } = await supabase.from('profiles').insert({
          id: authData.user.id,
          email: testUser.email,
          first_name: testUser.firstName,
          last_name: testUser.lastName,
          system_role: testUser.role,
          phone: '+54 9 351 000-0000',
          organization_id: defaultOrg?.id || null, // Assign to default org if exists
          is_active: true,
        })

        if (profileError) {
          console.log('[v0] Profile creation error:', profileError)
          // Delete auth user if profile creation fails
          await supabase.auth.admin.deleteUser(authData.user.id)
          errors.push({
            email: testUser.email,
            error: 'Error creando perfil: ' + profileError.message,
          })
          continue
        }
      }

      console.log('[v0] User created successfully:', testUser.email)
      createdUsers.push({
        email: testUser.email,
        password: testUser.password,
        firstName: testUser.firstName,
        lastName: testUser.lastName,
        role: testUser.role,
        description: testUser.description,
        userId: authData.user.id,
      })
    } catch (error) {
      console.log('[v0] Unexpected error for', testUser.email, ':', error)
      errors.push({
        email: testUser.email,
        error: error instanceof Error ? error.message : 'Error desconocido',
      })
    }
  }

  console.log('[v0] Seed process complete. Created:', createdUsers.length, 'Errors:', errors.length)

  return {
    success: createdUsers.length > 0,
    createdUsers,
    errors: errors.length > 0 ? errors : undefined,
    message:
      createdUsers.length === testUsers.length
        ? 'Todos los usuarios de prueba fueron creados exitosamente'
        : `Se crearon ${createdUsers.length} de ${testUsers.length} usuarios`,
  }
}
