'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { KanbanColumn } from './kanban-column'
import { KanbanCard, type KanbanTask } from './kanban-card'
import type { TaskStatus } from '@/lib/types'

interface KanbanBoardProps {
  tasks: KanbanTask[]
  columns: TaskStatus[]
}

const statusLabels: Record<TaskStatus, string> = {
  pending: 'pendiente',
  in_progress: 'en progreso',
  under_review: 'en revisión',
  completed: 'completada',
  cancelled: 'cancelada',
}

export function KanbanBoard({ tasks: initialTasks, columns }: KanbanBoardProps) {
  const router = useRouter()
  const [tasks, setTasks] = useState(initialTasks)
  const [activeTask, setActiveTask] = useState<KanbanTask | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  )

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const task = tasks.find((t) => t.id === event.active.id)
    if (task) setActiveTask(task)
  }, [tasks])

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      setActiveTask(null)
      const { active, over } = event
      if (!over || active.id === over.id) return

      const taskId = String(active.id)
      const overId = String(over.id)

      let newStatus: TaskStatus | null = null
      if (columns.includes(overId as TaskStatus)) {
        newStatus = overId as TaskStatus
      } else {
        const overTask = tasks.find((t) => t.id === overId)
        if (overTask) newStatus = overTask.status as TaskStatus
      }
      if (!newStatus) return

      const task = tasks.find((t) => t.id === taskId)
      if (!task || task.status === newStatus) return

      const previousStatus = task.status
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t))
      )

      try {
        const supabase = createClient()
        const { error } = await supabase
          .from('tasks')
          .update({ status: newStatus, updated_at: new Date().toISOString() })
          .eq('id', taskId)

        if (error) throw error

        toast.success(`Tarea marcada como ${statusLabels[newStatus]}`)
        router.refresh()
      } catch (err) {
        console.error('Error updating task status:', err)
        setTasks((prev) =>
          prev.map((t) => (t.id === taskId ? { ...t, status: previousStatus } : t))
        )
        toast.error('Error al actualizar el estado')
      }
    },
    [tasks, columns, router]
  )

  const tasksByStatus = columns.reduce(
    (acc, status) => {
      acc[status] = tasks.filter((t) => t.status === status)
      return acc
    },
    {} as Record<string, KanbanTask[]>
  )

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Tablero</h1>
        <p className="text-muted-foreground text-sm">
          Arrastra las tarjetas entre columnas para cambiar el estado de las tareas.
        </p>
      </div>

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {columns.map((status) => (
            <KanbanColumn
              key={status}
              status={status}
              tasks={tasksByStatus[status] || []}
            />
          ))}
        </div>

        <DragOverlay>
          {activeTask ? (
            <div className="w-[280px]">
              <KanbanCard task={activeTask} isOverlay />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  )
}
