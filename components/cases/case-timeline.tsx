/**
 * Case Timeline Component
 * 
 * Displays a chronological timeline of key dates and milestones for a case.
 * Shows court dates, filing deadlines, and important events in visual format.
 */
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Plus, 
  Calendar,
  Gavel,
  FileCheck,
  Users,
  Clock,
  CheckCircle2,
  Circle,
  AlertCircle,
} from 'lucide-react'
import type { DeadlineType } from '@/lib/types'

interface CaseTimelineProps {
  /** The case ID to fetch timeline events for */
  caseId: string
  /** Case opened date for the timeline start */
  openedAt: string
  /** Whether the user can add new events */
  canEdit: boolean
}

/**
 * Timeline event type configuration with icons and colors
 */
const eventTypeConfig: Record<DeadlineType, { 
  label: string
  icon: typeof Calendar
  bgColor: string
  iconColor: string 
}> = {
  court_date: { 
    label: 'Audiencia', 
    icon: Gavel,
    bgColor: 'bg-primary/10',
    iconColor: 'text-primary'
  },
  filing_deadline: { 
    label: 'Presentacion', 
    icon: FileCheck,
    bgColor: 'bg-chart-2/10',
    iconColor: 'text-chart-2'
  },
  meeting: { 
    label: 'Reunion', 
    icon: Users,
    bgColor: 'bg-chart-3/10',
    iconColor: 'text-chart-3'
  },
  other: { 
    label: 'Evento', 
    icon: Clock,
    bgColor: 'bg-muted',
    iconColor: 'text-muted-foreground'
  },
}

/**
 * Timeline event interface
 */
interface TimelineEvent {
  id: string
  title: string
  description: string | null
  deadline_type: DeadlineType
  due_date: string
  is_completed: boolean
  }

/**
 * Fetches timeline events (deadlines) for a case
 */
async function getCaseTimelineEvents(caseId: string): Promise<TimelineEvent[]> {
  const supabase = await createClient()

  const { data: deadlines, error } = await supabase
    .from('deadlines')
    .select(`
      id,
      title,
  description,
  deadline_type,
  due_date,
  is_completed
  `)
    .eq('case_id', caseId)
    .order('due_date', { ascending: true })

  if (error) {
    console.error('Error fetching timeline events:', error)
    return []
  }

  return deadlines as TimelineEvent[]
}

/**
 * Determines the status of an event relative to today
 */
function getEventStatus(dueDate: string, isCompleted: boolean): 'past' | 'today' | 'upcoming' | 'completed' {
  if (isCompleted) return 'completed'
  
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const eventDate = new Date(dueDate)
  eventDate.setHours(0, 0, 0, 0)

  if (eventDate < today) return 'past'
  if (eventDate.getTime() === today.getTime()) return 'today'
  return 'upcoming'
}

/**
 * Groups events by month/year for timeline display
 */
function groupEventsByMonth(events: TimelineEvent[]): Map<string, TimelineEvent[]> {
  const grouped = new Map<string, TimelineEvent[]>()
  
  for (const event of events) {
    const date = new Date(event.due_date)
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    
    if (!grouped.has(key)) {
      grouped.set(key, [])
    }
    grouped.get(key)?.push(event)
  }
  
  return grouped
}

/**
 * Formats month key to display string
 */
function formatMonthKey(key: string): string {
  const [year, month] = key.split('-')
  const date = new Date(Number.parseInt(year), Number.parseInt(month) - 1)
  return date.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
}

