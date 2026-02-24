/**
 * SAC Credentials API
 *
 * GET  /api/sac/credentials — Fetch current user's SAC credential status
 * PUT  /api/sac/credentials — Create or update SAC credentials
 */
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { encrypt } from '@/lib/sac/crypto'
import type { SacCredentialsInfo } from '@/lib/sac/types'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { data: creds } = await supabase
      .from('lawyer_sac_credentials')
      .select('extranet_username, is_active, last_successful_login, consecutive_failures')
      .eq('profile_id', user.id)
      .single()

    const info: SacCredentialsInfo = creds
      ? {
          hasCredentials: true,
          extranet_username: creds.extranet_username,
          is_active: creds.is_active,
          last_successful_login: creds.last_successful_login,
          consecutive_failures: creds.consecutive_failures,
        }
      : { hasCredentials: false }

    return NextResponse.json(info)
  } catch (err) {
    console.error('[SAC credentials GET]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error' },
      { status: 500 }
    )
  }
}

export async function PUT(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('system_role, organization_id')
      .eq('id', user.id)
      .single()

    if (!profile || !['case_leader', 'lawyer_executive'].includes(profile.system_role)) {
      return NextResponse.json(
        { error: 'Solo abogados pueden configurar credenciales SAC' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { extranet_username, password } = body as {
      extranet_username: string
      password: string
    }

    if (!extranet_username?.trim() || !password?.trim()) {
      return NextResponse.json(
        { error: 'Usuario y contraseña son requeridos' },
        { status: 400 }
      )
    }

    const { data: existing } = await supabase
      .from('lawyer_sac_credentials')
      .select('id')
      .eq('profile_id', user.id)
      .single()

    const encryptedPassword = encrypt(password)

    if (existing) {
      const { error } = await supabase
        .from('lawyer_sac_credentials')
        .update({
          extranet_username: extranet_username.trim(),
          encrypted_password: encryptedPassword,
          is_active: true,
          consecutive_failures: 0,
        })
        .eq('id', existing.id)

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
    } else {
      const { error } = await supabase
        .from('lawyer_sac_credentials')
        .insert({
          profile_id: user.id,
          organization_id: profile.organization_id,
          extranet_username: extranet_username.trim(),
          encrypted_password: encryptedPassword,
        })

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[SAC credentials PUT]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error al guardar credenciales' },
      { status: 500 }
    )
  }
}
