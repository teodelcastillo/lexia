/**
 * Calendar Reminders Job
 *
 * Creates notifications for upcoming:
 * - Deadlines (vencimientos)
 * - Tasks with due_date
 * - Google Calendar events
 *
 * Uses admin client (service role) for cron - no user session.
 */
import { createAdminClient } from '@/lib/supabase/admin'
import {
  notifyDeadlineApproaching,
  notifyTaskApproaching,
  notifyCalendarEventApproaching,
} from './notifications'

const REMINDER_DAYS = [7, 3, 1] as const
const TODAY_START = () => {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}
const TODAY_END = () => {
  const d = new Date()
  d.setHours(23, 59, 59, 999)
  return d.toISOString()
}

function getDateRangeForDays(days: number) {
  const start = new Date()
  start.setDate(start.getDate() + days)
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setHours(23, 59, 59, 999)
  return { start: start.toISOString(), end: end.toISOString() }
}

/**
 * Check if we already sent a reminder for this entity today (avoid duplicates)
 */
async function alreadyNotifiedToday(
  supabase: Awaited<ReturnType<typeof createAdminClient>>,
  type: 'deadline_approaching' | 'task_approaching' | 'calendar_event_approaching',
  entityId: string,
  daysBefore: number
) {
  const dayStart = TODAY_START()
  const { data: matches } = await supabase
    .from('notifications')
    .select('id')
    .eq('type', type)
    .gte('created_at', dayStart)
    .contains('metadata', { source_id: entityId, days_before: daysBefore })
    .limit(1)

  return (matches?.length ?? 0) > 0
}

export async function runCalendarRemindersJob() {
  const supabase = createAdminClient()
  let created = 0

  // --- Deadlines ---
  for (const days of REMINDER_DAYS) {
    const { start, end } = getDateRangeForDays(days)
    const { data: deadlines } = await supabase
      .from('deadlines')
      .select('id, title, due_date, case_id, organization_id')
      .gte('due_date', start)
      .lte('due_date', end)
      .order('due_date', { ascending: true })

    for (const d of deadlines ?? []) {
      const notified = await alreadyNotifiedToday(supabase, 'deadline_approaching', d.id, days)
      if (notified) continue

      await notifyDeadlineApproaching(
        d.id,
        d.title ?? 'Sin título',
        d.case_id ?? '',
        d.due_date,
        days,
        { supabase, metadata: { source_id: d.id, days_before: days } }
      )
      created++
    }
  }

  // --- Tasks with due_date ---
  for (const days of REMINDER_DAYS) {
    const { start, end } = getDateRangeForDays(days)
    const { data: tasks } = await supabase
      .from('tasks')
      .select('id, title, due_date, case_id, assigned_to, created_by, organization_id')
      .not('due_date', 'is', null)
      .gte('due_date', start)
      .lte('due_date', end)
      .neq('status', 'completed')
      .order('due_date', { ascending: true })

    for (const t of tasks ?? []) {
      if (!t.due_date) continue
      const notified = await alreadyNotifiedToday(supabase, 'task_approaching', t.id, days)
      if (notified) continue

      await notifyTaskApproaching(
        t.id,
        t.title ?? 'Sin título',
        t.case_id ?? '',
        t.due_date,
        days,
        { supabase, metadata: { source_id: t.id, days_before: days } }
      )
      created++
    }
  }

  // --- Google Calendar events ---
  for (const days of REMINDER_DAYS) {
    const { start, end } = getDateRangeForDays(days)
    const { data: events } = await supabase
      .from('google_calendar_events')
      .select('id, user_id, summary, start_at, end_at, google_event_id')
      .neq('status', 'cancelled')
      .gte('start_at', start)
      .lte('start_at', end)
      .order('start_at', { ascending: true })

    for (const e of events ?? []) {
      const notified = await alreadyNotifiedToday(supabase, 'calendar_event_approaching', e.id, days)
      if (notified) continue

      await notifyCalendarEventApproaching(
        e.id,
        e.google_event_id,
        e.summary ?? 'Evento',
        e.start_at,
        e.user_id,
        days,
        { supabase, metadata: { source_id: e.id, days_before: days } }
      )
      created++
    }
  }

  // Same-day reminders (events starting today)
  const { data: todayEvents } = await supabase
    .from('google_calendar_events')
    .select('id, user_id, summary, start_at, google_event_id')
    .neq('status', 'cancelled')
    .gte('start_at', TODAY_START())
    .lte('start_at', TODAY_END())
    .order('start_at', { ascending: true })

  for (const e of todayEvents ?? []) {
    const notified = await alreadyNotifiedToday(supabase, 'calendar_event_approaching', e.id, 0)
    if (notified) continue

    await notifyCalendarEventApproaching(
      e.id,
      e.google_event_id,
      e.summary ?? 'Evento',
      e.start_at,
      e.user_id,
      0,
      { supabase, metadata: { source_id: e.id, days_before: 0 } }
    )
    created++
  }

  return { created }
}
