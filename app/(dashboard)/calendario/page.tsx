/**
 * Calendar Page
 * 
 * Legal calendar view showing deadlines, hearings, and appointments.
 * Integrates with Google Calendar for synchronization.
 */
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Calendar as CalendarIcon,
  Plus,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  Briefcase,
  AlertCircle,
} from 'lucide-react'

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

/** Maps event types to colors */
function getEventTypeColor(type: string): string {
  const colors: Record<string, string> = {
    deadline: 'bg-destructive text-destructive-foreground',
    hearing: 'bg-primary text-primary-foreground',
    meeting: 'bg-blue-500 text-white',
    reminder: 'bg-amber-500 text-white',
  }
  return colors[type] || 'bg-muted text-muted-foreground'
}

/** Maps event types to labels */
function getEventTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    deadline: 'Vencimiento',
    hearing: 'Audiencia',
    meeting: 'Reunión',
    reminder: 'Recordatorio',
  }
  return labels[type] || type
}

export default async function CalendarPage({ searchParams }: CalendarPageProps) {
  const supabase = await createClient()
  const params = await searchParams
  
  // Validate user access
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

  // Calculate current month/year
  const now = new Date()
  const currentMonth = params.month ? parseInt(params.month) : now.getMonth()
  const currentYear = params.year ? parseInt(params.year) : now.getFullYear()

  // Get start and end of month for query
  const startOfMonth = new Date(currentYear, currentMonth, 1)
  const endOfMonth = new Date(currentYear, currentMonth + 1, 0)

  // Fetch deadlines for the month
  const { data: deadlines } = await supabase
    .from('deadlines')
    .select(`
      *,
      case:cases(id, case_number, title)
    `)
    .gte('due_date', startOfMonth.toISOString())
    .lte('due_date', endOfMonth.toISOString())
    .order('due_date', { ascending: true })

  // Generate calendar days
  const daysInMonth = endOfMonth.getDate()
  const firstDayOfWeek = startOfMonth.getDay()
  const monthName = startOfMonth.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })

  // Group deadlines by day
  const deadlinesByDay: Record<number, typeof deadlines> = {}
  deadlines?.forEach((deadline) => {
    const day = new Date(deadline.due_date).getDate()
    if (!deadlinesByDay[day]) deadlinesByDay[day] = []
    deadlinesByDay[day]?.push(deadline)
  })

  // Get upcoming events for sidebar
  const { data: upcomingDeadlines } = await supabase
    .from('deadlines')
    .select(`
      *,
      case:cases(id, case_number, title)
    `)
    .gte('due_date', now.toISOString())
    .order('due_date', { ascending: true })
    .limit(10)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Calendario
          </h1>
          <p className="text-sm text-muted-foreground">
            Gestione sus audiencias, vencimientos y reuniones
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            Sincronizar con Google
          </Button>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Nuevo Evento
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Calendar Grid */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg capitalize">
                <CalendarIcon className="h-5 w-5" />
                {monthName}
              </CardTitle>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="icon" className="h-8 w-8 bg-transparent">
                  <ChevronLeft className="h-4 w-4" />
                  <span className="sr-only">Mes anterior</span>
                </Button>
                <Button variant="outline" size="sm">
                  Hoy
                </Button>
                <Button variant="outline" size="icon" className="h-8 w-8 bg-transparent">
                  <ChevronRight className="h-4 w-4" />
                  <span className="sr-only">Mes siguiente</span>
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Week day headers */}
            <div className="grid grid-cols-7 gap-px mb-2">
              {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map((day) => (
                <div 
                  key={day} 
                  className="text-center text-xs font-medium text-muted-foreground py-2"
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
              {/* Empty cells for days before start of month */}
              {[...Array(firstDayOfWeek)].map((_, i) => (
                <div key={`empty-${i}`} className="bg-muted/30 min-h-[80px] p-1" />
              ))}
              
              {/* Day cells */}
              {[...Array(daysInMonth)].map((_, i) => {
                const day = i + 1
                const isToday = 
                  day === now.getDate() && 
                  currentMonth === now.getMonth() && 
                  currentYear === now.getFullYear()
                const dayDeadlines = deadlinesByDay[day] || []

                return (
                  <div 
                    key={day} 
                    className={`
                      bg-background min-h-[80px] p-1.5 
                      ${isToday ? 'ring-2 ring-primary ring-inset' : ''}
                    `}
                  >
                    <span className={`
                      text-xs font-medium inline-flex items-center justify-center w-6 h-6 rounded-full
                      ${isToday ? 'bg-primary text-primary-foreground' : 'text-foreground'}
                    `}>
                      {day}
                    </span>
                    
                    {/* Events for this day */}
                    <div className="mt-1 space-y-0.5">
                      {dayDeadlines.slice(0, 2).map((deadline) => (
                        <div
                          key={deadline.id}
                          className={`
                            text-[10px] px-1 py-0.5 rounded truncate cursor-pointer
                            ${getEventTypeColor(deadline.deadline_type || 'deadline')}
                          `}
                          title={deadline.title}
                        >
                          {deadline.title}
                        </div>
                      ))}
                      {dayDeadlines.length > 2 && (
                        <div className="text-[10px] text-muted-foreground px-1">
                          +{dayDeadlines.length - 2} más
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Upcoming Events Sidebar */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="h-5 w-5" />
              Próximos Eventos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {upcomingDeadlines && upcomingDeadlines.length > 0 ? (
                upcomingDeadlines.map((deadline) => {
                  const dueDate = new Date(deadline.due_date)
                  const isOverdue = dueDate < now
                  const isUrgent = !isOverdue && (dueDate.getTime() - now.getTime()) < 3 * 24 * 60 * 60 * 1000

                  return (
                    <div 
                      key={deadline.id} 
                      className="flex gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                    >
                      <div className={`
                        w-1 rounded-full flex-shrink-0
                        ${isOverdue ? 'bg-destructive' : isUrgent ? 'bg-amber-500' : 'bg-primary'}
                      `} />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">
                          {deadline.title}
                        </p>
                        {deadline.case && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <Briefcase className="h-3 w-3" />
                            {deadline.case.case_number}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-1.5">
                          <Badge 
                            variant={isOverdue ? 'destructive' : isUrgent ? 'outline' : 'secondary'}
                            className="text-[10px]"
                          >
                            {isOverdue ? 'Vencido' : getEventTypeLabel(deadline.deadline_type || 'deadline')}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {dueDate.toLocaleDateString('es-AR', {
                              day: 'numeric',
                              month: 'short',
                            })}
                          </span>
                        </div>
                      </div>
                    </div>
                  )
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
