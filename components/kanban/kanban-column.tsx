'use client'

import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { KanbanCard, type KanbanTask } from './kanban-card'
import { taskStatusConfig } from '@/lib/types'

interface KanbanColumnProps {
  status: string
  tasks: KanbanTask[]
}

export function KanbanColumn({ status, tasks }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status })
  const config = taskStatusConfig[status as keyof typeof taskStatusConfig]
  const label = config?.label ?? status

  return (
    <div
      ref={setNodeRef}
      className={`
        flex-shrink-0 w-[280px] flex flex-col rounded-lg border bg-muted/30
        ${isOver ? 'ring-2 ring-primary ring-offset-2' : ''}
      `}
    >
      <div className="p-3 border-b flex items-center justify-between">
        <h3 className="font-semibold text-sm">{label}</h3>
        <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
          {tasks.length}
        </span>
      </div>
      <div className="flex-1 overflow-y-auto p-2 min-h-[120px] max-h-[calc(100vh-220px)]">
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {tasks.map((task) => (
              <KanbanCard key={task.id} task={task} />
            ))}
          </div>
        </SortableContext>
      </div>
    </div>
  )
}
