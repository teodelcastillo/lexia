/**
 * SAC Diagnostic API
 *
 * GET  /api/sac/debug — Sin credenciales: verifica alcance HTTP al SAC y detecta
 *                       campos del formulario de login ASP.NET.
 * POST /api/sac/debug — Con credenciales almacenadas: intenta login completo
 *                       y devuelve qué campos encontró y el resultado.
 *
 * Solo accesible por admin_general o case_leader.
 * Usa fetch() puro — sin Playwright ni Chromium.
 */
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { decrypt } from '@/lib/sac/crypto'
import { diagnoseSacConnectionHttp, debugSacLoginHttp } from '@/lib/sac/http-scraper'

export const maxDuration = 30

async function getAuthorizedUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, organization_id')
    .eq('id', user.id)
    .single()

  if (!profile) return null
  if (!['admin_general', 'case_leader'].includes(profile.role)) return null
  return { user, profile, supabase }
}

/** Sin credenciales — verifica alcance HTTP y detecta campos del formulario */
export async function GET() {
  const auth = await getAuthorizedUser()
  if (!auth) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  try {
    const result = await diagnoseSacConnectionHttp()
    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error de diagnóstico' },
      { status: 500 }
    )
  }
}

/** Con credenciales almacenadas — intenta login completo y reporta cada paso */
export async function POST() {
  const auth = await getAuthorizedUser()
  if (!auth) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { data: creds } = await auth.supabase
    .from('lawyer_sac_credentials')
    .select('extranet_username, encrypted_password, is_active')
    .eq('profile_id', auth.user.id)
    .single()

  if (!creds) {
    return NextResponse.json(
      { error: 'No hay credenciales SAC configuradas para este usuario' },
      { status: 404 }
    )
  }

  let password: string
  try {
    password = decrypt(creds.encrypted_password)
  } catch {
    return NextResponse.json({ error: 'No se pudo desencriptar la contraseña' }, { status: 500 })
  }

  try {
    const result = await debugSacLoginHttp(creds.extranet_username, password)
    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error de diagnóstico' },
      { status: 500 }
    )
  }
}
