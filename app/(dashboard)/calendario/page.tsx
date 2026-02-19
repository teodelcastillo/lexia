/**
 * Calendar Page
 *
 * Legal calendar view: deadlines, tasks, and Google Calendar events.
 * Integrates with Google Calendar for bidirectional sync.
 */
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CalendarView, type CalendarItem } from '@/components/calendar/calendar-view'

export const metadata = {
  title: 'Calendario',
  description: 'Calendario de eventos y vencimientos legales',
}

interface CalendarPageProps {
  searchParams: Promise<{
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
  const currentMonth = params.month ? parseInt(params.month) : now.getMonth()
  const currentYear = params.year ? parseInt(params.year) : now.getFullYear()

  const startOfMonth = new Date(currentYear, currentMonth, 1)
  const endOfMonth = new Date(currentYear, currentMonth + 1, 0)

  const [deadlinesRes, tasksRes, googleEventsRes, hasGoogleRes] = await Promise.all([
    supabase
      .from('deadlines')
      .select(`id, title, due_date, deadline_type, case:cases(id, case_number, title)`)
      .gte('due_date', startOfMonth.toISOString())
      .lte('due_date', endOfMonth.toISOString())
      .order('due_date', { ascending: true }),
    supabase
      .from('tasks')
      .select(`id, title, due_date, case:cases(id, case_number, title)`)
      .not('due_date', 'is', null)
      .gte('due_date', startOfMonth.toISOString())
      .lte('due_date', endOfMonth.toISOString())
      .or(`assigned_to.eq.${user.id},created_by.eq.${user.id}`)
      .order('due_date', { ascending: true }),
    supabase
      .from('google_calendar_events')
      .select('id, google_event_id, summary, description, location, start_at, end_at')
      .eq('user_id', user.id)
      .neq('status', 'cancelled')
      .lte('start_at', endOfMonth.toISOString())
      .gte('end_at', startOfMonth.toISOString()),
    supabase
      .from('google_connections')
      .select('id')
      .eq('user_id', user.id)
      .eq('service', 'calendar')
      .single(),
  ])

  const deadlines = deadlinesRes.data ?? []
  const tasks = tasksRes.data ?? []
  const googleEvents = googleEventsRes.data ?? []
  const hasGoogleConnection = !!hasGoogleRes.data

  const itemsByDay: Record<number, CalendarItem[]> = {}

  function addToDay(day: number, item: CalendarItem) {
    if (!itemsByDay[day]) itemsByDay[day] = []
    itemsByDay[day].push(item)
  }

  deadlines.forEach((d) => {
    const day = new Date(d.due_date).getDate()
    addToDay(day, {
      type: 'deadline',
      id: d.id,
      title: d.title,
      date: d.due_date,
      deadline_type: d.deadline_type ?? undefined,
      case: d.case as { case_number?: string },
    })
  })

  tasks.forEach((t) => {
    if (!t.due_date) return
    const day = new Date(t.due_date).getDate()
    addToDay(day, {
      type: 'task',
      id: t.id,
      title: t.title,
      date: t.due_date,
      case: t.case as { case_number?: string },
    })
  })

  googleEvents.forEach((e) => {
    const day = new Date(e.start_at).getDate()
    addToDay(day, {
      type: 'google',
      id: e.id,
      google_event_id: e.google_event_id,
      summary: e.summary,
      start_at: e.start_at,
      end_at: e.end_at,
      description: e.description,
      location: e.location,
    })
  })

  Object.keys(itemsByDay).forEach((day) => {
    itemsByDay[Number(day)].sort((a, b) => {
      const aDate = a.type === 'google' ? a.start_at : a.date
      const bDate = b.type === 'google' ? b.start_at : b.date
      return new Date(aDate).getTime() - new Date(bDate).getTime()
    })
  })

  const upcomingItems: CalendarItem[] = []
  const upcomingDeadlines = await supabase
    .from('deadlines')
    .select(`id, title, due_date, deadline_type, case:cases(id, case_number, title)`)
    .gte('due_date', now.toISOString())
    .order('due_date', { ascending: true })
    .limit(5)
  ;(upcomingDeadlines.data ?? []).forEach((d) =>
    upcomingItems.push({
      type: 'deadline',
      id: d.id,
      title: d.title,
      date: d.due_date,
      deadline_type: d.deadline_type ?? undefined,
      case: d.case as { case_number?: string },
    })
  )
  const upcomingTasks = await supabase
    .from('tasks')
    .select(`id, title, due_date, case:cases(id, case_number, title)`)
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
      })
  })
  const upcomingGoogle = await supabase
    .from('google_calendar_events')
    .select('id, google_event_id, summary, start_at, end_at')
    .eq('user_id', user.id)
    .neq('status', 'cancelled')
    .gte('start_at', now.toISOString())
    .order('start_at', { ascending: true })
    .limit(5)
  ;(upcomingGoogle.data ?? []).forEach((e) =>
    upcomingItems.push({
      type: 'google',
      id: e.id,
      google_event_id: e.google_event_id,
      summary: e.summary,
      start_at: e.start_at,
      end_at: e.end_at,
    })
  )
  upcomingItems.sort((a, b) => {
    const aDate = a.type === 'google' ? a.start_at : a.date
    const bDate = b.type === 'google' ? b.start_at : b.date
    return new Date(aDate).getTime() - new Date(bDate).getTime()
  })
  upcomingItems.splice(10)

  const daysInMonth = endOfMonth.getDate()
  const firstDayOfWeek = startOfMonth.getDay()
  const monthName = startOfMonth.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })

  return (
    <CalendarView
      month={currentMonth}
      year={currentYear}
      monthName={monthName}
      daysInMonth={daysInMonth}
      firstDayOfWeek={firstDayOfWeek}
      itemsByDay={itemsByDay}
      upcomingItems={upcomingItems}
      hasGoogleConnection={hasGoogleConnection}
    />
  )
}
