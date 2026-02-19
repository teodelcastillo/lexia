'use client'

import Link from 'next/link'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Calendar, Briefcase } from 'lucide-react'
import type { TaskPriority } from '@/lib/types'

const priorityColors: Record<TaskPriority, string> = {
  low: 'border-l-muted-foreground/30',
  medium: 'border-l-chart-2',
  high: 'border-l-warning',
  urgent: 'border-l-destructive',
}

const priorityLabels: Record<TaskPriority, string> = {
  low: 'Baja',
  medium: 'Media',
  high: 'Alta',
  urgent: 'Urgente',
}

export interface KanbanTask {
  id: string
  title: string
  description?: string | null
  status: string
  priority: TaskPriority
  due_date?: string | null
  created_at: string
  cases?: { id: string; case_number?: string; title?: string } | null
  assignee?: { id: string; first_name?: string; last_name?: string } | null
}

interface KanbanCardProps {
  task: KanbanTask
  /** When true, renders without sortable (for DragOverlay) */
  isOverlay?: boolean
}

function formatDueDate(dateString: string | null | undefined): string {
  if (!dateString) return ''
  const d = new Date(dateString)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  d.setHours(0, 0, 0, 0)
  const diff = Math.ceil((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  if (diff < 0) return `Vencida hace ${Math.abs(diff)}d`
  if (diff === 0) return 'Hoy'
  if (diff === 1) return 'Mañana'
  return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
}

function KanbanCardContent({ task, isOverlay }: KanbanCardProps) {
  const caseData = task.cases
  const caseNumber = Array.isArray(caseData) ? caseData[0]?.case_number : caseData?.case_number

  const card = (
    <Card
      className={`
        border-l-4
        ${priorityColors[task.priority] || priorityColors.medium}
        ${isOverlay ? 'shadow-lg cursor-grabbing' : 'cursor-grab active:cursor-grabbing'}
      `}
    >
      <CardContent className="p-3 space-y-2">
        <p className="text-sm font-medium line-clamp-2">{task.title}</p>
        {caseNumber && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Briefcase className="h-3 w-3 shrink-0" />
            <span>{caseNumber}</span>
          </div>
        )}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
            {priorityLabels[task.priority]}
          </Badge>
          {task.due_date && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3" />
              {formatDueDate(task.due_date)}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )

  if (isOverlay) return card

  return (
    <Link href={`/tareas/${task.id}`}>
      {card}
    </Link>
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
      <Link href={`/tareas/${task.id}`} onClick={(e) => isDragging && e.preventDefault()}>
        <Card
          className={`
            cursor-grab active:cursor-grabbing
            border-l-4
            ${priorityColors[task.priority] || priorityColors.medium}
            ${isDragging ? 'opacity-50 shadow-lg ring-2 ring-primary' : ''}
          `}
        >
          <CardContent className="p-3 space-y-2">
            <p className="text-sm font-medium line-clamp-2">{task.title}</p>
            {(() => {
              const caseData = task.cases
              const caseNumber = Array.isArray(caseData) ? caseData[0]?.case_number : caseData?.case_number
              return caseNumber ? (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Briefcase className="h-3 w-3 shrink-0" />
                  <span>{caseNumber}</span>
                </div>
              ) : null
            })()}
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                {priorityLabels[task.priority]}
              </Badge>
              {task.due_date && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  {formatDueDate(task.due_date)}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </Link>
    </div>
  )
}
