/**
 * Lexia Contestación - Orchestrate API
 * POST /api/lexia/contestacion/orchestrate - Execute next step of the agent
 *
 * Etapa 1: Uses getNextAction for parse phase.
 * Etapa 2: Uses getAgentDecision (LLM) when state has bloques; supports userResponses.
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getNextAction, executeAction } from '@/lib/lexia/contestacion/orchestrator'
import { getAgentDecision } from '@/lib/lexia/contestacion/agent'
import type {
  ContestacionSessionState,
  BlockResponse,
} from '@/lib/lexia/contestacion/types'

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
    const userInput = body.userInput as string | null | undefined
    const userResponses = body.userResponses as Record<string, BlockResponse> | null | undefined

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

    let state = (session.state ?? {}) as ContestacionSessionState
    const demandaRaw = session.demanda_raw ?? null

    if (userResponses && Object.keys(userResponses).length > 0) {
      state = {
        ...state,
        respuestas_usuario: { ...(state.respuestas_usuario ?? {}), ...userResponses },
      }
    }

    const hasBloques = !!state.bloques?.length
    const action = hasBloques
      ? await getAgentDecision(state, userInput)
      : getNextAction(state, demandaRaw)

    const executableActions = ['parse', 'analyze', 'generate_questions', 'ready_for_redaction']
    if (executableActions.includes(action.type)) {
      const newState = await executeAction(action, state, demandaRaw)

      let nextStep = session.current_step
      if (action.type === 'parse') {
        nextStep = newState.bloques?.length ? 'parsed' : 'init'
      } else if (action.type === 'analyze') {
        nextStep = 'analyzed'
      } else if (action.type === 'generate_questions') {
        nextStep = 'questions'
      } else if (action.type === 'ready_for_redaction') {
        nextStep = 'ready_for_redaction'
      }

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

      const res: Record<string, unknown> = {
        action: { type: action.type, payload: (action as { payload?: unknown }).payload },
        state: newState,
        nextStep,
      }
      if (action.type === 'generate_questions' && newState.preguntas_generadas) {
        res.preguntas = newState.preguntas_generadas
      }
      if (action.type === 'wait_user' && (action as { payload?: { preguntas?: unknown } }).payload?.preguntas) {
        res.preguntas = (action as { payload: { preguntas: unknown } }).payload.preguntas
      }
      return NextResponse.json(res)
    }

    if (action.type === 'wait_user') {
      return NextResponse.json({
        action: { type: action.type, payload: action.payload },
        state,
        nextStep: state.preguntas_generadas?.length ? 'questions' : session.current_step,
      })
    }

    if (action.type === 'need_more_info') {
      return NextResponse.json({
        action: { type: action.type, payload: action.payload },
        state,
        nextStep: 'need_more_info',
      })
    }

    if (action.type === 'complete') {
      return NextResponse.json({
        action: { type: action.type },
        state,
        nextStep: 'parsed',
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
