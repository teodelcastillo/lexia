/**
 * Google OAuth Disconnect - Remove stored connection
 *
 * POST /api/google/disconnect
 * Body: { service: 'calendar' | 'drive' | 'sheets' | 'docs' }
 */
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const VALID_SERVICES = ['calendar', 'drive', 'sheets', 'docs'] as const

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const service = body.service ?? 'calendar'

    if (!VALID_SERVICES.includes(service)) {
      return NextResponse.json(
        { error: `Servicio inválido. Use: ${VALID_SERVICES.join(', ')}` },
        { status: 400 }
      )
    }

    const { error } = await supabase
      .from('google_connections')
      .delete()
      .eq('user_id', user.id)
      .eq('service', service)

    if (error) {
      console.error('[Google Disconnect]', error)
      return NextResponse.json({ error: 'Error al desconectar' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[Google Disconnect]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error al desconectar' },
      { status: 500 }
    )
  }
}
