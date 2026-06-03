'use client'

import { useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  CheckCircle2,
  Circle,
  ChevronRight,
  Loader2,
  ListChecks,
  Calendar,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react'
import { toast } from 'sonner'
import type { ProcesoPipo } from '@/lib/workflow/stage-rules'

interface StageInfo {
  slug: string
  label: string
  order: number
  description?: string
  autoTaskCount: number
  lexiaDocType?: string
}

interface HistoryEntry {
  id: string
  etapa: string
  etapa_label: string
  notas?: string
  created_at: string
  profiles?: { full_name?: string }
}

interface PreviewTask {
  id: string
  title: string
  due_date?: string
}

interface PreviewDeadline {
  id: string
  title: string
  due_date: string
}

const PROCESO_TIPO_OPTIONS: { value: ProcesoPipo; label: string }[] = [
  { value: 'ordinario', label: 'Proceso Ordinario (Civil / Daños)' },
  { value: 'abreviado', label: 'Proceso Abreviado' },
  { value: 'ejecutivo', label: 'Proceso Ejecutivo' },
  { value: 'laboral', label: 'Proceso Laboral (Ley 7987)' },
  { value: 'familia', label: 'Fuero de Familia' },
  { value: 'otro', label: 'Otro' },
]

export function CaseStagePanel({
  caseId,
  canEdit,
}: {
  caseId: string
  canEdit: boolean
}) {
  const [loading, setLoading] = useState(true)
  const [current, setCurrent] = useState<string | null>(null)
  const [procesoPipo, setProcesoPipo] = useState<ProcesoPipo>('ordinario')
  const [stages, setStages] = useState<StageInfo[]>([])
  const [history, setHistory] = useState<HistoryEntry[]>([])

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedStage, setSelectedStage] = useState<StageInfo | null>(null)
  const [notas, setNotas] = useState('')
  const [preview, setPreview] = useState<{ tasks: PreviewTask[]; deadlines: PreviewDeadline[] } | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [confirming, setConfirming] = useState(false)

  const fetchStage = useCallback(async () => {
    try {
      const res = await fetch(`/api/cases/${caseId}/stage`)
      if (!res.ok) return
      const data = await res.json()
      setCurrent(data.current)
      setProcesoPipo(data.proceso_tipo ?? 'ordinario')
      setStages(data.stages ?? [])
      setHistory(data.history ?? [])
    } finally {
      setLoading(false)
    }
  }, [caseId])

  useEffect(() => { fetchStage() }, [fetchStage])

  async function handleProcessoTipoChange(newTipo: ProcesoPipo) {
    setProcesoPipo(newTipo)
    // Recargar etapas para el nuevo tipo de proceso
    setLoading(true)
    try {
      const res = await fetch(`/api/cases/${caseId}/stage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proceso_tipo: newTipo, stage_slug: current ?? 'consulta', dry_run: true }),
      })
      if (!res.ok) return
      // Recargar todo
      await fetchStage()
    } finally {
      setLoading(false)
    }
  }

  async function openAdvanceDialog(stage: StageInfo) {
    setSelectedStage(stage)
    setNotas('')
    setPreview(null)
    setDialogOpen(true)

    // Dry run para preview
    setPreviewLoading(true)
    try {
      const res = await fetch(`/api/cases/${caseId}/stage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proceso_tipo: procesoPipo,
          stage_slug: stage.slug,
          dry_run: true,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setPreview({ tasks: data.createdTasks, deadlines: data.createdDeadlines })
      }
    } finally {
      setPreviewLoading(false)
    }
  }

  async function confirmAdvance() {
    if (!selectedStage) return
    setConfirming(true)
    try {
      const res = await fetch(`/api/cases/${caseId}/stage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proceso_tipo: procesoPipo,
          stage_slug: selectedStage.slug,
          notas: notas.trim() || undefined,
          dry_run: false,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error || 'Error al avanzar etapa')
        return
      }
      const data = await res.json()
      toast.success(
        `Etapa avanzada a "${data.stage.label}" — ${data.createdTasks.length} tarea(s) y ${data.createdDeadlines.length} vencimiento(s) creados`
      )
      setDialogOpen(false)
      await fetchStage()
    } finally {
      setConfirming(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground p-6">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">Cargando etapa procesal...</span>
      </div>
    )
  }

  const currentStage = stages.find((s) => s.slug === current)
  const currentOrder = currentStage?.order ?? 0

  return (
    <div className="space-y-6">
      {/* Tipo de proceso */}
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <Label className="text-xs text-muted-foreground mb-1.5 block">Tipo de proceso</Label>
          <Select
            value={procesoPipo}
            onValueChange={(v) => handleProcessoTipoChange(v as ProcesoPipo)}
            disabled={!canEdit}
          >
            <SelectTrigger className="w-full max-w-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PROCESO_TIPO_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {currentStage && (
          <div className="flex-shrink-0 pt-5">
            <Badge variant="outline" className="text-xs">
              Etapa {currentStage.order} de {stages.length}
            </Badge>
          </div>
        )}
      </div>

      {/* Timeline de etapas */}
      <div className="space-y-1">
        {stages.map((stage, idx) => {
          const isDone = stage.order < currentOrder
          const isCurrent = stage.slug === current
          const isNext = stage.order === currentOrder + 1
          const isAccessible = canEdit && (isCurrent || stage.order > currentOrder)

          return (
            <div key={stage.slug} className="flex items-start gap-3">
              {/* Indicador */}
              <div className="flex flex-col items-center pt-0.5">
                <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${
                  isDone
                    ? 'border-primary bg-primary text-primary-foreground'
                    : isCurrent
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-muted-foreground/30 bg-background text-muted-foreground/30'
                }`}>
                  {isDone ? (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  ) : isCurrent ? (
                    <div className="h-2.5 w-2.5 rounded-full bg-primary" />
                  ) : (
                    <Circle className="h-3.5 w-3.5" />
                  )}
                </div>
                {idx < stages.length - 1 && (
                  <div className={`w-0.5 h-5 mt-1 ${isDone ? 'bg-primary' : 'bg-muted-foreground/20'}`} />
                )}
              </div>

              {/* Contenido */}
              <div className={`flex-1 pb-2 ${idx < stages.length - 1 ? '' : ''}`}>
                <div className="flex items-center gap-2 justify-between min-h-6">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm ${isCurrent ? 'font-semibold text-foreground' : isDone ? 'text-muted-foreground' : 'text-muted-foreground/70'}`}>
                      {stage.label}
                    </span>
                    {isCurrent && (
                      <Badge variant="default" className="text-[10px] px-1.5 py-0">
                        actual
                      </Badge>
                    )}
                    {isNext && canEdit && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground">
                        siguiente
                      </Badge>
                    )}
                  </div>

                  {canEdit && !isDone && !isCurrent && isAccessible && (
                    <Button
                      variant={isNext ? 'default' : 'outline'}
                      size="sm"
                      className="h-6 text-xs px-2"
                      onClick={() => openAdvanceDialog(stage)}
                    >
                      {isNext ? (
                        <>
                          <ArrowRight className="mr-1 h-3 w-3" />
                          Avanzar
                        </>
                      ) : (
                        'Ir a esta etapa'
                      )}
                    </Button>
                  )}
                </div>

                {stage.autoTaskCount > 0 && (isCurrent || isNext) && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {stage.autoTaskCount} tarea{stage.autoTaskCount > 1 ? 's' : ''} automática{stage.autoTaskCount > 1 ? 's' : ''}
                    {stage.description && ` — ${stage.description}`}
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Historial */}
      {history.length > 0 && (
        <div className="border-t pt-4 space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Historial de etapas</p>
          <div className="space-y-2">
            {history.slice(0, 5).map((entry) => (
              <div key={entry.id} className="flex gap-3 text-xs">
                <span className="text-muted-foreground whitespace-nowrap">
                  {new Date(entry.created_at).toLocaleDateString('es-AR', {
                    day: 'numeric', month: 'short',
                  })}
                </span>
                <div>
                  <span className="font-medium">{entry.etapa_label}</span>
                  {entry.notas && (
                    <p className="text-muted-foreground">{entry.notas}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Dialog de confirmación */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ChevronRight className="h-4 w-4" />
              Avanzar a: {selectedStage?.label}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Preview de tareas y vencimientos */}
            {previewLoading && (
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Calculando tareas automáticas...
              </div>
            )}

            {preview && !previewLoading && (
              <div className="space-y-3">
                {preview.tasks.length > 0 ? (
                  <>
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                        <ListChecks className="h-3.5 w-3.5" />
                        Se crearán {preview.tasks.length} tarea{preview.tasks.length > 1 ? 's' : ''}:
                      </p>
                      {preview.tasks.map((task, i) => (
                        <div key={i} className="flex items-start gap-2 rounded-md bg-muted/50 px-3 py-2">
                          <Circle className="h-3 w-3 mt-0.5 shrink-0 text-muted-foreground" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs">{task.title}</p>
                            {task.due_date && (
                              <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                                <Calendar className="h-2.5 w-2.5" />
                                Vence: {new Date(task.due_date).toLocaleDateString('es-AR', {
                                  day: 'numeric', month: 'long',
                                })}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="flex items-center gap-2 text-muted-foreground text-sm rounded-md bg-muted/30 px-3 py-2">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    No hay tareas automáticas para esta etapa
                  </div>
                )}
              </div>
            )}

            {/* Notas opcionales */}
            <div className="space-y-1.5">
              <Label className="text-xs">Notas del avance (opcional)</Label>
              <Textarea
                placeholder="Ej: Contestación presentada el 12/05. Sin excepciones planteadas."
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                rows={2}
                className="text-sm resize-none"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={confirming}>
              Cancelar
            </Button>
            <Button onClick={confirmAdvance} disabled={confirming || previewLoading}>
              {confirming ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Avanzando...
                </>
              ) : (
                <>
                  <ChevronRight className="mr-2 h-4 w-4" />
                  Confirmar avance
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
