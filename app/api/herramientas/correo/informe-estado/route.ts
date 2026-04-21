/**
 * API: Generate case status fragment via AI (one case per request).
 * caseId: returns only the text for [Completar si corresponde] or one case in [INFORME DE CASOS].
 * Plain text, no HTML. No AI disclaimer.
 * For client report, the frontend calls this once per case and assembles the list with titles.
 */
import { createClient } from '@/lib/supabase/server'
import { generateText } from 'ai'
import { resolveModel } from '@/lib/ai/resolver'
import { getModelConfig } from '@/lib/ai/providers'
import { NextResponse } from 'next/server'

export const maxDuration = 60
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

type ActivityRow = {
  description?: string | null
  created_at: string
  action_type: string
  entity_type: string
  profiles?: { first_name: string; last_name: string } | { first_name: string; last_name: string }[] | null
}
type DeadlineRow = { title: string; due_date: string; deadline_type?: string | null }
type TaskRow = { title: string; status: string; due_date: string | null; priority?: string | null }

function buildCaseContext(
  caseRow: { case_number: string; title: string; status: string },
  activities: unknown[],
  deadlines: unknown[],
  tasks: unknown[]
): string {
  const caseNumber = caseRow.case_number ?? ''
  const caseTitle = caseRow.title ?? ''
  const caseStatus = STATUS_LABELS[caseRow.status] ?? caseRow.status ?? ''

  const activityLines = (activities as ActivityRow[]).map((a) => {
    const p = Array.isArray(a.profiles) ? a.profiles[0] ?? null : a.profiles
    const who = p ? `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || 'Sistema' : 'Sistema'
    const desc = a.description?.trim() || `${a.action_type} (${a.entity_type})`
    return `- ${formatDate(a.created_at)} — ${who}: ${desc}`
  })

  const deadlineLines = (deadlines as DeadlineRow[]).map((d) =>
    `- ${d.title}: ${formatDate(d.due_date)}${d.deadline_type ? ` [${d.deadline_type}]` : ''}`
  )

  const taskLines = (tasks as TaskRow[]).map((t) =>
    `- ${t.title} (${t.status})${t.due_date ? ` — vence ${formatDate(t.due_date)}` : ''}${t.priority ? ` [${t.priority}]` : ''}`
  )

  return `
EXPEDIENTE: ${caseNumber}
TÍTULO: ${caseTitle}
ESTADO: ${caseStatus}

ACTIVIDAD RECIENTE:
${activityLines.length > 0 ? activityLines.join('\n') : '(Sin actividad reciente)'}

PRÓXIMOS EVENTOS/PLAZOS:
${deadlineLines.length > 0 ? deadlineLines.join('\n') : '(Sin plazos próximos)'}

TAREAS PENDIENTES:
${taskLines.length > 0 ? taskLines.join('\n') : '(Sin tareas pendientes)'}
`.trim()
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const caseId = body?.caseId as string | undefined

    if (!caseId) {
      return NextResponse.json({ error: 'caseId requerido' }, { status: 400 })
    }

    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const config = getModelConfig('claude-sonnet') ?? getModelConfig('gpt4o')
    const model = resolveModel(config?.model ?? 'anthropic/claude-sonnet-4-20250514')

    // --- Single case: fragment for [Completar si corresponde] ---
    if (caseId) {
      const [
        { data: caseRow, error: caseErr },
        { data: activities },
        { data: deadlines },
        { data: tasks },
      ] = await Promise.all([
        supabase.from('cases').select('id, case_number, title, status').eq('id', caseId).single(),
        supabase
          .from('activity_log')
          .select(`id, action_type, entity_type, description, created_at, profiles:user_id ( first_name, last_name )`)
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

      const contextBlock = buildCaseContext(
        caseRow,
        activities ?? [],
        deadlines ?? [],
        tasks ?? []
      )

      const systemPrompt = `Eres un asistente que redacta textos breves de estado de expedientes para abogados.
Tu tarea es redactar ÚNICAMENTE el contenido que reemplaza el placeholder "[Completar si corresponde]" en un correo al cliente: una breve descripción del estado del caso y los próximos pasos, basada solo en los datos proporcionados.
No inventes datos. No uses etiquetas HTML. Responde en texto plano, uno o dos párrafos breves. No menciones que el texto está generado por IA.`

      const userPrompt = `Genera solo el fragmento que debe reemplazar "[Completar si corresponde]" (breve estado del caso y próximos pasos):

${contextBlock}

Responde únicamente con ese texto, sin explicaciones ni títulos.`

      const { text } = await generateText({
        model,
        system: systemPrompt,
        prompt: userPrompt,
        maxTokens: 512,
        temperature: 0.3,
      } as Parameters<typeof generateText>[0] & { maxTokens?: number })

      const fragment = (text ?? '').trim()
      return NextResponse.json({ fragment })
    }
  } catch (e) {
    console.error('[correo/informe-estado]', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error al generar el informe' },
      { status: 500 }
    )
  }
}
