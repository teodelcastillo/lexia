'use client'

import Link from 'next/link'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Calendar, Briefcase, MoreHorizontal, ExternalLink } from 'lucide-react'
import type { TaskPriority } from '@/lib/types'
import { cn } from '@/lib/utils'

const priorityConfig: Record<TaskPriority, { label: string; dot: string; border: string }> = {
  low: {
    label: 'Baja',
    dot: 'bg-slate-400',
    border: 'border-l-slate-400',
  },
  medium: {
    label: 'Media',
    dot: 'bg-amber-500',
    border: 'border-l-amber-500',
  },
  high: {
    label: 'Alta',
    dot: 'bg-orange-500',
    border: 'border-l-orange-500',
  },
  urgent: {
    label: 'Urgente',
    dot: 'bg-red-500',
    border: 'border-l-red-500',
  },
}

export interface KanbanTask {
  id: string
  title: string
  description?: string | null
  status: string
  priority: TaskPriority
  due_date?: string | null
  created_at: string
  cases?: { id: string; case_number?: string; title?: string } | { id: string; case_number?: string; title?: string }[] | null
  assignee?: { id: string; first_name?: string; last_name?: string } | null
}

interface KanbanCardProps {
  task: KanbanTask
  isOverlay?: boolean
}

function formatDueDate(dateString: string | null | undefined): {
  text: string
  isOverdue: boolean
  isToday: boolean
} {
  if (!dateString) return { text: '', isOverdue: false, isToday: false }
  const d = new Date(dateString)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  d.setHours(0, 0, 0, 0)
  const diff = Math.ceil((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  if (diff < 0) return { text: `Vencida hace ${Math.abs(diff)}d`, isOverdue: true, isToday: false }
  if (diff === 0) return { text: 'Hoy', isOverdue: false, isToday: true }
  if (diff === 1) return { text: 'Mañana', isOverdue: false, isToday: false }
  return {
    text: d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }),
    isOverdue: false,
    isToday: false,
  }
}

function getCaseInfo(task: KanbanTask): string | null {
  const c = task.cases
  if (!c) return null
  if (Array.isArray(c)) return c[0]?.case_number ?? null
  return (c as { case_number?: string }).case_number ?? null
}

function getAssigneeInitials(task: KanbanTask): string {
  const a = task.assignee
  if (!a) return '?'
  const first = (a as { first_name?: string }).first_name?.[0] ?? ''
  const last = (a as { last_name?: string }).last_name?.[0] ?? ''
  return (first + last).toUpperCase() || '?'
}

function KanbanCardContent({ task, isOverlay }: KanbanCardProps) {
  const caseNumber = getCaseInfo(task)
  const dueInfo = formatDueDate(task.due_date)
  const config = priorityConfig[task.priority] ?? priorityConfig.medium

  return (
    <Card
      className={cn(
        'border-l-4 transition-all duration-150',
        config.border,
        isOverlay
          ? 'shadow-xl cursor-grabbing scale-105'
          : 'cursor-grab active:cursor-grabbing hover:shadow-md hover:border-muted-foreground/20'
      )}
    >
      <CardContent className="p-3 space-y-2.5">
        {/* Priority label + title */}
        <div className="flex items-start gap-2">
          <span
            className={cn(
              'flex-shrink-0 w-2 h-2 rounded-full mt-1.5',
              config.dot
            )}
            title={config.label}
          />
          <p className="text-sm font-medium line-clamp-2 flex-1 leading-snug">
            {task.title}
          </p>
        </div>

        {/* Case badge */}
        {caseNumber && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Briefcase className="h-3 w-3 shrink-0" />
            <span className="truncate">{caseNumber}</span>
          </div>
        )}

        {/* Footer: due date + assignee */}
        <div className="flex items-center justify-between gap-2 pt-0.5">
          {task.due_date ? (
            <div
              className={cn(
                'flex items-center gap-1 text-xs',
                dueInfo.isOverdue
                  ? 'text-red-600 dark:text-red-400 font-medium'
                  : dueInfo.isToday
                  ? 'text-amber-600 dark:text-amber-400 font-medium'
                  : 'text-muted-foreground'
              )}
            >
              <Calendar className="h-3 w-3 shrink-0" />
              {dueInfo.text}
            </div>
          ) : (
            <span />
          )}
          <Avatar className="h-6 w-6 text-[10px]">
            <AvatarFallback className="bg-primary/10 text-primary">
              {getAssigneeInitials(task)}
            </AvatarFallback>
          </Avatar>
        </div>
      </CardContent>
    </Card>
  )
}

export function KanbanCard({ task, isOverlay }: KanbanCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id, disabled: !!isOverlay })

  if (isOverlay) {
    return <KanbanCardContent task={task} isOverlay />
  }

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <div className="group relative">
        <Link
          href={`/tareas/${task.id}`}
          onClick={(e) => isDragging && e.preventDefault()}
          className="block"
        >
          <div
            className={cn(
              'transition-opacity',
              isDragging && 'opacity-50'
            )}
          >
            <KanbanCardContent task={task} />
          </div>
        </Link>
        {/* Quick actions on hover - Trello style */}
        <div
          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
          }}
        >
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="h-6 w-6 rounded flex items-center justify-center bg-background/80 hover:bg-muted text-muted-foreground hover:text-foreground shadow-sm border"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href={`/tareas/${task.id}`}>
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Ver detalle
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  )
}
