'use client'

/**
 * Calendar View - Client component with day, week, and month views
 */
import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Calendar as CalendarIcon,
  Plus,
  ChevronLeft,
  ChevronRight,
  Clock,
  Briefcase,
  Loader2,
  RefreshCw,
  CalendarDays,
  CalendarRange,
  LayoutGrid,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  getEventStatus,
  temporalStateLabels,
  preparationStateLabels,
  type EventStatusResult,
} from '@/lib/event-status'
import { getPrevNextForView, toDateKey, type CalendarViewMode } from '@/lib/calendar-utils'

export interface TaskLike {
  status: string
}

export type CalendarItem =
  | {
      type: 'deadline'
      id: string
      title: string
      date: string
      deadline_type?: string
      case?: { case_number?: string }
      tasks?: TaskLike[]
    }
  | {
      type: 'task'
      id: string
      title: string
      date: string
      case?: { case_number?: string }
      status?: string
    }
  | {
      type: 'google'
      id: string
      google_event_id: string
      summary: string | null
      start_at: string
      end_at: string
      description?: string | null
      location?: string | null
      all_day?: boolean
      tasks?: TaskLike[]
    }

function getEventColor(item: CalendarItem): string {
  if (item.type === 'google') return 'bg-chart-3 text-chart-3-foreground'
  if (item.type === 'task') return 'bg-chart-2 text-chart-2-foreground'
  const type = item.deadline_type || 'event'
  const colors: Record<string, string> = {
    event: 'bg-muted text-muted-foreground',
    deadline: 'bg-destructive text-destructive-foreground',
    hearing: 'bg-primary text-primary-foreground',
    meeting: 'bg-blue-500 text-white',
  }
  return colors[type] || 'bg-muted text-muted-foreground'
}

function getEventLabel(item: CalendarItem): string {
  if (item.type === 'task') return 'Tarea'
  if (item.type === 'google') return 'Google'
  if (!item.deadline_type) return 'Evento'
  const labels: Record<string, string> = {
    deadline: 'Vencimiento',
    hearing: 'Audiencia',
    meeting: 'Reunión',
    legal: 'Legal',
    judicial: 'Judicial',
    administrative: 'Administrativo',
    internal: 'Interno',
  }
  return labels[item.deadline_type] || item.deadline_type
}

function getItemStatus(item: CalendarItem, now: Date): EventStatusResult | null {
  const date = item.type === 'google' ? item.start_at : item.date
  let tasks: TaskLike[] = []
  let summary: string | null = null
  let description: string | null = null
  let deadlineType: string | undefined
  if (item.type === 'google') {
    tasks = item.tasks ?? []
    summary = item.summary
    description = item.description ?? null
    deadlineType = undefined
  } else if (item.type === 'deadline') {
    tasks = item.tasks ?? []
    summary = item.title
    deadlineType = item.deadline_type
  } else if (item.type === 'task') {
    tasks = item.status ? [{ status: item.status }] : []
    summary = item.title
    deadlineType = undefined
  } else {
    return null
  }
  return getEventStatus(date, tasks, undefined, summary, description, deadlineType, undefined, now)
}

function getItemTime(item: CalendarItem): { start: Date; end: Date; allDay: boolean } {
  if (item.type === 'google') {
    return {
      start: new Date(item.start_at),
      end: new Date(item.end_at),
      allDay: item.all_day ?? false,
    }
  }
  const d = new Date(item.date)
  return {
    start: new Date(d.getFullYear(), d.getMonth(), d.getDate(), 9, 0, 0),
    end: new Date(d.getFullYear(), d.getMonth(), d.getDate(), 9, 30, 0),
    allDay: true,
  }
}

interface CalendarViewProps {
  view: CalendarViewMode
  anchorDateStr: string
  month: number
  year: number
  monthName: string
  daysInMonth: number
  firstDayOfWeek: number
  itemsByDay: Record<number, CalendarItem[]>
  itemsByDate: Record<string, CalendarItem[]>
  datesStr: string[]
  upcomingItems: CalendarItem[]
  hasGoogleConnection: boolean
}

