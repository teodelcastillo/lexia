/**
 * Servicio de avance de etapa procesal.
 *
 * Cuando un abogado avanza la etapa de un caso:
 *  1. Actualiza etapa_actual en cases
 *  2. Registra el cambio en case_stage_history
 *  3. Crea las tareas automáticas definidas en stage-rules.ts
 *  4. Crea los vencimientos automáticos (en deadlines)
 *  5. Envía notificación a los miembros del caso
 *
 * Cómputo de días hábiles: lunes a viernes, excluye feriados nacionales argentinos
 * (lista fija — no conecta a fuente externa).
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { addDays } from 'date-fns'
import { getStageRule, type ProcesoPipo, type AutoTask, type StageRule } from './stage-rules'

// ---------------------------------------------------------------------------
// Tipos de entrada / salida
// ---------------------------------------------------------------------------

export interface AdvanceStageParams {
  caseId: string
  organizationId: string
  procesoPipo: ProcesoPipo
  newStageSlug: string
  notas?: string
  userId: string
  /** Si false, solo calcula preview sin persistir */
  dryRun?: boolean
}

export interface CreatedTask {
  id: string
  title: string
  due_date?: string
}

export interface CreatedDeadline {
  id: string
  title: string
  due_date: string
}

export interface AdvanceStageResult {
  ok: boolean
  stage: StageRule
  createdTasks: CreatedTask[]
  createdDeadlines: CreatedDeadline[]
  error?: string
}

// ---------------------------------------------------------------------------
// Cómputo de días hábiles
// ---------------------------------------------------------------------------

/**
 * Feriados nacionales argentinos — lista fija para el año en curso.
 * Los trasladables se asumen en la fecha oficial más reciente.
 */
function getArgentineHolidays(year: number): Set<string> {
  const fixed = [
    `${year}-01-01`, // Año Nuevo
    `${year}-03-24`, // Día de la Memoria
    `${year}-04-02`, // Malvinas
    `${year}-05-01`, // Día del Trabajo
    `${year}-05-25`, // Revolución de Mayo
    `${year}-06-17`, // Güemes (trasladable)
    `${year}-06-20`, // Belgrano
    `${year}-07-09`, // Independencia
    `${year}-08-17`, // San Martín (trasladable)
    `${year}-10-12`, // Respeto a la Diversidad (trasladable)
    `${year}-11-20`, // Día de la Soberanía (trasladable)
    `${year}-12-08`, // Inmaculada Concepción
    `${year}-12-25`, // Navidad
  ]
  return new Set(fixed)
}

function isBusinessDay(date: Date): boolean {
  const dow = date.getDay()
  if (dow === 0 || dow === 6) return false
  const y = date.getFullYear()
  const holidays = getArgentineHolidays(y)
  const iso = date.toISOString().slice(0, 10)
  return !holidays.has(iso)
}

/** Suma n días hábiles a partir de date (el día de inicio no cuenta) */
export function addBusinessDays(date: Date, days: number): Date {
  let result = new Date(date)
  let added = 0
  while (added < days) {
    result = addDays(result, 1)
    if (isBusinessDay(result)) added++
  }
  return result
}

function computeDueDate(task: AutoTask, from: Date): Date | undefined {
  if (!task.deadline_days) return undefined
  return task.deadline_type === 'corridos'
    ? addDays(from, task.deadline_days)
    : addBusinessDays(from, task.deadline_days)
}

// ---------------------------------------------------------------------------
// Servicio principal
// ---------------------------------------------------------------------------

