/**
 * Procesador de Cédulas
 *
 * Sube un PDF de cédula o notificación judicial, analiza con IA según CPCC Córdoba
 * y calcula plazos. Permite crear un vencimiento tras confirmar.
 */
'use client'

import { useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  FileSearch,
  Upload,
  Loader2,
  Calendar,
  Gavel,
  AlertTriangle,
  CheckCircle2,
  Briefcase,
  Sparkles,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { format, parseISO, differenceInBusinessDays } from 'date-fns'
import { es } from 'date-fns/locale'
import type { CedulaAnalysis } from '@/lib/herramientas/cordoba-cpcc'

const MAX_FILE_SIZE = 15 * 1024 * 1024 // 15 MB

interface CaseOption {
  id: string
  case_number: string
  title: string
}

export default function CedulasPage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [isDragging, setIsDragging] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [analysis, setAnalysis] = useState<CedulaAnalysis | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [cases, setCases] = useState<CaseOption[]>([])
  const [selectedCaseId, setSelectedCaseId] = useState<string>('')
  const [suggestedCase, setSuggestedCase] = useState<CaseOption | null>(null)
  const [matchReason, setMatchReason] = useState<string | null>(null)
  const [isLoadingCases, setIsLoadingCases] = useState(false)
  const [isCreating, setIsCreating] = useState(false)

  const handleFile = useCallback(
    async (file: File) => {
      if (file.type !== 'application/pdf') {
        toast.error('Solo se aceptan archivos PDF')
        return
      }
      if (file.size > MAX_FILE_SIZE) {
        toast.error('El archivo no puede superar 15 MB')
        return
      }

      setError(null)
      setAnalysis(null)
      setIsProcessing(true)

      try {
        const formData = new FormData()
        formData.append('file', file)

        const res = await fetch('/api/herramientas/cedulas/procesar', {
          method: 'POST',
          body: formData,
        })

        const data = await res.json()

        if (!res.ok) {
          throw new Error(data.error ?? 'Error al procesar el documento')
        }

        if (!data.analysis) {
          throw new Error('No se recibió análisis')
        }

        setAnalysis(data.analysis)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al procesar')
        toast.error(err instanceof Error ? err.message : 'Error al procesar')
      } finally {
        setIsProcessing(false)
      }
    },
    []
  )

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    e.target.value = ''
  }

  const openCreateDialog = useCallback(async () => {
    setShowCreateDialog(true)
    setSelectedCaseId('')
    setSuggestedCase(null)
    setMatchReason(null)
    setIsLoadingCases(true)
    try {
      const supabase = createClient()
      const [casesRes, suggestionRes] = await Promise.all([
        supabase
          .from('cases')
          .select('id, case_number, title')
          .in('status', ['active', 'pending'])
          .order('case_number', { ascending: false })
          .limit(100),
        analysis?.numero_expediente || analysis?.partes
          ? fetch('/api/herramientas/cedulas/sugerir-caso', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                numero_expediente: analysis?.numero_expediente ?? '',
                partes: analysis?.partes ?? '',
              }),
            }).then((r) => r.json())
          : Promise.resolve({ suggestedCase: null, matchReason: null }),
      ])

      const { data: casesData, error: err } = casesRes
      if (err) throw err
      setCases(casesData ?? [])

      const sug = suggestionRes?.suggestedCase
      const reason = suggestionRes?.matchReason
      if (sug) {
        setSuggestedCase(sug)
        setMatchReason(reason ?? null)
        setSelectedCaseId(sug.id)
      }
    } catch (err) {
      toast.error('No se pudieron cargar los casos')
      setCases([])
    } finally {
      setIsLoadingCases(false)
    }
  }, [analysis])

  const handleCreateVencimiento = useCallback(async () => {
    if (!analysis || !selectedCaseId) {
      toast.error('Seleccioná un caso para crear el vencimiento')
      return
    }

    const dueDate = analysis.fecha_vencimiento
      ? parseISO(analysis.fecha_vencimiento)
      : null

    if (!dueDate) {
      toast.error('No hay fecha de vencimiento calculada')
      return
    }

    setIsCreating(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        toast.error('Debés iniciar sesión')
        return
      }

      const title = `Cédula: ${analysis.tipo_cedula}${analysis.numero_expediente ? ` - Exp. ${analysis.numero_expediente}` : ''}`
      const description = [
        analysis.juzgado && `Juzgado: ${analysis.juzgado}`,
        analysis.partes && `Partes: ${analysis.partes}`,
        analysis.fecha_notificacion &&
          `Notificación: ${format(parseISO(analysis.fecha_notificacion), 'dd/MM/yyyy', { locale: es })}`,
        `Plazo: ${analysis.plazo_dias} días ${analysis.tipo_dias} (Art. ${analysis.articulo_cpcc} CPCC)`,
        analysis.observaciones && `Obs: ${analysis.observaciones}`,
      ]
        .filter(Boolean)
        .join('\n')

      const { error: insertError } = await supabase.from('deadlines').insert({
        title,
        description: description || null,
        deadline_type: 'judicial',
        due_date: dueDate.toISOString(),
        case_id: selectedCaseId,
        created_by: user.id,
        status: 'pending',
      })

      if (insertError) throw insertError

      toast.success('Vencimiento creado correctamente')
      setShowCreateDialog(false)
      setAnalysis(null)
      router.push('/vencimientos')
      router.refresh()
    } catch (err) {
      console.error('Error creating deadline:', err)
      toast.error('Error al crear el vencimiento')
    } finally {
      setIsCreating(false)
    }
  }, [analysis, selectedCaseId, router])

  const isUrgent =
    analysis?.fecha_vencimiento &&
    differenceInBusinessDays(parseISO(analysis.fecha_vencimiento), new Date()) <= 5

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground flex items-center gap-2">
          <FileSearch className="h-6 w-6" />
          Procesador de Cédulas
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Subí un PDF de cédula o notificación judicial. Se analiza según el Código Procesal Civil y
          Comercial de Córdoba (Ley 8465) y se calculan los plazos.
        </p>
      </div>

      {/* Upload zone */}
      <Card>
        <CardContent className="pt-6">
          <div
            onDragOver={(e) => {
              e.preventDefault()
              setIsDragging(true)
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`
              border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors
              ${isDragging ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'}
            `}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              onChange={handleFileInput}
              className="hidden"
            />
            {isProcessing ? (
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">
                  Analizando documento...
                </span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Upload className="h-10 w-10 text-muted-foreground" />
                <span className="text-sm font-medium">
                  Arrastrá un PDF o hacé clic para seleccionar
                </span>
                <span className="text-xs text-muted-foreground">
                  Máximo 15 MB. PDF nativo o escaneado.
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Error */}
      {error && (
        <Card className="border-destructive/50">
          <CardContent className="pt-6 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0" />
            <div>
              <p className="font-medium text-destructive">Error</p>
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Result card */}
      {analysis && !error && (
        <Card className={isUrgent ? 'border-amber-500/50' : ''}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Gavel className="h-5 w-5" />
                {analysis.tipo_cedula}
              </CardTitle>
              <Badge
                variant={
                  analysis.confianza === 'alta'
                    ? 'default'
                    : analysis.confianza === 'media'
                      ? 'secondary'
                      : 'outline'
                }
              >
                Confianza: {analysis.confianza}
              </Badge>
            </div>
            <CardDescription>
              Análisis según CPCC Córdoba (Ley 8465)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              {analysis.numero_expediente && (
                <div>
                  <p className="text-xs text-muted-foreground">Expediente</p>
                  <p className="font-medium">{analysis.numero_expediente}</p>
                </div>
              )}
              {analysis.juzgado && (
                <div>
                  <p className="text-xs text-muted-foreground">Juzgado</p>
                  <p className="font-medium">{analysis.juzgado}</p>
                </div>
              )}
              {analysis.fecha_notificacion && (
                <div>
                  <p className="text-xs text-muted-foreground">Fecha de notificación</p>
                  <p className="font-medium">
                    {format(parseISO(analysis.fecha_notificacion), "d 'de' MMMM yyyy", {
                      locale: es,
                    })}
                  </p>
                </div>
              )}
              <div>
                <p className="text-xs text-muted-foreground">Plazo</p>
                <p className="font-medium">
                  {analysis.plazo_dias} días {analysis.tipo_dias} (Art. {analysis.articulo_cpcc}{' '}
                  CPCC)
                </p>
              </div>
              {analysis.fecha_vencimiento && (
                <div
                  className={
                    isUrgent
                      ? 'sm:col-span-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30'
                      : ''
                  }
                >
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    Fecha de vencimiento
                  </p>
                  <p
                    className={`font-semibold ${isUrgent ? 'text-amber-600 dark:text-amber-500' : ''}`}
                  >
                    {format(parseISO(analysis.fecha_vencimiento), "EEEE d 'de' MMMM yyyy", {
                      locale: es,
                    })}
                  </p>
                  {isUrgent && (
                    <p className="text-xs text-amber-600 dark:text-amber-500 mt-1">
                      Vence en los próximos 5 días hábiles
                    </p>
                  )}
                </div>
              )}
            </div>

            {analysis.partes && (
              <div>
                <p className="text-xs text-muted-foreground">Partes</p>
                <p className="text-sm">{analysis.partes}</p>
              </div>
            )}

            {analysis.observaciones && (
              <div className="p-3 rounded-lg bg-muted/50 text-sm">
                <p className="text-xs text-muted-foreground mb-1">Observaciones</p>
                <p>{analysis.observaciones}</p>
              </div>
            )}

            <div className="pt-4 space-y-2">
              <Button onClick={openCreateDialog} className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                Crear Vencimiento
              </Button>
              <p className="text-xs text-muted-foreground">
                Si la cédula incluye expediente o carátula, se sugerirá un caso relacionado al
                confirmar.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create Vencimiento Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Briefcase className="h-5 w-5" />
              Crear Vencimiento
            </DialogTitle>
            <DialogDescription>
              Seleccioná el caso al que asociar este vencimiento. Si la cédula incluye expediente o
              carátula, se sugiere un caso relacionado. El título y la fecha se completan automáticamente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {suggestedCase && matchReason && (
              <div className="flex items-start gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
                <Sparkles className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">Caso sugerido</p>
                  <p className="text-sm text-muted-foreground">
                    {suggestedCase.case_number} - {suggestedCase.title}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {matchReason}. Podés elegir otro caso si corresponde.
                  </p>
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label>Caso</Label>
              <Select
                value={selectedCaseId}
                onValueChange={setSelectedCaseId}
                disabled={isLoadingCases}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Elegí un caso..." />
                </SelectTrigger>
                <SelectContent>
                  {cases.length === 0 && !isLoadingCases && (
                    <SelectItem value="_none" disabled>
                      No hay casos disponibles
                    </SelectItem>
                  )}
                  {cases.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      <span className="flex items-center gap-2">
                        {c.case_number} - {c.title}
                        {suggestedCase?.id === c.id && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                            Sugerido
                          </Badge>
                        )}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {analysis && (
              <div className="text-sm text-muted-foreground space-y-1">
                <p>
                  <strong>Título:</strong>{' '}
                  {`Cédula: ${analysis.tipo_cedula}${analysis.numero_expediente ? ` - Exp. ${analysis.numero_expediente}` : ''}`}
                </p>
                {analysis.fecha_vencimiento && (
                  <p>
                    <strong>Vencimiento:</strong>{' '}
                    {format(parseISO(analysis.fecha_vencimiento), "dd/MM/yyyy", {
                      locale: es,
                    })}
                  </p>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleCreateVencimiento}
              disabled={!selectedCaseId || isCreating}
            >
              {isCreating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Creando...
                </>
              ) : (
                'Crear Vencimiento'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
