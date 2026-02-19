'use client'

import { useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
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
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Plus,
  Search,
  LayoutGrid,
  Filter,
} from 'lucide-react'
import type { TaskStatus } from '@/lib/types'

interface KanbanBoardProps {
  tasks: KanbanTask[]
  columns: TaskStatus[]
  cases: Array<{ id: string; case_number: string; title: string }>
  currentUserId: string
}

const statusLabels: Record<TaskStatus, string> = {
  pending: 'pendiente',
  in_progress: 'en progreso',
  under_review: 'en revisión',
  completed: 'completada',
  cancelled: 'cancelada',
}

export function KanbanBoard({
  tasks: initialTasks,
  columns,
  cases,
  currentUserId,
}: KanbanBoardProps) {
  const router = useRouter()
  const [tasks, setTasks] = useState(initialTasks)
  const [activeTask, setActiveTask] = useState<KanbanTask | null>(null)
  const [search, setSearch] = useState('')
  const [caseFilter, setCaseFilter] = useState<string>('all')

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  )

  const filteredTasks = useMemo(() => {
    let result = tasks
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          (t.cases && typeof t.cases === 'object' && !Array.isArray(t.cases)
            ? (t.cases as { case_number?: string; title?: string }).case_number?.toLowerCase().includes(q) ||
              (t.cases as { case_number?: string; title?: string }).title?.toLowerCase().includes(q)
            : Array.isArray(t.cases)
            ? t.cases.some(
                (c) =>
                  c?.case_number?.toLowerCase().includes(q) ||
                  c?.title?.toLowerCase().includes(q)
              )
            : false)
      )
    }
    if (caseFilter && caseFilter !== 'all') {
      result = result.filter((t) => {
        const c = t.cases
        if (!c) return false
        const caseId = Array.isArray(c) ? c[0]?.id : (c as { id?: string })?.id
        return caseId === caseFilter
      })
    }
    return result
  }, [tasks, search, caseFilter])

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

  const tasksByStatus = useMemo(
    () =>
      columns.reduce(
        (acc, status) => {
          acc[status] = filteredTasks.filter((t) => t.status === status)
          return acc
        },
        {} as Record<string, KanbanTask[]>
      ),
    [columns, filteredTasks]
  )

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Trello-style header */}
      <div className="flex-shrink-0 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex flex-col gap-4 p-4 lg:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <LayoutGrid className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight">Tablero</h1>
                <p className="text-sm text-muted-foreground">
                  {filteredTasks.length} tarea{filteredTasks.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
            <Button asChild size="sm" className="shrink-0">
              <Link href="/tareas/nueva">
                <Plus className="mr-2 h-4 w-4" />
                Nueva tarea
              </Link>
            </Button>
          </div>

          {/* Filters bar */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar tareas..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
            <Select value={caseFilter} onValueChange={setCaseFilter}>
              <SelectTrigger className="w-[180px] h-9">
                <Filter className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                <SelectValue placeholder="Filtrar por caso" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los casos</SelectItem>
                {cases.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.case_number} – {c.title?.slice(0, 30)}
                    {c.title && c.title.length > 30 ? '…' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Board */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden p-4">
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4 h-full min-w-max pb-4">
            {columns.map((status) => (
              <KanbanColumn
                key={status}
                status={status}
                tasks={tasksByStatus[status] || []}
                cases={cases}
                currentUserId={currentUserId}
              />
            ))}
          </div>

          <DragOverlay>
            {activeTask ? (
              <div className="w-[280px] rotate-2 scale-105">
                <KanbanCard task={activeTask} isOverlay />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  )
}
