/**
 * Lexia Contestación - Save Draft API
 * POST /api/lexia/contestacion/save-draft
 *
 * Saves contestación draft to lexia_drafts and returns draftId for redirect.
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getDefaultDraftTitle } from '@/lib/lexia/draft-title'
import { buildFormDataFromSession } from '@/lib/lexia/contestacion/build-form-data'
import type { ContestacionSessionState } from '@/lib/lexia/contestacion/types'

export async function POST(req: Request) {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const sessionId = body.sessionId as string | undefined
    const name = body.name as string | undefined

    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId is required' }, { status: 400 })
    }

    const { data: session, error: fetchError } = await supabase
      .from('lexia_contestacion_sessions')
      .select('id, user_id, case_id, state')
      .eq('id', sessionId)
      .single()

    if (fetchError || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    if (session.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const state = (session.state ?? {}) as ContestacionSessionState
    const draftContent = state.draft_content ?? ''

    if (!draftContent.trim()) {
      return NextResponse.json(
        { error: 'No draft content to save. Generate the draft first.' },
        { status: 400 }
      )
    }

    const formData = await buildFormDataFromSession(
      state,
      supabase,
      session.case_id as string | null
    )

    const draftName = name?.trim() || getDefaultDraftTitle('contestacion', formData)

    const { data: draft, error: insertError } = await supabase
      .from('lexia_drafts')
      .insert({
        user_id: user.id,
        document_type: 'contestacion',
        name: draftName,
        content: draftContent,
        form_data: formData,
        case_id: session.case_id,
      })
      .select('id')
      .single()

    if (insertError) {
      console.error('[Contestacion] save-draft insert error:', insertError)
      return NextResponse.json({ error: 'Failed to save draft' }, { status: 500 })
    }

    await supabase
      .from('lexia_contestacion_sessions')
      .update({
        state: {
          ...state,
          draft_id: draft.id,
        },
      })
      .eq('id', sessionId)

    return NextResponse.json({
      draftId: draft.id,
      caseId: session.case_id,
    })
  } catch (err) {
    console.error('[Contestacion] save-draft error:', err)
    return NextResponse.json(
      { error: 'Error saving draft' },
      { status: 500 }
    )
  }
}
