/**
 * Lexia Contestación - Orchestrate API
 * POST /api/lexia/contestacion/orchestrate - Execute next step of the agent
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getNextAction, executeAction } from '@/lib/lexia/contestacion/orchestrator'
import type { ContestacionSessionState } from '@/lib/lexia/contestacion/types'

const LEXIA_RATE_LIMIT_WINDOW_MS = 60_000
const LEXIA_RATE_LIMIT_MAX = 60
const rateLimitStore = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(userId: string): boolean {
  const now = Date.now()
  const entry = rateLimitStore.get(userId)
  if (!entry) {
    rateLimitStore.set(userId, { count: 1, resetAt: now + LEXIA_RATE_LIMIT_WINDOW_MS })
    return true
  }
  if (now >= entry.resetAt) {
    rateLimitStore.set(userId, { count: 1, resetAt: now + LEXIA_RATE_LIMIT_WINDOW_MS })
    return true
  }
  if (entry.count >= LEXIA_RATE_LIMIT_MAX) return false
  entry.count += 1
  return true
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!checkRateLimit(user.id)) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429, headers: { 'Retry-After': '60' } }
      )
    }

    const body = await req.json().catch(() => ({}))
    const sessionId = body.sessionId as string | undefined

    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId is required' }, { status: 400 })
    }

    const { data: session, error: fetchError } = await supabase
      .from('lexia_contestacion_sessions')
      .select('id, user_id, demanda_raw, state, current_step')
      .eq('id', sessionId)
      .single()

    if (fetchError || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    if (session.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const state = (session.state ?? {}) as ContestacionSessionState
    const demandaRaw = session.demanda_raw ?? null

    const action = getNextAction(state, demandaRaw)

    if (action.type === 'parse') {
      const newState = await executeAction(action, state, demandaRaw)
      const nextStep = newState.bloques?.length ? 'parsed' : 'init'

      const { error: updateError } = await supabase
        .from('lexia_contestacion_sessions')
        .update({
          state: newState,
          current_step: nextStep,
        })
        .eq('id', sessionId)

      if (updateError) {
        console.error('[Contestacion] Orchestrate update error:', updateError)
        return NextResponse.json({ error: 'Failed to update session' }, { status: 500 })
      }

      return NextResponse.json({
        action: { type: action.type },
        state: newState,
        nextStep,
      })
    }

    if (action.type === 'complete') {
      return NextResponse.json({
        action: { type: action.type },
        state,
        nextStep: 'parsed',
      })
    }

    if (action.type === 'wait_user') {
      return NextResponse.json({
        action: { type: action.type, payload: action.payload },
        state,
        nextStep: 'init',
      })
    }

    return NextResponse.json({
      action: { type: action.type, payload: (action as { type: 'error'; payload: { message: string } }).payload },
      state,
      nextStep: session.current_step,
    })
  } catch (err) {
    console.error('[Contestacion] Orchestrate error:', err)
    return NextResponse.json(
      { error: 'Error processing request' },
      { status: 500 }
    )
  }
}
