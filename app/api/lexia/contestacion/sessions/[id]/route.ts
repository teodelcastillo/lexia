/**
 * Lexia Contestación - Get Session by ID
 * GET /api/lexia/contestacion/sessions/[id] - Load session for resuming
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    if (!id) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 })
    }

    const { data: session, error } = await supabase
      .from('lexia_contestacion_sessions')
      .select('id, user_id, case_id, demanda_raw, state, current_step, created_at, updated_at')
      .eq('id', id)
      .single()

    if (error || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    if (session.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json({
      session: {
        id: session.id,
        case_id: session.case_id,
        demanda_raw: session.demanda_raw,
        state: session.state ?? {},
        current_step: session.current_step,
        created_at: session.created_at,
        updated_at: session.updated_at,
      },
    })
  } catch (err) {
    console.error('[Contestacion] GET session error:', err)
    return NextResponse.json(
      { error: 'Error loading session' },
      { status: 500 }
    )
  }
}
