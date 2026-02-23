/**
 * API: Generate case status report (informe de estado) via AI
 * Uses activity log, upcoming deadlines, and tasks for the case.
 * Returns formatted HTML body and subject. No AI disclaimer in output.
 */
import { createClient } from '@/lib/supabase/server'
import { generateText } from 'ai'
import { resolveModel } from '@/lib/ai/resolver'
import { getModelConfig } from '@/lib/ai/providers'
import { NextResponse } from 'next/server'

export const maxDuration = 30
export const dynamic = 'force-dynamic'

const STATUS_LABELS: Record<string, string> = {
  active: 'Activo',
  pending: 'Pendiente',
  on_hold: 'En Espera',
  closed: 'Cerrado',
  archived: 'Archivado',
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const caseId = body?.caseId as string | undefined
    if (!caseId) {
      return NextResponse.json({ error: 'caseId requerido' }, { status: 400 })
    }

    const supabase = await createClient()

    const [
      { data: caseRow, error: caseErr },
      { data: activities },
      { data: deadlines },
      { data: tasks },
    ] = await Promise.all([
      supabase
        .from('cases')
        .select('id, case_number, title, status')
        .eq('id', caseId)
        .single(),
      supabase
        .from('activity_log')
        .select(`
          id,
          action_type,
          entity_type,
          description,
          created_at,
          profiles:user_id ( first_name, last_name )
        `)
        .eq('case_id', caseId)
        .order('created_at', { ascending: false })
        .limit(25),
      supabase
        .from('deadlines')
        .select('id, title, due_date, deadline_type, status')
        .eq('case_id', caseId)
        .eq('is_completed', false)
        .gte('due_date', new Date().toISOString().slice(0, 10))
        .order('due_date', { ascending: true })
        .limit(15),
      supabase
        .from('tasks')
        .select('id, title, status, due_date, priority')
        .eq('case_id', caseId)
        .in('status', ['pending', 'in_progress'])
        .order('due_date', { ascending: true, nullsFirst: false })
        .limit(15),
    ])

    if (caseErr || !caseRow) {
      return NextResponse.json({ error: 'Caso no encontrado' }, { status: 404 })
    }

    const caseNumber = caseRow.case_number ?? ''
    const caseTitle = caseRow.title ?? ''
    const caseStatus = STATUS_LABELS[caseRow.status] ?? caseRow.status ?? ''

    const activityLines = (activities ?? []).map((a: { description: string | null; created_at: string; action_type: string; entity_type: string; profiles: { first_name: string; last_name: string } | { first_name: string; last_name: string }[] | null }) => {
      const p = Array.isArray(a.profiles) ? a.profiles[0] ?? null : a.profiles
      const who = p ? `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || 'Sistema' : 'Sistema'
      const desc = a.description?.trim() || `${a.action_type} (${a.entity_type})`
      return `- ${formatDate(a.created_at)} — ${who}: ${desc}`
    })

    const deadlineLines = (deadlines ?? []).map((d: { title: string; due_date: string; deadline_type: string | null }) =>
      `- ${d.title}: ${formatDate(d.due_date)}${d.deadline_type ? ` [${d.deadline_type}]` : ''}`
    )

    const taskLines = (tasks ?? []).map((t: { title: string; status: string; due_date: string | null; priority: string | null }) =>
      `- ${t.title} (${t.status})${t.due_date ? ` — vence ${formatDate(t.due_date)}` : ''}${t.priority ? ` [${t.priority}]` : ''}`
    )

    const contextBlock = `
EXPEDIENTE: ${caseNumber}
TÍTULO: ${caseTitle}
ESTADO ACTUAL: ${caseStatus}

--- ACTIVIDAD RECIENTE (últimos registros) ---
${activityLines.length > 0 ? activityLines.join('\n') : '(Sin actividad reciente registrada)'}

--- PRÓXIMOS EVENTOS / PLAZOS ---
${deadlineLines.length > 0 ? deadlineLines.join('\n') : '(No hay plazos próximos cargados)'}

--- TAREAS PENDIENTES O EN CURSO ---
${taskLines.length > 0 ? taskLines.join('\n') : '(No hay tareas pendientes)'}
`.trim()

    const systemPrompt = `Eres un asistente que redacta informes de estado de expedientes para abogados. 
Tu tarea es redactar un informe breve y profesional ÚNICAMENTE con la información proporcionada: actividad reciente del caso, próximos eventos y tareas.
No inventes datos. No menciones fuentes ni que el texto está generado por IA.
Responde en HTML válido para correo electrónico. Usa solo estas etiquetas: <p>, <strong>, <ul>, <li>, <h3>, <br>. Sin <html> ni <body>.
Estructura sugerida: un párrafo introductorio del estado del expediente; luego secciones claras (por ejemplo "Actividad reciente", "Próximos plazos", "Tareas en curso") con listas. Fechas en formato legible.`

    const userPrompt = `Redacta un informe de estado del expediente basándote exclusivamente en estos datos:

${contextBlock}

Responde solo con el HTML del informe (sin explicaciones ni markdown).`

    const config = getModelConfig('claude-sonnet') ?? getModelConfig('gpt4o')
    const model = resolveModel(config?.model ?? 'anthropic/claude-sonnet-4-20250514')

    const { text } = await generateText({
      model,
      system: systemPrompt,
      prompt: userPrompt,
      // maxTokens is supported at runtime but not in the TS type,
      // so we widen the type as in other AI helpers (generate-title).
      maxTokens: 2048,
      temperature: 0.3,
    } as Parameters<typeof generateText>[0] & { maxTokens?: number })

    const bodyHtml = (text ?? '').trim()
    const subject = `Estado procesal - Expediente ${caseNumber}`

    return NextResponse.json({ subject, bodyHtml })
  } catch (e) {
    console.error('[correo/informe-estado]', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error al generar el informe' },
      { status: 500 }
    )
  }
}
