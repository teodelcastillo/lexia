import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * POST /api/admin/create-client-user
 * Create a new client user account linked to a person and company
 */
export async function POST(req: Request) {
  try {
    const supabase = await createClient()

    // Check if user is authenticated and is admin
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'No autenticado' },
        { status: 401 }
      )
    }

    // Verify admin role
    const { data: profile } = await supabase
      .from('profiles')
      .select('system_role')
      .eq('id', user.id)
      .single()

    if (profile?.system_role !== 'admin_general') {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 403 }
      )
    }

    // Parse request body
    const { email, personId, companyId } = await req.json()

    if (!email || !personId || !companyId) {
      return NextResponse.json(
        { error: 'Email, persona y empresa son requeridos' },
        { status: 400 }
      )
    }

    // Create auth user
    const { data: authData, error: signUpError } = await supabase.auth.admin.createUser({
      email,
      password: Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2),
      email_confirm: true,
    })

    if (signUpError || !authData.user) {
      return NextResponse.json(
        { error: signUpError?.message || 'Error al crear usuario' },
        { status: 400 }
      )
    }

    // Get person details to populate profile
    const { data: person, error: personError } = await supabase
      .from('people')
      .select('name, first_name, last_name')
      .eq('id', personId)
      .single()

    if (personError || !person) {
      return NextResponse.json(
        { error: 'Persona no encontrada' },
        { status: 404 }
      )
    }

    // Create profile for client user (profiles table doesn't have person_id/company_id - relationship via people.portal_user_id)
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: authData.user.id,
        email,
        first_name: person.first_name || person.name?.split(' ')[0] || '',
        last_name: person.last_name || person.name?.split(' ')[1] || '',
        system_role: 'client',
      })
      .select()
      .single()

    if (profileError) {
      // Clean up auth user if profile creation fails
      await supabase.auth.admin.deleteUser(authData.user.id)
      return NextResponse.json(
        { error: 'Error al crear perfil de usuario' },
        { status: 400 }
      )
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Usuario cliente creado exitosamente',
        user: profileData,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('[v0] Error creating client user:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
