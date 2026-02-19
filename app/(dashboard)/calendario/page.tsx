/**
 * Calendar Page
 *
 * Legal calendar view: deadlines, tasks, and Google Calendar events.
 * Supports day, week, and month views.
 */
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CalendarView, type CalendarItem } from '@/components/calendar/calendar-view'
import { fetchCalendarItems } from '@/lib/calendar-data'
import {
  getDateRangeForView,
  toDateKey,
  type CalendarViewMode,
} from '@/lib/calendar-utils'

export const metadata = {
  title: 'Calendario',
  description: 'Calendario de eventos y vencimientos legales',
}

interface CalendarPageProps {
  searchParams: Promise<{
    view?: string
    date?: string
    month?: string
    year?: string
  }>
}

export default async function CalendarPage({ searchParams }: CalendarPageProps) {
  const supabase = await createClient()
  const params = await searchParams

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('system_role')
    .eq('id', user.id)
    .single()

  if (profile?.system_role === 'client') {
    redirect('/portal')
  }

  const now = new Date()
  const view = (params.view === 'day' || params.view === 'week' ? params.view : 'month') as CalendarViewMode
  const anchorDate = params.date
    ? new Date(params.date + 'T12:00:00')
    : params.month !== undefined && params.year !== undefined
      ? new Date(parseInt(params.year), parseInt(params.month), 1)
      : now

  const { start, end, dates } = getDateRangeForView(view, anchorDate, 0)
  const { itemsByDate } = await fetchCalendarItems(supabase, user.id, start, end)

  const hasGoogleRes = await supabase
    .from('google_connections')
    .select('id')
    .eq('user_id', user.id)
    .eq('service', 'calendar')
    .single()
  const hasGoogleConnection = !!hasGoogleRes.data

  const upcomingItems: CalendarItem[] = []
  const upcomingDeadlines = await supabase
    .from('deadlines')
    .select(`id, title, due_date, deadline_type, case:cases(id, case_number, title)`)
    .gte('due_date', now.toISOString())
    .order('due_date', { ascending: true })
    .limit(5)
  const upcomingDeadlineIds = (upcomingDeadlines.data ?? []).map((d) => d.id)
  const { data: upcomingDeadlineTasks } =
    upcomingDeadlineIds.length > 0
      ? await supabase
          .from('tasks')
          .select('id, status, deadline_id')
          .in('deadline_id', upcomingDeadlineIds)
          .neq('status', 'cancelled')
      : { data: [] as { id: string; status: string; deadline_id: string }[] }
  const tasksByDeadline = new Map<string, { status: string }[]>()
  for (const t of upcomingDeadlineTasks ?? []) {
    const list = tasksByDeadline.get(t.deadline_id) ?? []
    list.push({ status: t.status })
    tasksByDeadline.set(t.deadline_id, list)
  }
  ;(upcomingDeadlines.data ?? []).forEach((d) =>
    upcomingItems.push({
      type: 'deadline',
      id: d.id,
      title: d.title,
      date: d.due_date,
      deadline_type: d.deadline_type ?? undefined,
      case: d.case as { case_number?: string },
      tasks: tasksByDeadline.get(d.id) ?? [],
    })
  )
  const upcomingTasks = await supabase
    .from('tasks')
    .select(`id, title, due_date, status, case:cases(id, case_number, title)`)
    .not('due_date', 'is', null)
    .gte('due_date', now.toISOString())
    .or(`assigned_to.eq.${user.id},created_by.eq.${user.id}`)
    .order('due_date', { ascending: true })
    .limit(5)
  ;(upcomingTasks.data ?? []).forEach((t) => {
    if (t.due_date)
      upcomingItems.push({
        type: 'task',
        id: t.id,
        title: t.title,
        date: t.due_date,
        case: t.case as { case_number?: string },
        status: t.status,
      })
  })
  const upcomingGoogle = await supabase
    .from('google_calendar_events')
    .select('id, google_event_id, summary, description, start_at, end_at')
    .eq('user_id', user.id)
    .neq('status', 'cancelled')
    .gte('start_at', now.toISOString())
    .order('start_at', { ascending: true })
    .limit(5)
  const upcomingGoogleIds = (upcomingGoogle.data ?? []).map((e) => e.google_event_id)
  const { data: upcomingGoogleTasks } =
    upcomingGoogleIds.length > 0
      ? await supabase
          .from('tasks')
          .select('id, status, google_calendar_event_id')
          .in('google_calendar_event_id', upcomingGoogleIds)
          .neq('status', 'cancelled')
      : { data: [] as { id: string; status: string; google_calendar_event_id: string }[] }
  const tasksByGoogleEvent = new Map<string, { status: string }[]>()
  for (const t of upcomingGoogleTasks ?? []) {
    const list = tasksByGoogleEvent.get(t.google_calendar_event_id) ?? []
    list.push({ status: t.status })
    tasksByGoogleEvent.set(t.google_calendar_event_id, list)
  }
  ;(upcomingGoogle.data ?? []).forEach((e) =>
    upcomingItems.push({
      type: 'google',
      id: e.id,
      google_event_id: e.google_event_id,
      summary: e.summary,
      start_at: e.start_at,
      end_at: e.end_at,
      description: e.description,
      tasks: tasksByGoogleEvent.get(e.google_event_id) ?? [],
    })
  )
  upcomingItems.sort((a, b) => {
    const aDate = a.type === 'google' ? a.start_at : a.date
    const bDate = b.type === 'google' ? b.start_at : b.date
    return new Date(aDate).getTime() - new Date(bDate).getTime()
  })
  upcomingItems.splice(10)

  const month = start.getMonth()
  const year = start.getFullYear()
  const daysInMonth = view === 'month' ? new Date(year, month + 1, 0).getDate() : 0
  const firstDayOfWeek = view === 'month' ? new Date(year, month, 1).getDay() : 0
  const monthName = start.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })

  const itemsByDay: Record<number, CalendarItem[]> = {}
  if (view === 'month') {
    dates.forEach((d) => {
      const day = d.getDate()
      const key = toDateKey(d)
      if (itemsByDate[key]) {
        itemsByDay[day] = itemsByDate[key]
      }
    })
  }

  const datesStr = dates.map((d) => toDateKey(d))

  return (
    <CalendarView
      view={view}
      anchorDateStr={toDateKey(anchorDate)}
      month={month}
      year={year}
      monthName={monthName}
      daysInMonth={daysInMonth}
      firstDayOfWeek={firstDayOfWeek}
      itemsByDay={itemsByDay}
      itemsByDate={itemsByDate}
      datesStr={datesStr}
      upcomingItems={upcomingItems}
      hasGoogleConnection={hasGoogleConnection}
    />
  )
}
