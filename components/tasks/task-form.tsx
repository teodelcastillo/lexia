/**
 * Task Form Component
 * 
 * Reusable form for creating and editing tasks.
 * Includes fields for:
 * - Title and description
 * - Due date with visual calendar
 * - Priority selection with visual indicators
 * - User assignment
 * - Case connection
 */
'use client'

import React from "react"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
import {
  CalendarIcon,
  Briefcase,
  User,
  Flag,
  CheckSquare,
  Loader2,
  AlertTriangle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { TaskPriority } from '@/lib/types'

/** Priority configuration with visual indicators */
const priorityConfig: Record<TaskPriority, { 
  label: string
  description: string
  color: string
  icon: typeof Flag
}> = {
  low: {
    label: 'Baja',
    description: 'Sin urgencia, puede esperar',
    color: 'text-muted-foreground border-muted',
    icon: Flag,
  },
  medium: {
    label: 'Media',
    description: 'Prioridad normal',
    color: 'text-chart-2 border-chart-2',
    icon: Flag,
  },
  high: {
    label: 'Alta',
    description: 'Importante, atender pronto',
    color: 'text-warning border-warning',
    icon: Flag,
  },
  urgent: {
    label: 'Urgente',
    description: 'Requiere atención inmediata',
    color: 'text-destructive border-destructive',
    icon: AlertTriangle,
  },
}

interface TaskFormProps {
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
  /** Existing task data for editing */
  existingTask?: {
    id: string
    title: string
    description: string | null
    priority: TaskPriority
    due_date: string | null
    case_id: string | null
    assigned_to: string | null
  }
}

export function TaskForm({ 
  cases, 
  teamMembers, 
  preselectedCase, 
  currentUserId,
  existingTask,
}: TaskFormProps) {
  const router = useRouter()
  const isEditing = !!existingTask

  // Form state
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [title, setTitle] = useState(existingTask?.title || '')
  const [description, setDescription] = useState(existingTask?.description || '')
  const [priority, setPriority] = useState<TaskPriority>(existingTask?.priority || 'medium')
  const [dueDate, setDueDate] = useState<Date | undefined>(
    existingTask?.due_date ? new Date(existingTask.due_date) : undefined
  )
  const [caseId, setCaseId] = useState(
    existingTask?.case_id || preselectedCase?.id || 'defaultCaseId'
  )
  const [assignedTo, setAssignedTo] = useState(
    existingTask?.assigned_to || currentUserId
  )

  /** Handles form submission */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    
    if (!title.trim()) {
      toast.error('El título es obligatorio')
      return
    }

    setIsSubmitting(true)

    try {
      const supabase = createClient()

      const taskData = {
        title: title.trim(),
        description: description.trim() || null,
        priority,
        due_date: dueDate?.toISOString() || null,
        case_id: caseId || null,
        assigned_to: assignedTo || null,
        ...(isEditing ? {} : { 
          status: 'pending' as const,
          created_by: currentUserId,
        }),
      }

      if (isEditing) {
        const { error } = await supabase
          .from('tasks')
          .update(taskData)
          .eq('id', existingTask.id)

        if (error) throw error
        toast.success('Tarea actualizada correctamente')
      } else {
        const { error } = await supabase
          .from('tasks')
          .insert(taskData)

        if (error) throw error
        toast.success('Tarea creada correctamente')
      }

      // Navigate back
      if (preselectedCase) {
        router.push(`/casos/${preselectedCase.id}?tab=tareas`)
      } else {
        router.push('/tareas')
      }
      router.refresh()

    } catch (error) {
      console.error('Error saving task:', error)
      toast.error('Error al guardar la tarea')
    } finally {
      setIsSubmitting(false)
    }
  }

  /** Formats the due date for display */
  function formatDueDate(date: Date): string {
    return date.toLocaleDateString('es-AR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  }

  /** Calculates days until due date */
  function getDaysUntilDue(date: Date): { text: string; urgent: boolean } {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const due = new Date(date)
    due.setHours(0, 0, 0, 0)
    
    const diffDays = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    
    if (diffDays < 0) return { text: `${Math.abs(diffDays)} días de atraso`, urgent: true }
    if (diffDays === 0) return { text: 'Vence hoy', urgent: true }
    if (diffDays === 1) return { text: 'Vence mañana', urgent: true }
    if (diffDays <= 3) return { text: `Vence en ${diffDays} días`, urgent: true }
    if (diffDays <= 7) return { text: `Vence en ${diffDays} días`, urgent: false }
    return { text: `Vence en ${diffDays} días`, urgent: false }
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
                <CheckSquare className="h-5 w-5" />
                Información de la Tarea
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
                  placeholder="Ej: Redactar demanda inicial"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description">Descripción</Label>
                <Textarea
                  id="description"
                  placeholder="Describa los detalles de la tarea..."
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Priority Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Flag className="h-5 w-5" />
                Prioridad
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2">
                {(Object.keys(priorityConfig) as TaskPriority[]).map((p) => {
                  const config = priorityConfig[p]
                  const Icon = config.icon
                  const isSelected = priority === p

                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPriority(p)}
                      className={cn(
                        'flex items-start gap-3 rounded-lg border-2 p-4 text-left transition-all',
                        isSelected 
                          ? config.color + ' bg-background' 
                          : 'border-border hover:border-muted-foreground/50'
                      )}
                    >
                      <Icon className={cn('h-5 w-5 mt-0.5', isSelected ? config.color.split(' ')[0] : 'text-muted-foreground')} />
                      <div>
                        <p className={cn('font-medium', isSelected ? config.color.split(' ')[0] : '')}>
                          {config.label}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {config.description}
                        </p>
                      </div>
                    </button>
                  )
                })}
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
                Fecha de Vencimiento
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal bg-transparent',
                      !dueDate && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dueDate ? (
                      dueDate.toLocaleDateString('es-AR', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
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
                    onSelect={setDueDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>

              {/* Due date indicator */}
              {dueDate && (
                <div className="rounded-lg bg-muted p-3">
                  <p className="text-sm font-medium text-foreground capitalize">
                    {formatDueDate(dueDate)}
                  </p>
                  {(() => {
                    const { text, urgent } = getDaysUntilDue(dueDate)
                    return (
                      <p className={cn(
                        'text-xs mt-1',
                        urgent ? 'text-destructive font-medium' : 'text-muted-foreground'
                      )}>
                        {text}
                      </p>
                    )
                  })()}
                </div>
              )}

              {/* Quick date buttons */}
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="bg-transparent"
                  onClick={() => setDueDate(new Date())}
                >
                  Hoy
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="bg-transparent"
                  onClick={() => {
                    const tomorrow = new Date()
                    tomorrow.setDate(tomorrow.getDate() + 1)
                    setDueDate(tomorrow)
                  }}
                >
                  Mañana
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="bg-transparent"
                  onClick={() => {
                    const nextWeek = new Date()
                    nextWeek.setDate(nextWeek.getDate() + 7)
                    setDueDate(nextWeek)
                  }}
                >
                  En 1 semana
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Assignment */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <User className="h-5 w-5" />
                Asignación
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Assigned to */}
              <div className="space-y-2">
                <Label htmlFor="assigned_to">Asignar a</Label>
                <Select value={assignedTo} onValueChange={setAssignedTo}>
                  <SelectTrigger id="assigned_to">
                    <SelectValue placeholder="Seleccionar usuario" />
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
              </div>
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
                  <SelectValue placeholder="Seleccionar caso (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="defaultCaseId">Sin caso vinculado</SelectItem>
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
              {caseId && (
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
            isEditing ? 'Guardar Cambios' : 'Crear Tarea'
          )}
        </Button>
      </div>
    </form>
  )
}
