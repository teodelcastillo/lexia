'use client'

/**
 * Calendar View - Client component for sync button and Google event editing
 */
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Calendar as CalendarIcon,
  Plus,
  ChevronLeft,
  ChevronRight,
  Clock,
  Briefcase,
  Loader2,
  RefreshCw,
} from 'lucide-react'
import { toast } from 'sonner'

export type CalendarItem =
  | {
      type: 'deadline'
      id: string
      title: string
      date: string
      deadline_type?: string
      case?: { case_number?: string }
    }
  | {
      type: 'task'
      id: string
      title: string
      date: string
      case?: { case_number?: string }
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
    }

function getEventColor(item: CalendarItem): string {
  if (item.type === 'google') return 'bg-chart-3 text-chart-3-foreground'
  const type = item.type === 'deadline' ? (item.deadline_type || 'deadline') : 'task'
  const colors: Record<string, string> = {
    deadline: 'bg-destructive text-destructive-foreground',
    hearing: 'bg-primary text-primary-foreground',
    meeting: 'bg-blue-500 text-white',
    task: 'bg-chart-2 text-chart-2-foreground',
  }
  return colors[type] || 'bg-muted text-muted-foreground'
}

function getEventLabel(item: CalendarItem): string {
  if (item.type === 'task') return 'Tarea'
  if (item.type === 'google') return 'Google'
  const labels: Record<string, string> = {
    deadline: 'Vencimiento',
    hearing: 'Audiencia',
    meeting: 'Reunión',
  }
  return labels[item.deadline_type || 'deadline'] || 'Evento'
}

interface CalendarViewProps {
  month: number
  year: number
  monthName: string
  daysInMonth: number
  firstDayOfWeek: number
  itemsByDay: Record<number, CalendarItem[]>
  upcomingItems: CalendarItem[]
  hasGoogleConnection: boolean
}

