/**
 * Calendar data fetching utilities
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { CalendarItem } from '@/components/calendar/calendar-view'

export async function fetchCalendarItems(
  supabase: SupabaseClient,
  userId: string,
  start: Date,
  end: Date
): Promise<{
  itemsByDate: Record<string, CalendarItem[]>
  tasksByDeadline: Map<string, { status: string }[]>
  tasksByGoogleEvent: Map<string, { status: string }[]>
}> {
  const startIso = start.toISOString()
  const endIso = end.toISOString()

  const [deadlinesRes, tasksRes, googleEventsRes] = await Promise.all([
    supabase
      .from('deadlines')
      .select(`id, title, due_date, deadline_type, case:cases(id, case_number, title)`)
      .gte('due_date', startIso)
      .lte('due_date', endIso)
      .order('due_date', { ascending: true }),
    supabase
      .from('tasks')
      .select(`id, title, due_date, status, case:cases(id, case_number, title)`)
      .not('due_date', 'is', null)
      .gte('due_date', startIso)
      .lte('due_date', endIso)
      .or(`assigned_to.eq.${userId},created_by.eq.${userId}`)
      .order('due_date', { ascending: true }),
    supabase
      .from('google_calendar_events')
      .select('id, google_event_id, summary, description, location, start_at, end_at, all_day')
      .eq('user_id', userId)
      .neq('status', 'cancelled')
      .lte('start_at', endIso)
      .gte('end_at', startIso),
  ])

  const deadlines = deadlinesRes.data ?? []
  const tasks = tasksRes.data ?? []
  const googleEvents = googleEventsRes.data ?? []

  const deadlineIds = deadlines.map((d) => d.id)
  const { data: deadlineTasks } =
    deadlineIds.length > 0
      ? await supabase
          .from('tasks')
          .select('id, status, deadline_id')
          .in('deadline_id', deadlineIds)
          .neq('status', 'cancelled')
      : { data: [] as { id: string; status: string; deadline_id: string }[] }
  const tasksByDeadline = new Map<string, { status: string }[]>()
  for (const t of deadlineTasks ?? []) {
    const list = tasksByDeadline.get(t.deadline_id) ?? []
    list.push({ status: t.status })
    tasksByDeadline.set(t.deadline_id, list)
  }

  const googleEventIds = googleEvents.map((e) => e.google_event_id)
  const { data: googleEventTasks } =
    googleEventIds.length > 0
      ? await supabase
          .from('tasks')
          .select('id, status, google_calendar_event_id')
          .in('google_calendar_event_id', googleEventIds)
          .neq('status', 'cancelled')
      : { data: [] as { id: string; status: string; google_calendar_event_id: string }[] }
  const tasksByGoogleEvent = new Map<string, { status: string }[]>()
  for (const t of googleEventTasks ?? []) {
    const list = tasksByGoogleEvent.get(t.google_calendar_event_id) ?? []
    list.push({ status: t.status })
    tasksByGoogleEvent.set(t.google_calendar_event_id, list)
  }

  const itemsByDate: Record<string, CalendarItem[]> = {}

  function addToDate(key: string, item: CalendarItem) {
    if (!itemsByDate[key]) itemsByDate[key] = []
    itemsByDate[key].push(item)
  }

  deadlines.forEach((d) => {
    const key = d.due_date.slice(0, 10)
    addToDate(key, {
      type: 'deadline',
      id: d.id,
      title: d.title,
      date: d.due_date,
      deadline_type: d.deadline_type ?? undefined,
      case: d.case as { case_number?: string },
      tasks: tasksByDeadline.get(d.id) ?? [],
    })
  })

  tasks.forEach((t) => {
    if (!t.due_date) return
    const key = t.due_date.slice(0, 10)
    addToDate(key, {
      type: 'task',
      id: t.id,
      title: t.title,
      date: t.due_date,
      case: t.case as { case_number?: string },
      status: t.status,
    })
  })

  googleEvents.forEach((e) => {
    const key = e.start_at.slice(0, 10)
    addToDate(key, {
      type: 'google',
      id: e.id,
      google_event_id: e.google_event_id,
      summary: e.summary,
      start_at: e.start_at,
      end_at: e.end_at,
      description: e.description,
      location: e.location,
      all_day: e.all_day,
      tasks: tasksByGoogleEvent.get(e.google_event_id) ?? [],
    })
  })

  Object.keys(itemsByDate).forEach((key) => {
    itemsByDate[key].sort((a, b) => {
      const aDate = a.type === 'google' ? a.start_at : a.date
      const bDate = b.type === 'google' ? b.start_at : b.date
      return new Date(aDate).getTime() - new Date(bDate).getTime()
    })
  })

  return { itemsByDate, tasksByDeadline, tasksByGoogleEvent }
}
