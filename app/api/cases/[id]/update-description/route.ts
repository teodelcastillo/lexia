/**
 * API: Actualizar descripción de caso de forma progresiva
 *
 * Toma la descripción actual y el contexto del caso (tareas, notas, vencimientos,
 * documentos) y genera una descripción actualizada que incorpora la nueva
 * información sin perder el contenido previo.
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateObject } from 'ai'
import { z } from 'zod'
import { resolveModel } from '@/lib/ai/resolver'

const DescriptionSchema = z.object({
  description: z.string().describe('Descripción actualizada del caso legal'),
})

const SYSTEM_PROMPT = `Eres un abogado argentino que mantiene actualizadas las descripciones de expedientes judiciales.

Tu tarea es ACTUALIZAR la descripción existente del caso de forma PROGRESIVA. Es decir:
1. CONSERVA el contenido actual: no elimines información ya presente
2. INCORPORA la nueva información contextual (tareas, notas, vencimientos, documentos)
3. INTEGRA de forma coherente: añade párrafos o oraciones que complementen la descripción
4. MANTÉN el estilo jurídico y la estructura lógica
5. Si la descripción actual está vacía, genera una descripción completa desde cero con todo el contexto

La descripción resultante debe ser fluida, sin repeticiones innecesarias, y reflejar el estado actual del caso.`

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: caseId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Check permission: leader of the case or admin_general
    const { data: assignment } = await supabase
      .from('case_assignments')
      .select('case_role')
      .eq('case_id', caseId)
      .eq('user_id', user.id)
      .maybeSingle()

    const { data: profile } = await supabase
      .from('profiles')
      .select('system_role')
      .eq('id', user.id)
      .single()

    const isAdmin = profile?.system_role === 'admin_general'
    const isLeader = assignment?.case_role === 'leader'
    const canEdit = isAdmin || isLeader

    if (!canEdit) {
      return NextResponse.json({ error: 'Sin permiso para actualizar este caso' }, { status: 403 })
    }

    // Load case with full context
    const { data: caseData, error: caseError } = await supabase
      .from('cases')
      .select(`
        id,
        case_number,
        title,
        case_type,
        description,
        court_number,
        jurisdiction,
        court_name,
        opposing_party,
        opposing_counsel,
        filing_date,
        companies(company_name, name),
        deadlines(title, due_date, status, description),
        tasks(title, status, priority, description),
        case_notes(content, created_at)
      `)
      .eq('id', caseId)
      .single()

    if (caseError || !caseData) {
      return NextResponse.json({ error: 'Caso no encontrado' }, { status: 404 })
    }

    const company = caseData.companies as { company_name?: string; name?: string } | null
    const companyName = company?.company_name || company?.name || null

    const deadlines = (caseData.deadlines as Array<{
      title: string
      due_date: string
      status: string
      description?: string | null
    }>) || []

    const tasks = (caseData.tasks as Array<{
      title: string
      status: string
      priority: string
      description?: string | null
    }>) || []

    const notes = (caseData.case_notes as Array<{ content: string; created_at: string }>) || []

    // Build context sections
    const parts: string[] = []

    parts.push('--- DATOS BASE DEL CASO ---')
    parts.push(`Número: ${caseData.case_number}`)
    parts.push(`Título: ${caseData.title}`)
    parts.push(`Tipo: ${caseData.case_type}`)
    if (companyName) parts.push(`Cliente: ${companyName}`)
    if (caseData.court_number) parts.push(`Expediente: ${caseData.court_number}`)
    if (caseData.jurisdiction) parts.push(`Jurisdicción: ${caseData.jurisdiction}`)
    if (caseData.court_name) parts.push(`Tribunal: ${caseData.court_name}`)
    if (caseData.opposing_party) parts.push(`Contraparte: ${caseData.opposing_party}`)
    if (caseData.opposing_counsel) parts.push(`Abogado contraparte: ${caseData.opposing_counsel}`)
    if (caseData.filing_date) parts.push(`Fecha presentación: ${caseData.filing_date}`)

    parts.push('\n--- DESCRIPCIÓN ACTUAL (conservar y mejorar) ---')
    parts.push(caseData.description?.trim() || '(Sin descripción previa - generar desde cero)')

    if (deadlines.length > 0) {
      parts.push('\n--- VENCIMIENTOS ---')
      for (const d of deadlines.slice(0, 10)) {
        const desc = d.description?.trim() ? ` - ${d.description}` : ''
        parts.push(`- ${d.title} (${d.due_date}) [${d.status}]${desc}`)
      }
    }

    if (tasks.length > 0) {
      parts.push('\n--- TAREAS ---')
      for (const t of tasks.slice(0, 10)) {
        const desc = t.description?.trim() ? ` - ${t.description}` : ''
        parts.push(`- ${t.title} [${t.priority}] [${t.status}]${desc}`)
      }
    }

    if (notes.length > 0) {
      parts.push('\n--- NOTAS RECIENTES ---')
      for (const n of notes.slice(0, 5)) {
        parts.push(`- ${n.content.substring(0, 300)}${n.content.length > 300 ? '...' : ''}`)
      }
    }

    const contextText = parts.join('\n')

    const { object } = await generateObject({
      model: resolveModel('anthropic/claude-sonnet-4-20250514'),
      schema: DescriptionSchema,
      prompt: `Actualiza la descripción del caso de forma progresiva. Conserva lo existente e incorpora la nueva información contextual.

${contextText}`,
      system: SYSTEM_PROMPT,
      temperature: 0.35,
    })

    const { error: updateError } = await supabase
      .from('cases')
      .update({
        description: object.description,
        updated_at: new Date().toISOString(),
      })
      .eq('id', caseId)

    if (updateError) {
      console.error('[update-description] DB error:', updateError)
      return NextResponse.json(
        { error: 'Error al guardar la descripción' },
        { status: 500 }
      )
    }

    return NextResponse.json({ description: object.description })
  } catch (err) {
    console.error('[update-description] Error:', err)
    return NextResponse.json(
      { error: 'Error al actualizar la descripción' },
      { status: 500 }
    )
  }
}
