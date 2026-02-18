/**
 * Google Connection Status - Get connected services
 *
 * GET /api/google/status
 *
 * Returns { calendar: { connected: boolean, email?: string }, ... }
 */
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { data: connections } = await supabase
      .from('google_connections')
      .select('service, google_email')
      .eq('user_id', user.id)

    const status = {
      calendar: { connected: false, email: null as string | null },
      drive: { connected: false, email: null as string | null },
      sheets: { connected: false, email: null as string | null },
      docs: { connected: false, email: null as string | null },
    }

    connections?.forEach((c) => {
      if (c.service in status) {
        ;(status as Record<string, { connected: boolean; email: string | null }>)[c.service] = {
          connected: true,
          email: c.google_email ?? null,
        }
      }
    })

    return NextResponse.json(status)
  } catch (err) {
    console.error('[Google Status]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error al obtener estado' },
      { status: 500 }
    )
  }
}
