'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus, Loader2 } from 'lucide-react'
import type { TaskStatus } from '@/lib/types'

interface KanbanQuickAddProps {
  status: TaskStatus
  cases: Array<{ id: string; case_number: string; title: string }>
  currentUserId: string
}

export function KanbanQuickAdd({
  status,
  cases,
  currentUserId,
}: KanbanQuickAddProps) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [caseId, setCaseId] = useState(cases[0]?.id ?? '')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    if (!caseId && cases.length > 0) {
      toast.error('Selecciona un caso')
      return
    }
    const resolvedCaseId = caseId || cases[0]?.id
    if (!resolvedCaseId) {
      toast.error('No hay casos disponibles. Crea un caso primero.')
      return
    }

    setLoading(true)
    try {
      const supabase = createClient()
      const { data: inserted, error } = await supabase
        .from('tasks')
        .insert({
          title: title.trim(),
          status,
          case_id: resolvedCaseId,
          created_by: currentUserId,
          assigned_to: currentUserId,
          priority: 'medium',
        })
        .select('id')
        .single()

      if (error) throw error

      if (inserted?.id) {
        const { logActivity } = await import('@/lib/services/activity-log')
        await logActivity({
          supabase,
          userId: currentUserId,
          actionType: 'created',
          entityType: 'task',
          entityId: inserted.id,
          caseId: resolvedCaseId,
          description: `creó la tarea "${title.trim()}"`,
          newValues: { title: title.trim() },
        })
      }

      toast.success('Tarea creada')
      setTitle('')
      setIsOpen(false)
      router.refresh()
    } catch (err) {
      console.error('Error creating task:', err)
      toast.error('No se pudo crear la tarea')
    } finally {
      setLoading(false)
    }
  }

  if (cases.length === 0) {
    return (
      <a
        href="/tareas/nueva"
        className="flex items-center gap-2 w-full py-2.5 px-3 rounded-lg text-sm text-muted-foreground hover:bg-muted/50 transition-colors"
      >
        <Plus className="h-4 w-4" />
        Agregar tarjeta
      </a>
    )
  }

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 w-full py-2.5 px-3 rounded-lg text-sm text-muted-foreground hover:bg-muted/50 transition-colors text-left"
      >
        <Plus className="h-4 w-4" />
        Agregar tarjeta
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2 pt-1">
      <Input
        placeholder="Título de la tarea..."
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="h-9 text-sm"
        autoFocus
        disabled={loading}
      />
      <Select value={caseId} onValueChange={setCaseId} disabled={loading}>
        <SelectTrigger className="h-9 text-sm">
          <SelectValue placeholder="Caso" />
        </SelectTrigger>
        <SelectContent>
          {cases.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.case_number} – {c.title?.slice(0, 40)}
              {c.title && c.title.length > 40 ? '…' : ''}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={loading || !title.trim()}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Agregar'}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            setIsOpen(false)
            setTitle('')
          }}
          disabled={loading}
        >
          Cancelar
        </Button>
      </div>
    </form>
  )
}
