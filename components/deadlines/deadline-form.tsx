/**
 * Deadline Form Component
 * 
 * Reusable form for creating and editing deadlines.
 * Includes visual alerts for urgent deadlines and
 * conceptual calendar integration for reminders.
 */
'use client'

import React from "react"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { logActivity } from '@/lib/services/activity-log'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Badge } from '@/components/ui/badge'
import { CalendarIcon, Briefcase, User, Clock, Loader2, AlertTriangle, Gavel, FileText, Building2, Bell, CalendarIcon as CalendarIconSolid } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Event/deadline type configuration. Empty value = no type (generic event) */
const deadlineTypes = [
  { value: '', label: 'Sin tipo', description: 'Evento genérico', icon: CalendarIconSolid },
  {
    value: 'legal',
    label: 'Legal',
    description: 'Plazo establecido por ley',
    icon: Gavel,
  },
  { 
    value: 'judicial', 
    label: 'Judicial', 
    description: 'Plazo ordenado por el juzgado',
    icon: Gavel,
  },
  { 
    value: 'administrative', 
    label: 'Administrativo', 
    description: 'Trámite ante organismo',
    icon: Building2,
  },
  { 
    value: 'hearing', 
    label: 'Audiencia', 
    description: 'Comparecencia programada',
    icon: CalendarIconSolid,
  },
  { 
    value: 'internal', 
    label: 'Interno', 
    description: 'Plazo del estudio',
    icon: FileText,
  },
]

/** Reminder options */
const reminderOptions = [
  { value: 1, label: '1 día antes' },
  { value: 3, label: '3 días antes' },
  { value: 7, label: '1 semana antes' },
  { value: 14, label: '2 semanas antes' },
]

interface DeadlineFormProps {
  /** Available cases for assignment */
  cases: Array<{ id: string; case_number: string; title: string }>
  /** Team members available for assignment */
  teamMembers: Array<{ 
    id: string
    first_name: string
    last_name: string
    system_role: string 
  }>
  /** Pre-selected case (when creating from case detail) */
  preselectedCase?: { id: string; case_number: string; title: string } | null
  /** Current user ID for default assignment */
  currentUserId: string
  /** Existing deadline data for editing */
  existingDeadline?: {
    id: string
    title: string
    description: string | null
    deadline_type: string | null
    due_date: string
    case_id: string | null
    assigned_to: string | null
    google_calendar_event_id?: string | null
  }
}

