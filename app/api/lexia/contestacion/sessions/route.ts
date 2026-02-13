/**
 * Lexia Contestación - Sessions API
 * POST /api/lexia/contestacion/sessions - Create a new contestación session
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkCasePermission } from '@/lib/utils/access-control'

const DEMANDA_RAW_MAX_LENGTH = 100_000

export async function POST(req: Request) {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const caseId = body.caseId as string | null | undefined
    const demandaRaw = (body.demandaRaw as string | null | undefined) ?? ''
    const demandaDocumentId = body.demandaDocumentId as string | null | undefined

    if (caseId) {
      const canView = await checkCasePermission(supabase, user.id, caseId, 'can_view')
      if (!canView) {
        return NextResponse.json({ error: 'Forbidden: no access to this case' }, { status: 403 })
      }
    }

    let validatedDocId: string | null = null
    if (demandaDocumentId) {
      const { data: doc, error: docError } = await supabase
        .from('documents')
        .select('id, case_id')
        .eq('id', demandaDocumentId)
        .single()

      if (docError || !doc) {
        return NextResponse.json({ error: 'Document not found' }, { status: 400 })
      }
      const canViewDoc = await checkCasePermission(supabase, user.id, doc.case_id, 'can_view')
      if (!canViewDoc) {
        return NextResponse.json({ error: 'Forbidden: no access to document case' }, { status: 403 })
      }
      if (caseId && doc.case_id !== caseId) {
        return NextResponse.json(
          { error: 'Document must belong to the same case' },
          { status: 400 }
        )
      }
      validatedDocId = doc.id
    }

    const trimmedDemanda = demandaRaw.slice(0, DEMANDA_RAW_MAX_LENGTH)

    const { data: session, error } = await supabase
      .from('lexia_contestacion_sessions')
      .insert({
        user_id: user.id,
        case_id: caseId || null,
        demanda_raw: trimmedDemanda || null,
        demanda_document_id: validatedDocId || null,
        state: {},
        current_step: 'init',
      })
      .select('id, state, current_step, case_id, created_at')
      .single()

    if (error) {
      console.error('[Contestacion] Sessions POST error:', error)
      return NextResponse.json({ error: 'Failed to create session' }, { status: 500 })
    }

    return NextResponse.json({
      sessionId: session.id,
      state: session.state ?? {},
      current_step: session.current_step,
      case_id: session.case_id,
    })
  } catch (err) {
    console.error('[Contestacion] Sessions error:', err)
    return NextResponse.json(
      { error: 'Error processing request' },
      { status: 500 }
    )
  }
}
