/**
 * Lexia Contestación - Generate Draft API
 * POST /api/lexia/contestacion/generate-draft
 *
 * Generates contestación draft from session state. Streams content.
 * Updates session with draft_content, variant_seleccionada on completion.
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildFormDataFromSession } from '@/lib/lexia/contestacion/build-form-data'
import { selectContestacionStructure } from '@/lib/lexia/contestacion/select-structure'
import type { ContestacionSessionState } from '@/lib/lexia/contestacion/types'

export const maxDuration = 90

function buildDemandaContext(state: ContestacionSessionState): string {
  const parts: string[] = []
  if (state.tipo_demanda_detectado) {
    parts.push(`Tipo de demanda: ${state.tipo_demanda_detectado}`)
  }
  if (state.pretensiones_principales?.length) {
    parts.push(`Pretensiones: ${state.pretensiones_principales.join('; ')}`)
  }
  if (state.bloques?.length) {
    parts.push('Bloques de la demanda:')
    for (const b of state.bloques) {
      parts.push(`- ${b.titulo} (${b.tipo ?? 'otro'}): ${b.contenido.slice(0, 200)}...`)
    }
  }
  if (state.analisis_por_bloque && Object.keys(state.analisis_por_bloque).length > 0) {
    parts.push('Análisis por bloque (argumentos clave, puntos débiles):')
    for (const [id, a] of Object.entries(state.analisis_por_bloque)) {
      parts.push(`- Bloque ${id}: argumentos=${a.argumentos_clave.join(', ')}; débiles=${a.puntos_debiles.join(', ')}`)
    }
  }
  return parts.join('\n\n')
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const sessionId = body.sessionId as string | undefined
    const iterationInstruction = body.iterationInstruction as string | null | undefined

    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId is required' }, { status: 400 })
    }

    const { data: session, error: fetchError } = await supabase
      .from('lexia_contestacion_sessions')
      .select('id, user_id, case_id, demanda_raw, state')
      .eq('id', sessionId)
      .single()

    if (fetchError || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    if (session.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const state = (session.state ?? {}) as ContestacionSessionState
    if (!state.listo_para_redaccion || !state.form_data_consolidado) {
      return NextResponse.json(
        { error: 'Session not ready for redaction. Complete the contextualization flow first.' },
        { status: 400 }
      )
    }

    const caseId = session.case_id as string | null
    const formData = await buildFormDataFromSession(state, supabase, caseId)

    let variant = state.variant_seleccionada ?? ''
    if (!variant) {
      variant = await selectContestacionStructure(
        state.tipo_demanda_detectado,
        state.bloques ?? [],
        supabase
      )
    }

    const demandaContext = buildDemandaContext(state)

    let caseContext: { caseId?: string; caseNumber?: string; title?: string; type?: string } | null = null
    if (caseId) {
      const { data: caseRow } = await supabase
        .from('cases')
        .select('id, case_number, title, case_type')
        .eq('id', caseId)
        .single()
      if (caseRow) {
        caseContext = {
          caseId: caseRow.id,
          caseNumber: caseRow.case_number ?? '',
          title: caseRow.title ?? '',
          type: caseRow.case_type ?? undefined,
        }
      }
    }

    const url = new URL(req.url)
    const draftUrl = `${url.origin}/api/lexia/draft`

    const previousDraft = iterationInstruction ? (state.draft_content ?? '') : null

    const draftRes = await fetch(draftUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: req.headers.get('cookie') ?? '',
      },
      body: JSON.stringify({
        documentType: 'contestacion',
        variant,
        formData,
        caseContext,
        demandaContext,
        previousDraft,
        iterationInstruction: iterationInstruction ?? null,
      }),
    })

    if (!draftRes.ok) {
      const errData = await draftRes.json().catch(() => ({}))
      return NextResponse.json(
        { error: errData.error ?? 'Error generating draft' },
        { status: draftRes.status }
      )
    }

    const stream = draftRes.body
    if (!stream) {
      return NextResponse.json({ error: 'No stream returned' }, { status: 500 })
    }

    const decoder = new TextDecoder()
    let fullContent = ''

    const transformedStream = stream.pipeThrough(
      new TransformStream({
        async transform(chunk, controller) {
          fullContent += decoder.decode(chunk, { stream: true })
          controller.enqueue(chunk)
        },
        async flush() {
          try {
            await supabase
              .from('lexia_contestacion_sessions')
              .update({
                state: {
                  ...state,
                  variant_seleccionada: variant,
                  draft_content: fullContent,
                  draft_generado_at: new Date().toISOString(),
                },
              })
              .eq('id', sessionId)
          } catch (e) {
            console.error('[Contestacion] Error updating session with draft:', e)
          }
        },
      })
    )

    return new Response(transformedStream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
      },
    })
  } catch (err) {
    console.error('[Contestacion] generate-draft error:', err)
    return NextResponse.json(
      { error: 'Error generating draft' },
      { status: 500 }
    )
  }
}