export async function advanceStage(
  supabase: SupabaseClient,
  params: AdvanceStageParams
): Promise<AdvanceStageResult> {
  const { caseId, organizationId, procesoPipo, newStageSlug, notas, userId, dryRun = false } = params

  const stage = getStageRule(procesoPipo, newStageSlug)
  if (!stage) {
    return {
      ok: false,
      stage: { slug: newStageSlug, label: newStageSlug, order: 0, autoTasks: [] },
      createdTasks: [],
      createdDeadlines: [],
      error: `Etapa desconocida: ${newStageSlug}`,
    }
  }

  const now = new Date()
  const createdTasks: CreatedTask[] = []
  const createdDeadlines: CreatedDeadline[] = []

  if (dryRun) {
    // Solo devuelve la preview sin tocar la base de datos
    for (const task of stage.autoTasks) {
      const due = computeDueDate(task, now)
      createdTasks.push({ id: 'preview', title: task.title, due_date: due?.toISOString() })
      if (due) {
        createdDeadlines.push({
          id: 'preview',
          title: task.title,
          due_date: due.toISOString(),
        })
      }
    }
    return { ok: true, stage, createdTasks, createdDeadlines }
  }

  // 1. Actualizar etapa en cases
  const { error: caseError } = await supabase
    .from('cases')
    .update({
      etapa_actual: newStageSlug,
      etapa_updated_at: now.toISOString(),
      etapa_updated_by: userId,
    })
    .eq('id', caseId)

  if (caseError) {
    return { ok: false, stage, createdTasks, createdDeadlines, error: caseError.message }
  }

  // 2. Registrar en historial
  await supabase.from('case_stage_history').insert({
    case_id: caseId,
    organization_id: organizationId,
    etapa: stage.slug,
    etapa_label: stage.label,
    notas: notas ?? null,
    created_by: userId,
  })

  // 3. Crear tareas y vencimientos
  for (const taskDef of stage.autoTasks) {
    const due = computeDueDate(taskDef, now)

    // Crear tarea
    const { data: task } = await supabase
      .from('tasks')
      .insert({
        title: taskDef.title,
        description: taskDef.description ?? null,
        case_id: caseId,
        assigned_to: userId,
        created_by: userId,
        status: 'pending',
        priority: taskDef.priority ?? 'medium',
        due_date: due?.toISOString() ?? null,
      })
      .select('id, title, due_date')
      .single()

    if (task) {
      createdTasks.push({
        id: task.id,
        title: task.title,
        due_date: task.due_date ?? undefined,
      })
    }

    // Crear vencimiento si hay fecha calculada
    if (due) {
      const deadlineTitle = taskDef.articulo
        ? `${taskDef.title} — ${taskDef.articulo}`
        : taskDef.title

      const { data: deadline } = await supabase
        .from('deadlines')
        .insert({
          title: deadlineTitle,
          description: taskDef.description ?? null,
          deadline_type: 'Procesal',
          due_date: due.toISOString(),
          case_id: caseId,
          created_by: userId,
          reminder_days: [7, 3, 1],
          is_completed: false,
        })
        .select('id, title, due_date')
        .single()

      if (deadline) {
        createdDeadlines.push({
          id: deadline.id,
          title: deadline.title,
          due_date: deadline.due_date,
        })
      }
    }
  }

  // 4. Notificar a los miembros del caso
  await notifyStageAdvance(supabase, caseId, organizationId, stage.label, userId)

  return { ok: true, stage, createdTasks, createdDeadlines }
}

async function notifyStageAdvance(
  supabase: SupabaseClient,
  caseId: string,
  organizationId: string,
  stageLabel: string,
  triggeredBy: string
): Promise<void> {
  try {
    // Obtener datos del caso
    const { data: caseData } = await supabase
      .from('cases')
      .select('title, case_number')
      .eq('id', caseId)
      .single()

    if (!caseData) return

    // Obtener miembros del caso
    const { data: participants } = await supabase
      .from('case_participants')
      .select('profile_id')
      .eq('case_id', caseId)

    const profileIds = (participants ?? [])
      .map((p: { profile_id: string }) => p.profile_id)
      .filter((id: string) => id !== triggeredBy)

    if (profileIds.length === 0) return

    const notifications = profileIds.map((profileId: string) => ({
      user_id: profileId,
      organization_id: organizationId,
      type: 'case_stage_advanced',
      title: `Nueva etapa: ${stageLabel}`,
      message: `El expediente ${caseData.case_number} — ${caseData.title} avanzó a la etapa "${stageLabel}"`,
      data: { case_id: caseId, stage: stageLabel },
      is_read: false,
    }))

    await supabase.from('notifications').insert(notifications)
  } catch {
    // Notificaciones no son críticas
  }
}
