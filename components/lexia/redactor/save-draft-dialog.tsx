'use client'

import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import type { DocumentType } from '@/lib/ai/draft-schemas'

interface SaveDraftDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  documentType: DocumentType
  content: string
  formData: Record<string, string>
  preselectedCaseId?: string | null
  defaultTitle: string
  onSaved?: (draftId: string) => void
}

interface CaseOption {
  id: string
  case_number: string
  title: string
}

export function SaveDraftDialog({
  open,
  onOpenChange,
  documentType,
  content,
  formData,
  preselectedCaseId,
  defaultTitle,
  onSaved,
}: SaveDraftDialogProps) {
  const [name, setName] = useState(defaultTitle)
  const [caseId, setCaseId] = useState<string | null>(preselectedCaseId ?? null)
  const [cases, setCases] = useState<CaseOption[]>([])
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    setName(defaultTitle)
    setCaseId(preselectedCaseId ?? null)
  }, [defaultTitle, preselectedCaseId, open])

  useEffect(() => {
    if (open) {
      const supabase = createClient()
      supabase
        .from('cases')
        .select('id, case_number, title')
        .order('updated_at', { ascending: false })
        .limit(50)
        .then(({ data, error }) => {
          if (!error && data) setCases(data)
        })
    }
  }, [open])

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Ingresá un título')
      return
    }
    setIsSaving(true)
    try {
      const res = await fetch('/api/lexia/drafts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentType,
          name: name.trim(),
          content,
          formData,
          caseId: caseId || null,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Error al guardar')
      }
      const draft = await res.json()
      toast.success('Borrador guardado')
      onOpenChange(false)
      onSaved?.(draft.id)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Guardar borrador</DialogTitle>
          <DialogDescription>
            El borrador quedará guardado para retomarlo más tarde. Podés asociarlo a un caso.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="draft-name">Título</Label>
            <Input
              id="draft-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Borrador Demanda - ..."
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="draft-case">Caso asociado (opcional)</Label>
            <Select
              value={caseId ?? 'none'}
              onValueChange={(v) => setCaseId(v === 'none' ? null : v)}
            >
              <SelectTrigger id="draft-case">
                <SelectValue placeholder="Sin caso" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin caso</SelectItem>
                {cases.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.case_number} - {c.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Guardando...' : 'Guardar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