export async function CaseTimeline({ caseId, openedAt, canEdit }: CaseTimelineProps) {
  const events = await getCaseTimelineEvents(caseId)
  const groupedEvents = groupEventsByMonth(events)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-foreground">
          Linea de Tiempo
        </h3>
        {canEdit && (
          <Button asChild size="sm">
            <Link href={`/calendario/nuevo?caso=${caseId}`}>
              <Plus className="mr-2 h-4 w-4" />
              Agregar Evento
            </Link>
          </Button>
        )}
      </div>

      <Card className="border-border/60">
        <CardContent className="p-6">
          {/* Case Start Marker */}
          <div className="flex items-center gap-4 pb-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary">
              <Calendar className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Inicio del Caso</p>
              <p className="text-xs text-muted-foreground">
                {new Date(openedAt).toLocaleDateString('es-AR', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </p>
            </div>
          </div>

          {events.length === 0 ? (
            <div className="ml-5 border-l-2 border-dashed border-border pl-9 py-8">
              <p className="text-sm text-muted-foreground">
                No hay eventos en la linea de tiempo
              </p>
              {canEdit && (
                <Button asChild variant="outline" size="sm" className="mt-2 bg-transparent">
                  <Link href={`/calendario/nuevo?caso=${caseId}`}>
                    Agregar Primer Evento
                  </Link>
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-8">
              {Array.from(groupedEvents.entries()).map(([monthKey, monthEvents]) => (
                <div key={monthKey} className="relative">
                  {/* Month Label */}
                  <div className="mb-4 ml-5 border-l-2 border-border pl-9">
                    <Badge variant="outline" className="text-xs font-normal capitalize">
                      {formatMonthKey(monthKey)}
                    </Badge>
                  </div>

                  {/* Events in this month */}
                  <div className="space-y-4">
                    {monthEvents.map((event, index) => {
                      const config = eventTypeConfig[event.deadline_type]
                      const status = getEventStatus(event.due_date, event.is_completed)
                      const EventIcon = config.icon
                      const isLast = index === monthEvents.length - 1

                      return (
                        <div 
                          key={event.id} 
                          className="relative flex items-start gap-4"
                        >
                          {/* Vertical Line */}
                          <div className="absolute left-5 top-10 bottom-0 w-0.5 bg-border" 
                            style={{ display: isLast ? 'none' : 'block' }} 
                          />

                          {/* Event Icon */}
                          <div className={`relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                            status === 'completed' 
                              ? 'bg-success/20' 
                              : status === 'past'
                                ? 'bg-destructive/20'
                                : status === 'today'
                                  ? 'bg-warning/20'
                                  : config.bgColor
                          }`}>
                            {status === 'completed' ? (
                              <CheckCircle2 className="h-5 w-5 text-success" />
                            ) : status === 'past' ? (
                              <AlertCircle className="h-5 w-5 text-destructive" />
                            ) : (
                              <EventIcon className={`h-5 w-5 ${
                                status === 'today' ? 'text-warning' : config.iconColor
                              }`} />
                            )}
                          </div>

                          {/* Event Content */}
                          <div className={`flex-1 rounded-lg border p-4 ${
                            status === 'today' 
                              ? 'border-warning/50 bg-warning/5' 
                              : status === 'past' && !event.is_completed
                                ? 'border-destructive/50 bg-destructive/5'
                                : 'border-border bg-card'
                          }`}>
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <p className={`text-sm font-medium ${
                                    status === 'completed' ? 'text-muted-foreground line-through' : 'text-foreground'
                                  }`}>
                                    {event.title}
                                  </p>
                                  <Badge variant="outline" className="h-5 text-[10px]">
                                    {config.label}
                                  </Badge>
                                </div>
                                {event.description && (
                                  <p className="text-xs text-muted-foreground">
                                    {event.description}
                                  </p>
                                )}
                              </div>
                              <div className="text-right">
                                <p className={`text-sm font-medium ${
                                  status === 'today' 
                                    ? 'text-warning' 
                                    : status === 'past' && !event.is_completed
                                      ? 'text-destructive'
                                      : 'text-foreground'
                                }`}>
                                  {new Date(event.due_date).toLocaleDateString('es-AR', {
                                    day: 'numeric',
                                    month: 'short',
                                  })}
  </p>
  </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Legend */}
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Tipos de Eventos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            {Object.entries(eventTypeConfig).map(([key, config]) => (
              <div key={key} className="flex items-center gap-2">
                <div className={`flex h-6 w-6 items-center justify-center rounded-full ${config.bgColor}`}>
                  <config.icon className={`h-3 w-3 ${config.iconColor}`} />
                </div>
                <span className="text-xs text-muted-foreground">{config.label}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