export function CalendarView({
  view,
  anchorDateStr,
  month,
  year,
  monthName,
  daysInMonth,
  firstDayOfWeek,
  itemsByDay,
  itemsByDate,
  datesStr,
  upcomingItems,
  hasGoogleConnection,
}: CalendarViewProps) {
  const anchorDate = new Date(anchorDateStr + 'T12:00:00')
  const dates = datesStr.map((s) => new Date(s + 'T12:00:00'))
  const router = useRouter()
  const [syncing, setSyncing] = useState(false)

  const now = new Date()
  const isCurrentMonth = month === now.getMonth() && year === now.getFullYear()

  const prevDate = getPrevNextForView(view, anchorDate, 'prev')
  const nextDate = getPrevNextForView(view, anchorDate, 'next')

  const prevHref =
    view === 'month'
      ? `/calendario?view=month&month=${prevDate.getMonth()}&year=${prevDate.getFullYear()}`
      : `/calendario?view=${view}&date=${toDateKey(prevDate)}`
  const nextHref =
    view === 'month'
      ? `/calendario?view=month&month=${nextDate.getMonth()}&year=${nextDate.getFullYear()}`
      : `/calendario?view=${view}&date=${toDateKey(nextDate)}`
  const todayHref =
    view === 'month'
      ? `/calendario?view=month`
      : `/calendario?view=${view}&date=${toDateKey(now)}`

  async function handleSync(forceFull = false) {
    setSyncing(true)
    try {
      const url = forceFull ? '/api/google/calendar/sync?full=true' : '/api/google/calendar/sync'
      const res = await fetch(url, { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        const count = data.upserted ?? 0
        if (count === 0 && !forceFull) {
          toast.success('Sincronizado (sin cambios). Si esperaba eventos, intente sincronización completa.', {
            action: {
              label: 'Sync completo',
              onClick: () => handleSync(true),
            },
          })
        } else {
          toast.success(`Sincronizado: ${count} eventos importados`)
        }
        router.refresh()
      } else {
        toast.error(data.error ?? 'Error al sincronizar')
      }
    } catch {
      toast.error('Error al sincronizar')
    } finally {
      setSyncing(false)
    }
  }

  const viewTitle =
    view === 'day'
      ? anchorDate.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
      : view === 'week'
        ? `${dates[0]?.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })} - ${dates[6]?.toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })}`
        : monthName

  const HOURS = Array.from({ length: 14 }, (_, i) => i + 6)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Calendario</h1>
          <p className="text-sm text-muted-foreground">
            Gestione sus audiencias, vencimientos y reuniones
          </p>
        </div>
        <div className="flex items-center gap-2">
          {hasGoogleConnection && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => void handleSync()}
              disabled={syncing}
            >
              {syncing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Sincronizar con Google
            </Button>
          )}
          <Button asChild>
            <Link href="/calendario/nuevo">
              <Plus className="mr-2 h-4 w-4" />
              Nuevo Evento
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <div className="flex rounded-lg border p-0.5">
                  <Button variant={view === 'day' ? 'secondary' : 'ghost'} size="sm" className="h-8 px-2" asChild>
                    <Link href={`/calendario?view=day&date=${toDateKey(anchorDate)}`}>
                      <CalendarDays className="h-4 w-4 mr-1" />
                      Día
                    </Link>
                  </Button>
                  <Button variant={view === 'week' ? 'secondary' : 'ghost'} size="sm" className="h-8 px-2" asChild>
                    <Link href={`/calendario?view=week&date=${toDateKey(anchorDate)}`}>
                      <CalendarRange className="h-4 w-4 mr-1" />
                      Semana
                    </Link>
                  </Button>
                  <Button variant={view === 'month' ? 'secondary' : 'ghost'} size="sm" className="h-8 px-2" asChild>
                    <Link href={`/calendario?view=month&month=${month}&year=${year}`}>
                      <LayoutGrid className="h-4 w-4 mr-1" />
                      Mes
                    </Link>
                  </Button>
                </div>
                <CardTitle className="text-lg capitalize">{viewTitle}</CardTitle>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="icon" className="h-8 w-8 bg-transparent" asChild>
                  <Link href={prevHref}>
                    <ChevronLeft className="h-4 w-4" />
                    <span className="sr-only">Anterior</span>
                  </Link>
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <Link href={todayHref}>Hoy</Link>
                </Button>
                <Button variant="outline" size="icon" className="h-8 w-8 bg-transparent" asChild>
                  <Link href={nextHref}>
                    <ChevronRight className="h-4 w-4" />
                    <span className="sr-only">Siguiente</span>
                  </Link>
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {view === 'day' && (
              <div className="overflow-x-auto">
                <div className="min-w-[280px]">
                  <div className="border rounded-lg overflow-hidden">
                    {HOURS.map((h) => {
                      const hourStart = new Date(anchorDate)
                      hourStart.setHours(h, 0, 0, 0)
                      const hourEnd = new Date(anchorDate)
                      hourEnd.setHours(h + 1, 0, 0, 0)
                      const dayKey = toDateKey(anchorDate)
                      const allItems = itemsByDate[dayKey] ?? []
                      const allDayItems = allItems.filter((item) => getItemTime(item).allDay)
                      const items = allItems.filter((item) => {
                        const { start, allDay } = getItemTime(item)
                        if (allDay) return false
                        return start >= hourStart && start < hourEnd
                      })
                      return (
                        <div key={h} className="flex border-b last:border-b-0 min-h-[60px]">
                          <div className="w-14 flex-shrink-0 py-2 pr-2 text-right text-xs text-muted-foreground">
                            {h}:00
                          </div>
                          <div className="flex-1 py-1 space-y-1">
                            {h === 6 && allDayItems.length > 0 && (
                              <div className="space-y-1 mb-2">
                                {allDayItems.map((item) => {
                                  const title = item.type === 'google' ? (item.summary || 'Sin título') : item.title
                                  const itemClasses = `text-xs px-2 py-1 rounded ${getEventColor(item)} block truncate`
                                  return item.type === 'google' ? (
                                    <Link key={item.id} href={`/calendario/eventos/${item.id}`} className={itemClasses}>
                                      {title}
                                    </Link>
                                  ) : (
                                    <div key={item.id} className={itemClasses} title={title}>
                                      {title}
                                    </div>
                                  )
                                })}
                              </div>
                            )}
                            {items.map((item) => {
                              const title = item.type === 'google' ? (item.summary || 'Sin título') : item.title
                              const { start } = getItemTime(item)
                              const itemClasses = `text-xs px-2 py-1 rounded ${getEventColor(item)} block truncate`
                              return item.type === 'google' ? (
                                <Link key={item.id} href={`/calendario/eventos/${item.id}`} className={itemClasses} title={`${start.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })} - ${title}`}>
                                  {start.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })} {title}
                                </Link>
                              ) : (
                                <div key={item.id} className={itemClasses} title={title}>
                                  {title}
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}

            {view === 'week' && (
              <div className="overflow-x-auto">
                <div className="min-w-[600px]">
                  <div className="grid grid-cols-8 gap-px border rounded-lg overflow-hidden">
                    <div className="bg-muted/30 p-2" />
                    {dates.map((d) => (
                      <div key={toDateKey(d)} className="bg-muted/30 p-2 text-center">
                        <div className="text-xs font-medium text-muted-foreground">
                          {d.toLocaleDateString('es-AR', { weekday: 'short' })}
                        </div>
                        <div className={`text-sm font-semibold ${toDateKey(d) === toDateKey(now) ? 'text-primary' : ''}`}>
                          {d.getDate()}
                        </div>
                      </div>
                    ))}
                    {HOURS.map((h) => (
                      <React.Fragment key={h}>
                        <div className="bg-muted/20 px-2 py-1 text-right text-xs text-muted-foreground">
                          {h}:00
                        </div>
                        {dates.map((d) => {
                          const dayKey = toDateKey(d)
                          const hourStart = new Date(d)
                          hourStart.setHours(h, 0, 0, 0)
                          const hourEnd = new Date(d)
                          hourEnd.setHours(h + 1, 0, 0, 0)
                          const items = (itemsByDate[dayKey] ?? []).filter((item) => {
                            const { start, allDay } = getItemTime(item)
                            if (allDay) return h === 6
                            return start >= hourStart && start < hourEnd
                          })
                          return (
                            <div key={`${dayKey}-${h}`} className="bg-background min-h-[48px] p-1 space-y-0.5">
                              {items.slice(0, 2).map((item) => {
                                const title = item.type === 'google' ? (item.summary || 'Sin título') : item.title
                                const itemClasses = `text-[10px] px-1 py-0.5 rounded truncate ${getEventColor(item)}`
                                return item.type === 'google' ? (
                                  <Link key={item.id} href={`/calendario/eventos/${item.id}`} className={`${itemClasses} block`} title={title}>
                                    {title}
                                  </Link>
                                ) : (
                                  <div key={item.id} className={itemClasses} title={title}>
                                    {title}
                                  </div>
                                )
                              })}
                              {items.length > 2 && (
                                <span className="text-[10px] text-muted-foreground">+{items.length - 2}</span>
                              )}
                            </div>
                          )
                        })}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {view === 'month' && (
              <>
                <div className="grid grid-cols-7 gap-px mb-2">
                  {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map((day) => (
                    <div key={day} className="text-center text-xs font-medium text-muted-foreground py-2">
                      {day}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
                  {[...Array(firstDayOfWeek)].map((_, i) => (
                    <div key={`empty-${i}`} className="bg-muted/30 min-h-[80px] p-1" />
                  ))}
                  {[...Array(daysInMonth)].map((_, i) => {
                    const day = i + 1
                    const isToday = isCurrentMonth && day === now.getDate()
                    const dayItems = itemsByDay[day] || []
                    return (
                      <div
                        key={day}
                        className={`bg-background min-h-[80px] p-1.5 ${isToday ? 'ring-2 ring-primary ring-inset' : ''}`}
                      >
                        <span
                          className={`text-xs font-medium inline-flex items-center justify-center w-6 h-6 rounded-full ${
                            isToday ? 'bg-primary text-primary-foreground' : 'text-foreground'
                          }`}
                        >
                          {day}
                        </span>
                        <div className="mt-1 space-y-0.5">
                          {dayItems.slice(0, 3).map((item) => {
                            const title = item.type === 'google' ? (item.summary || 'Sin título') : item.title
                            const itemClasses = `text-[10px] px-1 py-0.5 rounded truncate hover:opacity-90 ${getEventColor(item)}`
                            if (item.type === 'google') {
                              return (
                                <Link key={`${item.type}-${item.id}`} href={`/calendario/eventos/${item.id}`} className={itemClasses} title={item.summary ?? 'Evento Google'}>
                                  {title}
                                </Link>
                              )
                            }
                            return (
                              <div key={`${item.type}-${item.id}`} className={itemClasses} title={title}>
                                {title}
                              </div>
                            )
                          })}
                          {dayItems.length > 3 && (
                            <div className="text-[10px] text-muted-foreground px-1">+{dayItems.length - 3} más</div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="h-5 w-5" />
              Próximos Eventos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {upcomingItems.length > 0 ? (
                upcomingItems.map((item) => {
                  const date = item.type === 'google' ? new Date(item.start_at) : new Date(item.date)
                  const status = getItemStatus(item, now)
                  const legalRisk = status?.legalRisk ?? 'ninguno'
                  const barColor =
                    legalRisk === 'alto'
                      ? 'bg-destructive'
                      : legalRisk === 'medio'
                        ? 'bg-amber-500'
                        : date.getTime() - now.getTime() < 3 * 24 * 60 * 60 * 1000
                          ? 'bg-amber-500'
                          : 'bg-primary'
                  const title = item.type === 'google' ? (item.summary || 'Sin título') : item.title
                  const content = (
                    <div
                      key={`${item.type}-${item.id}`}
                      className="flex gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                    >
                      <div className={`w-1 rounded-full flex-shrink-0 ${barColor}`} />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{title}</p>
                        {item.type !== 'google' && item.case && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <Briefcase className="h-3 w-3" />
                            {item.case.case_number}
                          </p>
                        )}
                        <div className="flex flex-wrap items-center gap-2 mt-1.5">
                          {status && (
                            <>
                              <Badge variant="outline" className="text-[10px]">
                                {temporalStateLabels[status.temporal]}
                              </Badge>
                              <Badge
                                variant={
                                  status.preparation === 'listo'
                                    ? 'outline'
                                    : status.preparation === 'sin_iniciar' && status.legalRisk === 'alto'
                                      ? 'destructive'
                                      : 'secondary'
                                }
                                className="text-[10px]"
                              >
                                {preparationStateLabels[status.preparation]}
                              </Badge>
                              {status.totalCount > 0 && (
                                <span className="text-[10px] text-muted-foreground">
                                  {status.completedCount}/{status.totalCount}
                                </span>
                              )}
                            </>
                          )}
                          <span className="text-xs text-muted-foreground">
                            {date.toLocaleDateString('es-AR', {
                              day: 'numeric',
                              month: 'short',
                            })}
                          </span>
                        </div>
                      </div>
                    </div>
                  )

                  if (item.type === 'google') {
                    return (
                      <Link key={`${item.type}-${item.id}`} href={`/calendario/eventos/${item.id}`} className="block">
                        {content}
                      </Link>
                    )
                  }

                  return content
                })
              ) : (
                <div className="text-center py-6 text-muted-foreground">
                  <CalendarIcon className="h-8 w-8 mx-auto mb-2" />
                  <p className="text-sm">No hay eventos próximos</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

    </div>
  )
}
