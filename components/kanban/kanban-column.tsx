'use client'

import { useState } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { KanbanCard, type KanbanTask } from './kanban-card'
import { KanbanQuickAdd } from './kanban-quick-add'
import { taskStatusConfig } from '@/lib/types'
import { ListTodo } from 'lucide-react'

interface KanbanColumnProps {
  status: string
  tasks: KanbanTask[]
  cases: Array<{ id: string; case_number: string; title: string }>
  currentUserId: string
}

const columnStyles: Record<string, { header: string; bg: string }> = {
  pending: {
    header: 'bg-amber-500/15 border-amber-500/30 text-amber-800 dark:text-amber-200',
    bg: 'bg-amber-500/5',
  },
  in_progress: {
    header: 'bg-blue-500/15 border-blue-500/30 text-blue-800 dark:text-blue-200',
    bg: 'bg-blue-500/5',
  },
  under_review: {
    header: 'bg-purple-500/15 border-purple-500/30 text-purple-800 dark:text-purple-200',
    bg: 'bg-purple-500/5',
  },
  completed: {
    header: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-800 dark:text-emerald-200',
    bg: 'bg-emerald-500/5',
  },
}

export function KanbanColumn({
  status,
  tasks,
  cases,
  currentUserId,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status })
  const config = taskStatusConfig[status as keyof typeof taskStatusConfig]
  const label = config?.label ?? status
  const styles = columnStyles[status] ?? {
    header: 'bg-muted',
    bg: 'bg-muted/30',
  }

  return (
    <div
      ref={setNodeRef}
      className={`
        flex-shrink-0 w-[300px] flex flex-col rounded-xl border
        transition-all duration-200
        ${styles.bg}
        ${isOver ? 'ring-2 ring-primary ring-offset-2 scale-[1.02]' : ''}
      `}
    >
      {/* Column header - Trello style */}
      <div
        className={`
          flex items-center justify-between px-4 py-3 rounded-t-xl border-b
          ${styles.header}
        `}
      >
        <div className="flex items-center gap-2">
          <ListTodo className="h-4 w-4 opacity-70" />
          <h3 className="font-semibold text-sm">{label}</h3>
        </div>
        <span
          className={`
            text-xs font-medium px-2.5 py-0.5 rounded-full
            ${styles.header}
          `}
        >
          {tasks.length}
        </span>
      </div>

      {/* Cards area */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 min-h-[140px] max-h-[calc(100vh-320px)] space-y-2">
        <SortableContext
          items={tasks.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          {tasks.map((task) => (
            <KanbanCard key={task.id} task={task} />
          ))}
        </SortableContext>

        {/* Empty state */}
        {tasks.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="rounded-full bg-muted/50 p-4 mb-2">
              <ListTodo className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">Sin tareas</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Arrastra una tarjeta o agrega una nueva
            </p>
          </div>
        )}

        {/* Quick add - Trello style */}
        <KanbanQuickAdd
          status={status}
          cases={cases}
          currentUserId={currentUserId}
        />
      </div>
    </div>
  )
}