export function DeadlineForm({ 
  cases, 
  teamMembers, 
  preselectedCase, 
  currentUserId,
  existingDeadline,
}: DeadlineFormProps) {
  const router = useRouter()
  const isEditing = !!existingDeadline

  // Form state
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [title, setTitle] = useState(existingDeadline?.title || '')
  const [description, setDescription] = useState(existingDeadline?.description || '')
  const [deadlineType, setDeadlineType] = useState(existingDeadline?.deadline_type ?? '')
  const [dueDate, setDueDate] = useState<Date | undefined>(
    existingDeadline?.due_date ? new Date(existingDeadline.due_date) : undefined
  )
  const [caseId, setCaseId] = useState(
    existingDeadline?.case_id || preselectedCase?.id || 'none'
  )
  const [assignedTo, setAssignedTo] = useState(
    existingDeadline?.assigned_to || currentUserId
  )
  const [reminders, setReminders] = useState<number[]>([3, 7])
  const [syncToCalendar, setSyncToCalendar] = useState(true)

  /** Handles form submission */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    
    if (!title.trim()) {
      toast.error('El título es obligatorio')
      return
    }

    if (!dueDate) {
      toast.error('La fecha es obligatoria')
      return
    }

    // Validate case_id is required for creation (deadlines.case_id is NOT NULL)
    if (!isEditing && (caseId === 'none' || !caseId)) {
      toast.error('Debe seleccionar un caso para crear el evento')
      return
    }

    setIsSubmitting(true)

    try {
      const supabase = createClient()

      const deadlineData = {
        title: title.trim(),
        description: description.trim() || null,
        deadline_type: deadlineType || null,
        due_date: dueDate.toISOString(),
        case_id: caseId === 'none' ? null : caseId,
        assigned_to: assignedTo || null,
        ...(isEditing ? {} : { 
          status: 'pending' as const,
          created_by: currentUserId,
        }),
      }

      if (isEditing) {
        const { error } = await supabase
          .from('deadlines')
          .update(deadlineData)
          .eq('id', existingDeadline.id)

        if (error) throw error

        await logActivity({
          supabase,
          userId: currentUserId,
          actionType: 'updated',
          entityType: 'deadline',
          entityId: existingDeadline.id,
          caseId: caseId === 'none' ? null : caseId,
          description: `actualizó el evento "${title.trim()}"`,
          newValues: { title: title.trim() },
        })

        const prevAssigned = existingDeadline.assigned_to
        const isAssignmentChange = (assignedTo || null) !== (prevAssigned || null)
        if (isAssignmentChange && assignedTo) {
          try {
            await fetch('/api/notifications/trigger', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                type: 'deadline_assigned',
                deadlineId: existingDeadline.id,
                deadlineTitle: title.trim(),
                caseId: caseId === 'none' ? null : caseId,
                assignedTo,
              }),
            })
          } catch {
            // Non-blocking
          }
        }

        if (syncToCalendar) {
          try {
            const syncRes = await fetch(`/api/deadlines/${existingDeadline.id}/sync-google`, {
              method: 'POST',
            })
            if (syncRes.ok) {
              toast.success('Evento actualizado y sincronizado con Google Calendar')
            } else {
              const data = await syncRes.json().catch(() => ({}))
              toast.warning(data.error ?? 'Evento actualizado, pero no se pudo sincronizar con Google Calendar')
            }
          } catch {
            toast.warning('Evento actualizado, pero no se pudo sincronizar con Google Calendar')
          }
        } else {
          toast.success('Evento actualizado correctamente')
        }
      } else {
        const { data: inserted, error } = await supabase
          .from('deadlines')
          .insert(deadlineData)
          .select('id')
          .single()

        if (error) throw error

        if (inserted?.id) {
          await logActivity({
            supabase,
            userId: currentUserId,
            actionType: 'created',
            entityType: 'deadline',
            entityId: inserted.id,
            caseId: caseId === 'none' ? null : caseId,
            description: `agendó el evento "${title.trim()}"`,
            newValues: { title: title.trim() },
          })
          try {
            await fetch('/api/notifications/trigger', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                type: 'deadline_created',
                deadlineId: inserted.id,
                deadlineTitle: title.trim(),
                caseId: caseId === 'none' ? null : caseId,
                assignedTo: assignedTo || null,
              }),
            })
          } catch {
            // Non-blocking
          }
        }

        // Sync to Google Calendar if requested
        if (syncToCalendar && inserted?.id) {
          try {
            const syncRes = await fetch(`/api/deadlines/${inserted.id}/sync-google`, {
              method: 'POST',
            })
            if (syncRes.ok) {
              toast.success('Evento creado y sincronizado con Google Calendar')
            } else {
              const data = await syncRes.json().catch(() => ({}))
              toast.warning(data.error ?? 'Evento creado, pero no se pudo sincronizar con Google Calendar')
            }
          } catch {
            toast.warning('Evento creado, pero no se pudo sincronizar con Google Calendar')
          }
        } else {
          toast.success('Evento creado correctamente')
        }
      }

      // Navigate back
      if (preselectedCase) {
        router.push(`/casos/${preselectedCase.id}?tab=cronologia`)
      } else {
        router.push('/eventos')
      }
      router.refresh()

    } catch (error) {
      console.error('Error saving deadline:', error)
      toast.error('Error al guardar el evento')
    } finally {
      setIsSubmitting(false)
    }
  }

  /** Calculates urgency info */
  function getUrgencyInfo(date: Date): { 
    text: string
    urgent: boolean
    color: string
  } {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const due = new Date(date)
    due.setHours(0, 0, 0, 0)
    
    const diffDays = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    
    if (diffDays < 0) {
      return { text: `${Math.abs(diffDays)} días de atraso`, urgent: true, color: 'text-destructive' }
    }
    if (diffDays === 0) {
      return { text: 'Vence hoy', urgent: true, color: 'text-destructive' }
    }
    if (diffDays <= 3) {
      return { text: `Vence en ${diffDays} días`, urgent: true, color: 'text-destructive' }
    }
    if (diffDays <= 7) {
      return { text: `Vence en ${diffDays} días`, urgent: false, color: 'text-warning' }
    }
    return { text: `Vence en ${diffDays} días`, urgent: false, color: 'text-muted-foreground' }
  }

  /** Toggles reminder */
  function toggleReminder(days: number) {
    setReminders(prev => 
      prev.includes(days) 
        ? prev.filter(d => d !== days)
        : [...prev, days]
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Form */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock className="h-5 w-5" />
                Información del Vencimiento
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Title */}
              <div className="space-y-2">
                <Label htmlFor="title">
                  Título <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="title"
                  placeholder="Ej: Contestación de demanda, Audiencia preliminar"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description">Descripción / Notas</Label>
                <Textarea
                  id="description"
                  placeholder="Detalles adicionales, requisitos, documentación necesaria..."
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Deadline Type */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Gavel className="h-5 w-5" />
                Tipo de evento
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {deadlineTypes.map((type) => {
                  const Icon = type.icon
                  const isSelected = deadlineType === type.value

                  return (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => setDeadlineType(type.value)}
                      className={cn(
                        'flex items-start gap-3 rounded-lg border-2 p-3 text-left transition-all',
                        isSelected 
                          ? 'border-primary bg-primary/5' 
                          : 'border-border hover:border-muted-foreground/50'
                      )}
                    >
                      <Icon className={cn(
                        'h-5 w-5 mt-0.5',
                        isSelected ? 'text-primary' : 'text-muted-foreground'
                      )} />
                      <div>
                        <p className={cn('font-medium text-sm', isSelected ? 'text-primary' : '')}>
                          {type.label}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {type.description}
                        </p>
                      </div>
                    </button>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          {/* Reminders (Conceptual Calendar Integration) */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Bell className="h-5 w-5" />
                Recordatorios
              </CardTitle>
              <CardDescription>
                Configure cuando recibir alertas previas al vencimiento
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {reminderOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => toggleReminder(option.value)}
                    className={cn(
                      'rounded-full px-4 py-2 text-sm font-medium transition-all',
                      reminders.includes(option.value)
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              {/* Calendar sync option */}
              <div className="flex items-center space-x-2 pt-2 border-t border-border">
                <Checkbox
                  id="sync-calendar"
                  checked={syncToCalendar}
                  onCheckedChange={(checked) => setSyncToCalendar(!!checked)}
                />
                <label
                  htmlFor="sync-calendar"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Sincronizar con Google Calendar
                </label>
                <Badge variant="secondary" className="text-[10px]">Próximamente</Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Due Date */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CalendarIcon className="h-5 w-5" />
                Fecha de Vencimiento <span className="text-destructive">*</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        'flex-1 justify-start text-left font-normal bg-transparent',
                        !dueDate && 'text-muted-foreground'
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dueDate ? (
                        dueDate.toLocaleDateString('es-AR', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      ) : (
                        'Seleccionar fecha'
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dueDate}
                      onSelect={(date) => {
                        if (date) {
                          const newDate = new Date(date)
                          if (dueDate) {
                            newDate.setHours(dueDate.getHours(), dueDate.getMinutes(), 0, 0)
                          } else {
                            newDate.setHours(9, 0, 0, 0)
                          }
                          setDueDate(newDate)
                        } else {
                          setDueDate(undefined)
                        }
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <div className="flex flex-col gap-1">
                  <Label htmlFor="due-time" className="text-xs text-muted-foreground">
                    Hora
                  </Label>
                  <Input
                    id="due-time"
                    type="time"
                    className="w-[110px]"
                    value={
                      dueDate
                        ? `${String(dueDate.getHours()).padStart(2, '0')}:${String(dueDate.getMinutes()).padStart(2, '0')}`
                        : '09:00'
                    }
                    onChange={(e) => {
                      const [h, m] = e.target.value.split(':').map(Number)
                      if (dueDate) {
                        const d = new Date(dueDate)
                        d.setHours(h, m, 0, 0)
                        setDueDate(d)
                      } else {
                        const d = new Date()
                        d.setHours(h, m, 0, 0)
                        setDueDate(d)
                      }
                    }}
                  />
                </div>
              </div>

              {/* Urgency indicator */}
              {dueDate && (
                <div className={cn(
                  'rounded-lg p-3',
                  getUrgencyInfo(dueDate).urgent ? 'bg-destructive/10' : 'bg-muted'
                )}>
                  <p className="text-sm font-medium text-foreground capitalize">
                    {dueDate.toLocaleDateString('es-AR', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </p>
                  {(() => {
                    const urgency = getUrgencyInfo(dueDate)
                    return (
                      <p className={cn('text-xs mt-1 font-medium', urgency.color)}>
                        {urgency.urgent && <AlertTriangle className="inline h-3 w-3 mr-1" />}
                        {urgency.text}
                      </p>
                    )
                  })()}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Assignment */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <User className="h-5 w-5" />
                Responsable
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Select value={assignedTo} onValueChange={setAssignedTo}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar responsable" />
                </SelectTrigger>
                <SelectContent>
                  {teamMembers.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      <span className="flex items-center gap-2">
                        {member.first_name} {member.last_name}
                        {member.id === currentUserId && (
                          <Badge variant="secondary" className="text-[10px]">Yo</Badge>
                        )}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Case Connection */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Briefcase className="h-5 w-5" />
                Caso Vinculado
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Select value={caseId} onValueChange={setCaseId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar caso" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin caso vinculado</SelectItem>
                  {cases.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      <span className="flex flex-col">
                        <span className="font-medium">{c.case_number}</span>
                        <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                          {c.title}
                        </span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Selected case preview */}
              {caseId && caseId !== 'none' && (
                <div className="rounded-lg bg-muted p-3">
                  {(() => {
                    const selectedCase = cases.find(c => c.id === caseId) || preselectedCase
                    if (!selectedCase) return null
                    return (
                      <>
                        <p className="text-sm font-medium text-foreground">
                          {selectedCase.case_number}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {selectedCase.title}
                        </p>
                      </>
                    )
                  })()}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Submit Buttons */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={isSubmitting}
          className="bg-transparent"
        >
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {isEditing ? 'Guardando...' : 'Creando...'}
            </>
          ) : (
            isEditing ? 'Guardar Cambios' : 'Crear Vencimiento'
          )}
        </Button>
      </div>
    </form>
  )
}
