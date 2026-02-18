/**
 * Google OAuth Callback - Exchange code for tokens and save
 *
 * GET /api/google/callback?code=...&state=...
 *
 * Verifies state, exchanges code for tokens, stores in google_connections.
 */
import { createClient } from '@/lib/supabase/server'
import { createOAuth2Client, getTokensFromCode } from '@/lib/google/client'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  const cookieStore = await cookies()
  const storedState = cookieStore.get('google_oauth_state')?.value
  const userId = cookieStore.get('google_oauth_user')?.value
  const service = cookieStore.get('google_oauth_service')?.value ?? 'calendar'

  // Clear cookies
  const clearCookies = [
    'google_oauth_state=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0',
    'google_oauth_user=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0',
    'google_oauth_service=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0',
  ]

  const redirectToConfig = (success: boolean) => {
    const base = `${request.nextUrl.origin}/configuracion`
    const url = new URL(base)
    url.searchParams.set('google', success ? 'connected' : 'error')
    if (error) url.searchParams.set('error', error)
    return url.toString()
  }

  const response = NextResponse.redirect(redirectToConfig(false))
  clearCookies.forEach((c) => response.headers.append('Set-Cookie', c))

  if (error) {
    console.error('[Google Callback] OAuth error:', error)
    return NextResponse.redirect(redirectToConfig(false))
  }

  if (!code || !state || !storedState || state !== storedState || !userId) {
    console.error('[Google Callback] Invalid state or missing params')
    return response
  }

  try {
    const oauth2 = createOAuth2Client()
    const tokens = await getTokensFromCode(oauth2, code)

    if (!tokens.access_token) {
      throw new Error('No access token received')
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.id !== userId) {
      throw new Error('User mismatch')
    }

    // Get user info from Google (optional, for display)
    let googleEmail: string | null = null
    let googleName: string | null = null
    if (tokens.id_token) {
      try {
        const payload = JSON.parse(
          Buffer.from(tokens.id_token.split('.')[1] ?? '', 'base64').toString()
        )
        googleEmail = payload.email ?? null
        googleName = payload.name ?? null
      } catch {
        // ignore
      }
    }

    const expiresAt = tokens.expiry_date
      ? new Date(tokens.expiry_date).toISOString()
      : null

    const { error: upsertError } = await supabase
      .from('google_connections')
      .upsert(
        {
          user_id: userId,
          service,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token ?? null,
          token_expires_at: expiresAt,
          google_email: googleEmail,
          google_name: googleName,
        },
        { onConflict: 'user_id,service' }
      )

    if (upsertError) {
      console.error('[Google Callback] DB error:', upsertError)
      return NextResponse.redirect(redirectToConfig(false))
    }

    return NextResponse.redirect(redirectToConfig(true))
  } catch (err) {
    console.error('[Google Callback]', err)
    return NextResponse.redirect(redirectToConfig(false))
  }
}