export function CalendarView({
  month,
  year,
  monthName,
  daysInMonth,
  firstDayOfWeek,
  itemsByDay,
  upcomingItems,
  hasGoogleConnection,
}: CalendarViewProps) {
  const router = useRouter()
  const [syncing, setSyncing] = useState(false)
  const [editingEvent, setEditingEvent] = useState<CalendarItem | null>(null)
  const [editForm, setEditForm] = useState({ summary: '', description: '', location: '', start_at: '', end_at: '' })
  const [saving, setSaving] = useState(false)

  const now = new Date()
  const isCurrentMonth = month === now.getMonth() && year === now.getFullYear()

  const prevMonth = month === 0 ? 11 : month - 1
  const prevYear = month === 0 ? year - 1 : year
  const nextMonth = month === 11 ? 0 : month + 1
  const nextYear = month === 11 ? year + 1 : year

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

  function toDatetimeLocal(iso: string): string {
    const d = new Date(iso)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    const h = String(d.getHours()).padStart(2, '0')
    const min = String(d.getMinutes()).padStart(2, '0')
    return `${y}-${m}-${day}T${h}:${min}`
  }

  function openEditModal(item: CalendarItem) {
    if (item.type !== 'google') return
    setEditingEvent(item)
    setEditForm({
      summary: item.summary ?? '',
      description: item.description ?? '',
      location: item.location ?? '',
      start_at: toDatetimeLocal(item.start_at),
      end_at: toDatetimeLocal(item.end_at),
    })
  }

  async function handleSaveEdit() {
    if (!editingEvent || editingEvent.type !== 'google') return
    setSaving(true)
    try {
      const res = await fetch(`/api/google/calendar/events/${editingEvent.google_event_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          summary: editForm.summary,
          description: editForm.description || null,
          location: editForm.location || null,
          start_at: editForm.start_at ? new Date(editForm.start_at).toISOString() : undefined,
          end_at: editForm.end_at ? new Date(editForm.end_at).toISOString() : undefined,
        }),
      })
      if (res.ok) {
        toast.success('Evento actualizado')
        setEditingEvent(null)
        router.refresh()
      } else {
        const data = await res.json()
        toast.error(data.error ?? 'Error al guardar')
      }
    } catch {
      toast.error('Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteEvent() {
    if (!editingEvent || editingEvent.type !== 'google') return
    setSaving(true)
    try {
      const res = await fetch(`/api/google/calendar/events/${editingEvent.google_event_id}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        toast.success('Evento eliminado')
        setEditingEvent(null)
        router.refresh()
      } else {
        const data = await res.json()
        toast.error(data.error ?? 'Error al eliminar')
      }
    } catch {
      toast.error('Error al eliminar')
    } finally {
      setSaving(false)
    }
  }

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
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg capitalize">
                <CalendarIcon className="h-5 w-5" />
                {monthName}
              </CardTitle>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="icon" className="h-8 w-8 bg-transparent" asChild>
                  <Link href={`/calendario?month=${prevMonth}&year=${prevYear}`}>
                    <ChevronLeft className="h-4 w-4" />
                    <span className="sr-only">Mes anterior</span>
                  </Link>
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/calendario">Hoy</Link>
                </Button>
                <Button variant="outline" size="icon" className="h-8 w-8 bg-transparent" asChild>
                  <Link href={`/calendario?month=${nextMonth}&year=${nextYear}`}>
                    <ChevronRight className="h-4 w-4" />
                    <span className="sr-only">Mes siguiente</span>
                  </Link>
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
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
            <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
              {[...Array(firstDayOfWeek)].map((_, i) => (
                <div key={`empty-${i}`} className="bg-muted/30 min-h-[80px] p-1" />
              ))}
              {[...Array(daysInMonth)].map((_, i) => {
                const day = i + 1
                const isToday =
                  isCurrentMonth &&
                  day === now.getDate()
                const dayItems = itemsByDay[day] || []
                return (
                  <div
                    key={day}
                    className={`bg-background min-h-[80px] p-1.5 ${
                      isToday ? 'ring-2 ring-primary ring-inset' : ''
                    }`}
                  >
                    <span
                      className={`text-xs font-medium inline-flex items-center justify-center w-6 h-6 rounded-full ${
                        isToday ? 'bg-primary text-primary-foreground' : 'text-foreground'
                      }`}
                    >
                      {day}
                    </span>
                    <div className="mt-1 space-y-0.5">
                      {dayItems.slice(0, 3).map((item) => (
                        <div
                          key={`${item.type}-${item.id}`}
                          className={`text-[10px] px-1 py-0.5 rounded truncate cursor-pointer hover:opacity-90 ${
                            getEventColor(item)
                          }`}
                          title={item.type === 'google' ? item.summary ?? 'Evento Google' : item.title}
                          onClick={() => item.type === 'google' && openEditModal(item)}
                        >
                          {item.type === 'google' ? (item.summary || 'Sin título') : item.title}
                        </div>
                      ))}
                      {dayItems.length > 3 && (
                        <div className="text-[10px] text-muted-foreground px-1">
                          +{dayItems.length - 3} más
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
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
                  const isOverdue = date < now
                  const isUrgent =
                    !isOverdue && date.getTime() - now.getTime() < 3 * 24 * 60 * 60 * 1000
                  const title = item.type === 'google' ? (item.summary || 'Sin título') : item.title
                  return (
                    <div
                      key={`${item.type}-${item.id}`}
                      className={`flex gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors ${
                        item.type === 'google' ? 'cursor-pointer' : ''
                      }`}
                      onClick={() => item.type === 'google' && openEditModal(item)}
                    >
                      <div
                        className={`w-1 rounded-full flex-shrink-0 ${
                          isOverdue ? 'bg-destructive' : isUrgent ? 'bg-amber-500' : 'bg-primary'
                        }`}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{title}</p>
                        {item.type !== 'google' && item.case && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <Briefcase className="h-3 w-3" />
                            {item.case.case_number}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-1.5">
                          <Badge
                            variant={
                              isOverdue ? 'destructive' : isUrgent ? 'outline' : 'secondary'
                            }
                            className="text-[10px]"
                          >
                            {isOverdue ? 'Vencido' : getEventLabel(item)}
                          </Badge>
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

      <Dialog open={!!editingEvent} onOpenChange={(open) => !open && setEditingEvent(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar evento de Google</DialogTitle>
          </DialogHeader>
          {editingEvent && editingEvent.type === 'google' && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="summary">Título</Label>
                <Input
                  id="summary"
                  value={editForm.summary}
                  onChange={(e) => setEditForm((p) => ({ ...p, summary: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Descripción</Label>
                <Textarea
                  id="description"
                  value={editForm.description}
                  onChange={(e) => setEditForm((p) => ({ ...p, description: e.target.value }))}
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="location">Ubicación</Label>
                <Input
                  id="location"
                  value={editForm.location}
                  onChange={(e) => setEditForm((p) => ({ ...p, location: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start_at">Inicio</Label>
                  <Input
                    id="start_at"
                    type="datetime-local"
                    value={editForm.start_at}
                    onChange={(e) => setEditForm((p) => ({ ...p, start_at: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end_at">Fin</Label>
                  <Input
                    id="end_at"
                    type="datetime-local"
                    value={editForm.end_at}
                    onChange={(e) => setEditForm((p) => ({ ...p, end_at: e.target.value }))}
                  />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="destructive"
              onClick={handleDeleteEvent}
              disabled={saving}
            >
              Eliminar
            </Button>
            <Button onClick={handleSaveEdit} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
