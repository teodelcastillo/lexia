/**
 * Google OAuth Connect - Start OAuth flow
 *
 * POST /api/google/connect
 * Body: { service: 'calendar' | 'drive' | 'sheets' | 'docs' }
 *
 * Returns the authorization URL to redirect the user to.
 */
import { createClient } from '@/lib/supabase/server'
import { createOAuth2Client, getAuthUrl, type GoogleService } from '@/lib/google/client'
import { NextResponse } from 'next/server'
import { randomBytes } from 'crypto'

const VALID_SERVICES: GoogleService[] = ['calendar', 'drive', 'sheets', 'docs']

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const service = (body.service ?? 'calendar') as string

    if (!VALID_SERVICES.includes(service as GoogleService)) {
      return NextResponse.json(
        { error: `Servicio inválido. Use: ${VALID_SERVICES.join(', ')}` },
        { status: 400 }
      )
    }

    const state = randomBytes(16).toString('hex')
    // Store state in cookie for verification (short-lived, 10 min)
    const stateCookie = `google_oauth_state=${state}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600`
    const userCookie = `google_oauth_user=${user.id}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600`
    const serviceCookie = `google_oauth_service=${service}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600`

    const oauth2 = createOAuth2Client()
    const authUrl = getAuthUrl(oauth2, service as GoogleService, state)

    const response = NextResponse.json({ url: authUrl })
    response.headers.append('Set-Cookie', stateCookie)
    response.headers.append('Set-Cookie', userCookie)
    response.headers.append('Set-Cookie', serviceCookie)
    return response
  } catch (err) {
    console.error('[Google Connect]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error al conectar con Google' },
      { status: 500 }
    )
  }
}
