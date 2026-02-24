/**
 * SAC Credentials Verification
 *
 * POST /api/sac/credentials/verify
 *
 * Attempts a login against the SAC extranet to verify stored credentials.
 * Updates last_successful_login / last_failed_login accordingly.
 */
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { decrypt } from '@/lib/sac/crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifySacLogin } from '@/lib/sac/scraper'

export const maxDuration = 30

export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { data: creds } = await supabase
      .from('lawyer_sac_credentials')
      .select('id, extranet_username, encrypted_password, consecutive_failures')
      .eq('profile_id', user.id)
      .single()

    if (!creds) {
      return NextResponse.json(
        { error: 'No hay credenciales SAC configuradas' },
        { status: 404 }
      )
    }

    let password: string
    try {
      password = decrypt(creds.encrypted_password)
    } catch {
      return NextResponse.json(
        { error: 'No se pudo desencriptar la contraseña' },
        { status: 500 }
      )
    }

    const result = await verifySacLogin(creds.extranet_username, password)

    const admin = createAdminClient()
    const now = new Date().toISOString()

    if (result.success) {
      await admin
        .from('lawyer_sac_credentials')
        .update({
          last_successful_login: now,
          consecutive_failures: 0,
          is_active: true,
        })
        .eq('id', creds.id)

      return NextResponse.json({ success: true })
    } else {
      await admin
        .from('lawyer_sac_credentials')
        .update({
          last_failed_login: now,
          consecutive_failures: (creds.consecutive_failures ?? 0) + 1,
        })
        .eq('id', creds.id)

      return NextResponse.json(
        { success: false, error: result.error || 'Login fallido' },
        { status: 200 }
      )
    }
  } catch (err) {
    console.error('[SAC verify]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error de verificación' },
      { status: 500 }
    )
  }
}
