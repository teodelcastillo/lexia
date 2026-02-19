import { createClient } from '@/lib/supabase/server'
import { createAuthUser, deleteAuthUser } from '@/lib/admin/auth-operations'
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

    // Verify admin role and get organization_id
    const { data: profile } = await supabase
      .from('profiles')
      .select('system_role, organization_id')
      .eq('id', user.id)
      .single()

    if (profile?.system_role !== 'admin_general') {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 403 }
      )
    }

    if (!profile?.organization_id) {
      return NextResponse.json(
        { error: 'Su usuario no está asociado a una organización' },
        { status: 400 }
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

    // Get person details first (needed for profile creation)
    const { data: person, error: personError } = await supabase
      .from('people')
      .select('name, first_name, last_name, organization_id')
      .eq('id', personId)
      .single()

    if (personError || !person) {
      return NextResponse.json(
        { error: 'Persona no encontrada' },
        { status: 404 }
      )
    }

    if (person.organization_id && person.organization_id !== profile.organization_id) {
      return NextResponse.json(
        { error: 'La persona seleccionada no pertenece a su organización' },
        { status: 403 }
      )
    }

    // Validate company belongs to admin's organization
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('id, organization_id')
      .eq('id', companyId)
      .single()

    if (companyError || !company) {
      return NextResponse.json(
        { error: 'Empresa no encontrada' },
        { status: 404 }
      )
    }
    if (company.organization_id && company.organization_id !== profile.organization_id) {
      return NextResponse.json(
        { error: 'La empresa seleccionada no pertenece a su organización' },
        { status: 403 }
      )
    }

    // Create auth user via service role (server-only)
    const tempPassword = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)
    const { user: authUser, error: signUpError } = await createAuthUser({
      email,
      password: tempPassword,
      emailConfirm: true,
      metadata: {
        organization_id: profile.organization_id ? String(profile.organization_id) : null,
        system_role: 'client',
        first_name: person.first_name || person.name?.split(' ')[0] || '',
        last_name: person.last_name || person.name?.split(' ')[1] || '',
      },
    })

    if (signUpError || !authUser) {
      console.error('[create-client-user] Error creating auth user:', signUpError)
      if (signUpError?.includes('already registered') || signUpError?.includes('already exists')) {
        return NextResponse.json(
          { error: 'Este email ya está registrado en el sistema' },
          { status: 400 }
        )
      }
      return NextResponse.json(
        { error: 'Error al crear usuario. Intente nuevamente.' },
        { status: 400 }
      )
    }

    // The trigger should create the profile automatically, but verify it was created
    await new Promise(resolve => setTimeout(resolve, 500))
    
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', authUser.id)
      .single()

    if (!existingProfile) {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: authUser.id,
          email,
          first_name: person.first_name || person.name?.split(' ')[0] || '',
          last_name: person.last_name || person.name?.split(' ')[1] || '',
          system_role: 'client',
          organization_id: profile.organization_id, // Assign to admin's organization
          is_active: true,
        })
        .select()
        .single()

      if (profileError) {
        console.error('[create-client-user] Error creating profile:', profileError)
        const { error: delErr } = await deleteAuthUser(authUser.id)
        if (delErr) console.error('[create-client-user] Error cleaning up auth user:', delErr)
        return NextResponse.json(
          { error: 'Error al crear perfil de usuario. Intente nuevamente.' },
          { status: 400 }
        )
      }
    }

    const { data: finalProfile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authUser.id)
      .single()

    if (!finalProfile) {
      const { error: delErr } = await deleteAuthUser(authUser.id)
      if (delErr) console.error('[create-client-user] Error cleaning up auth user:', delErr)
      return NextResponse.json(
        { error: 'Error: El perfil no se creó correctamente' },
        { status: 500 }
      )
    }

    const { error: updatePersonError } = await supabase
      .from('people')
      .update({ portal_user_id: authUser.id })
      .eq('id', personId)

    if (updatePersonError) {
      console.error('[create-client-user] Error linking person to portal user:', updatePersonError)
      // Don't fail the whole operation, but log it
      // The user was created successfully, just the link failed
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Usuario cliente creado exitosamente',
        user: finalProfile,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('[create-client-user] Error creating client user:', error)
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido'
    
    // Provide more specific error messages
    if (errorMessage.toLowerCase().includes('database') || errorMessage.toLowerCase().includes('constraint')) {
      return NextResponse.json(
        { error: `Error de base de datos: ${errorMessage}` },
        { status: 500 }
      )
    }
    
    return NextResponse.json(
      { error: `Error interno del servidor: ${errorMessage}` },
      { status: 500 }
    )
  }
}
