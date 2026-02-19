/**
 * Event Status Utilities
 *
 * Separates temporal state (date-based) from preparation state (task-based)
 * to avoid false "overdue" signals when work is already done.
 *
 * Rules:
 * - Temporal: proximo | hoy | pasado (date only)
 * - Preparation: sin_iniciar | en_curso | listo | no_aplica (from tasks)
 * - Legal risk: alto only when deliverable + past + not ready
 */

export type TemporalState = 'proximo' | 'hoy' | 'pasado'
export type PreparationState = 'sin_iniciar' | 'en_curso' | 'listo' | 'no_aplica'
export type LegalRisk = 'alto' | 'medio' | 'bajo' | 'ninguno'
export type EventKind = 'deliverable' | 'meeting' | 'hearing' | 'other'

export interface TaskLike {
  status: string
}

export interface EventStatusResult {
  temporal: TemporalState
  preparation: PreparationState
  legalRisk: LegalRisk
  eventKind: EventKind
  completedCount: number
  totalCount: number
  percentReady: number
}

const MS_PER_DAY = 24 * 60 * 60 * 1000

/**
 * Computes temporal state from event date (start or due).
 */
export function getTemporalState(date: Date | string, now: Date = new Date()): TemporalState {
  const d = typeof date === 'string' ? new Date(date) : date
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  const eventDay = new Date(d)
  eventDay.setHours(0, 0, 0, 0)
  const diffDays = Math.round((eventDay.getTime() - today.getTime()) / MS_PER_DAY)
  if (diffDays < 0) return 'pasado'
  if (diffDays === 0) return 'hoy'
  return 'proximo'
}

/**
 * Computes preparation state from associated tasks.
 * - 0 tasks: no_aplica
 * - All completed: listo
 * - Any in_progress or under_review: en_curso
 * - Else: sin_iniciar
 */
export function getPreparationState(tasks: TaskLike[]): PreparationState {
  if (!tasks || tasks.length === 0) return 'no_aplica'
  const active = tasks.filter((t) => t.status !== 'cancelled')
  if (active.length === 0) return 'listo'
  const completed = active.filter((t) => t.status === 'completed')
  if (completed.length === active.length) return 'listo'
  const inProgress = active.some(
    (t) => t.status === 'in_progress' || t.status === 'under_review'
  )
  return inProgress ? 'en_curso' : 'sin_iniciar'
}

/**
 * Computes legal risk.
 * - alto: deliverable + pasado + not listo
 * - medio: deliverable + hoy + not listo
 * - bajo: meeting/hearing/other, or deliverable + listo
 * - ninguno: no_aplica preparation
 */
export function getLegalRisk(
  eventKind: EventKind,
  temporal: TemporalState,
  preparation: PreparationState
): LegalRisk {
  if (preparation === 'no_aplica') return 'ninguno'
  if (eventKind === 'meeting' || eventKind === 'hearing' || eventKind === 'other') {
    return 'bajo'
  }
  if (preparation === 'listo') return 'bajo'
  if (temporal === 'pasado') return 'alto'
  if (temporal === 'hoy') return 'medio'
  return 'bajo'
}

/** Maps deadline_type to EventKind */
const deadlineTypeToKind: Record<string, EventKind> = {
  court_date: 'hearing',
  filing_deadline: 'deliverable',
  meeting: 'meeting',
  other: 'other',
  legal: 'deliverable',
  judicial: 'deliverable',
  administrative: 'deliverable',
  hearing: 'hearing',
  internal: 'other',
}

/**
 * Infers event kind from summary/description (fallback when no DB field).
 * If deadlineType is provided (e.g. court_date, filing_deadline), uses that mapping.
 */
export function inferEventKind(
  summary: string | null,
  description?: string | null,
  deadlineType?: string | null
): EventKind {
  if (deadlineType && deadlineTypeToKind[deadlineType]) {
    return deadlineTypeToKind[deadlineType]
  }
  const text = `${summary ?? ''} ${description ?? ''}`.toLowerCase()
  if (
    /venc|plazo|presentar|contestaci[oó]n|demanda|escrito|presentaci[oó]n|filing|deadline/.test(
      text
    )
  ) {
    return 'deliverable'
  }
  if (/audiencia|hearing|juicio|tribunal/.test(text)) return 'hearing'
  if (/reuni[oó]n|meeting|juan|maria|cliente|abogado/.test(text)) return 'meeting'
  return 'other'
}

/**
 * Computes preparation percentage (0-100).
 */
export function getPreparationPercent(tasks: TaskLike[]): { completed: number; total: number; percent: number } {
  const active = (tasks ?? []).filter((t) => t.status !== 'cancelled')
  const total = active.length
  if (total === 0) return { completed: 0, total: 0, percent: 100 }
  const completed = active.filter((t) => t.status === 'completed').length
  return {
    completed,
    total,
    percent: Math.round((completed / total) * 100),
  }
}

/** Valid preparation override values from DB */
const VALID_PREPARATION_OVERRIDE = ['sin_iniciar', 'en_curso', 'listo', 'no_aplica'] as const

/**
 * Full event status computation.
 * Precedence: preparation_override > calculation from tasks > no_aplica
 * eventKindOverride (from DB) overrides inference.
 */
export function getEventStatus(
  date: Date | string,
  tasks: TaskLike[],
  eventKindOverride?: EventKind | string | null,
  summary?: string | null,
  description?: string | null,
  deadlineType?: string | null,
  preparationOverride?: PreparationState | string | null,
  now: Date = new Date()
): EventStatusResult {
  const temporal = getTemporalState(date, now)
  const kind: EventKind =
    eventKindOverride && ['deliverable', 'meeting', 'hearing', 'other'].includes(String(eventKindOverride))
      ? (eventKindOverride as EventKind)
      : inferEventKind(summary ?? null, description ?? null, deadlineType ?? null)
  const preparation: PreparationState =
    preparationOverride && VALID_PREPARATION_OVERRIDE.includes(preparationOverride as (typeof VALID_PREPARATION_OVERRIDE)[number])
      ? (preparationOverride as PreparationState)
      : getPreparationState(tasks)
  const legalRisk = getLegalRisk(kind, temporal, preparation)
  const { completed, total, percent } = getPreparationPercent(tasks)
  return {
    temporal,
    preparation,
    legalRisk,
    eventKind: kind,
    completedCount: completed,
    totalCount: total,
    percentReady: preparation === 'listo' && total === 0 ? 100 : percent,
  }
}

/** UI labels for temporal state */
export const temporalStateLabels: Record<TemporalState, string> = {
  proximo: 'Próximo',
  hoy: 'Hoy',
  pasado: 'Pasado',
}

/** UI labels for preparation state */
export const preparationStateLabels: Record<PreparationState, string> = {
  sin_iniciar: 'Sin iniciar',
  en_curso: 'En curso',
  listo: 'Listo',
  no_aplica: 'No aplica',
}

/** UI labels for legal risk */
export const legalRiskLabels: Record<LegalRisk, string> = {
  alto: 'Riesgo alto',
  medio: 'Riesgo medio',
  bajo: 'Riesgo bajo',
  ninguno: '',
}

/** UI labels for event kind */
export const eventKindLabels: Record<EventKind, string> = {
  deliverable: 'Entregable',
  meeting: 'Reunión',
  hearing: 'Audiencia',
  other: 'Otro',
}
