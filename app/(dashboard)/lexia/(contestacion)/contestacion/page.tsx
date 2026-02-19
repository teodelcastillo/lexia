'use client'

import { useCallback, useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { PenTool, Loader2, FileText, ArrowRight, Upload, File } from 'lucide-react'
import { LexiaCaseContextBar } from '@/components/lexia/lexia-case-context-bar'
import { useLexiaCaseContext } from '@/lib/lexia/lexia-case-context'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { ContestacionProgress } from '@/components/lexia/contestacion/contestacion-progress'
import { ContestacionBlockQuestions } from '@/components/lexia/contestacion/contestacion-block-questions'
import { ContestacionReadySummary } from '@/components/lexia/contestacion/contestacion-ready-summary'
import { ContestacionDraftView } from '@/components/lexia/contestacion/contestacion-draft-view'
import { ContestacionIterationChat } from '@/components/lexia/contestacion/contestacion-iteration-chat'
import type {
  ContestacionSessionState,
  DemandBlock,
  BlockResponse,
} from '@/lib/lexia/contestacion/types'

type DemandaSource = 'document' | 'upload' | 'paste'

interface CaseDocument {
  id: string
  name: string
  mime_type: string | null
  file_path: string | null
  file_size: number | null
}

export default function ContestacionPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const caseId = searchParams.get('caso')
  const layoutCaseContext = useLexiaCaseContext()

  const [demandaSource, setDemandaSource] = useState<DemandaSource>('paste')
  const [demandaRaw, setDemandaRaw] = useState('')
  const [demandaDocumentId, setDemandaDocumentId] = useState<string | null>(null)
  const [caseDocuments, setCaseDocuments] = useState<CaseDocument[]>([])
  const [isLoadingDocs, setIsLoadingDocs] = useState(false)
  const [isExtracting, setIsExtracting] = useState(false)
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [state, setState] = useState<ContestacionSessionState | null>(null)
  const [currentStep, setCurrentStep] = useState<string>('init')
  const [isLoading, setIsLoading] = useState(false)
  const [localResponses, setLocalResponses] = useState<Record<string, BlockResponse>>({})
  const [bloqueIdsPendientes, setBloqueIdsPendientes] = useState<string[]>([])
  const [agentMessage, setAgentMessage] = useState<string | null>(null)
  const [draftContent, setDraftContent] = useState('')
  const [isGeneratingDraft, setIsGeneratingDraft] = useState(false)
  const [showIteration, setShowIteration] = useState(false)
  const [isSavingDraft, setIsSavingDraft] = useState(false)

  useEffect(() => {
    if (!caseId || demandaSource !== 'document') return
    setIsLoadingDocs(true)
    fetch(`/api/lexia/contestacion/case-documents?caseId=${encodeURIComponent(caseId)}`)
      .then((res) => {
        if (!res.ok) throw new Error('Error al cargar documentos')
        return res.json()
      })
      .then((data) => setCaseDocuments(data.documents ?? []))
      .catch(() => toast.error('No se pudieron cargar los documentos del caso'))
      .then(() => setIsLoadingDocs(false), () => setIsLoadingDocs(false))
  }, [caseId, demandaSource])

  const sessionParam = searchParams.get('session')
  useEffect(() => {
    if (!sessionParam || sessionId) return
    fetch(`/api/lexia/contestacion/sessions/${sessionParam}`)
      .then((res) => {
        if (!res.ok) throw new Error('Sesión no encontrada')
        return res.json()
      })
      .then((data) => {
        const s = data.session
        if (!s?.id) return
        setSessionId(s.id)
        const st = (s.state ?? {}) as ContestacionSessionState
        setState(st)
        setCurrentStep(s.current_step ?? 'init')
        setDemandaRaw(s.demanda_raw ?? '')
        setLocalResponses((st.respuestas_usuario ?? {}) as Record<string, BlockResponse>)
        if (st.draft_content) setDraftContent(st.draft_content)
      })
      .catch(() => {
        toast.error('No se pudo cargar la sesión')
      })
  }, [sessionParam, sessionId])

  const runOrchestrate = useCallback(
    async (sid: string, userResponses?: Record<string, BlockResponse>) => {
      const res = await fetch('/api/lexia/contestacion/orchestrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: sid,
          userResponses: userResponses ?? undefined,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Error al orquestar')
      }
      return res.json()
    },
    []
  )

  const handleAnalizar = async () => {
    const trimmed = demandaRaw.trim()
    if (!trimmed) {
      toast.error('Ingresá el texto de la demanda para analizar')
      return
    }

    setIsLoading(true)
    try {
      const res = await fetch('/api/lexia/contestacion/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caseId: caseId || null,
          demandaRaw: trimmed,
          demandaDocumentId:
            demandaSource === 'document' && demandaDocumentId ? demandaDocumentId : undefined,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Error al crear sesión')
      }

      const data = await res.json()
      const sid = data.sessionId
      setSessionId(sid)
      setState(data.state ?? null)
      setCurrentStep(data.current_step ?? 'init')

      if (sid) {
        const url = new URL(window.location.href)
        url.searchParams.set('session', sid)
        if (caseId) url.searchParams.set('caso', caseId)
        router.replace(url.pathname + url.search)
      }

      if (data.current_step === 'init' && sid) {
        const orchestrateRes = await runOrchestrate(sid)
        setState(orchestrateRes.state ?? null)
        setCurrentStep(orchestrateRes.nextStep ?? 'parsed')
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al analizar la demanda')
    } finally {
      setIsLoading(false)
    }
  }

  const handleContinuarAnalisis = async () => {
    if (!sessionId) return
    setIsLoading(true)
    try {
      let data = await runOrchestrate(sessionId)
      setState(data.state ?? null)
      setCurrentStep(data.nextStep ?? 'analyzed')
      // Chain: if we got 'analyzed' but no preguntas yet, call again so agent runs generate_questions
      while (
        data.nextStep === 'analyzed' &&
        !(data.state?.preguntas_generadas?.length) &&
        data.state?.analisis_por_bloque
      ) {
        data = await runOrchestrate(sessionId)
        setState(data.state ?? null)
        setCurrentStep(data.nextStep ?? 'questions')
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al analizar')
    } finally {
      setIsLoading(false)
    }
  }

  const handleEnviarRespuestas = async () => {
    if (!sessionId) return
    const merged = { ...(state?.respuestas_usuario ?? {}), ...localResponses }
    if (Object.keys(merged).length === 0) {
      toast.error('Completá al menos una respuesta por bloque')
      return
    }
    setIsLoading(true)
    setBloqueIdsPendientes([])
    setAgentMessage(null)
    try {
      const data = await runOrchestrate(sessionId, merged)
      setState(data.state ?? null)
      setCurrentStep(data.nextStep ?? 'questions')
      setLocalResponses(data.state?.respuestas_usuario ?? {})
      const payload = data.action?.payload
      if (data.nextStep === 'need_more_info' && payload?.bloque_ids) {
        setBloqueIdsPendientes(payload.bloque_ids)
        setAgentMessage(payload.reason ?? 'Falta información en algunos bloques.')
      } else if (data.action?.type === 'wait_user' && payload?.reason) {
        setAgentMessage(payload.reason)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al enviar')
    } finally {
      setIsLoading(false)
    }
  }

  const handleResponseChange = (bloqueId: string, response: BlockResponse) => {
    setLocalResponses((prev) => ({ ...prev, [bloqueId]: response }))
  }

  const handleDocumentSelect = async (docId: string) => {
    if (!docId) {
      setDemandaRaw('')
      setDemandaDocumentId(null)
      return
    }
    setIsExtracting(true)
    setDemandaDocumentId(docId)
    try {
      const res = await fetch(`/api/lexia/contestacion/documents/${docId}/extract-text`)
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error ?? 'Error al extraer texto')
      }
      setDemandaRaw(data.text ?? '')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al extraer texto del documento')
      setDemandaDocumentId(null)
      setDemandaRaw('')
    } finally {
      setIsExtracting(false)
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setIsExtracting(true)
    setUploadedFileName(file.name)
    setDemandaDocumentId(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/lexia/contestacion/extract-text', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error ?? 'Error al extraer texto')
      }
      setDemandaRaw(data.text ?? '')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al extraer texto del archivo')
      setDemandaRaw('')
      setUploadedFileName(null)
    } finally {
      setIsExtracting(false)
    }
    e.target.value = ''
  }

  const handleGenerarBorrador = useCallback(
    async (iterationInstruction?: string) => {
      if (!sessionId) return
      setIsGeneratingDraft(true)
      setDraftContent('')
      try {
        const res = await fetch('/api/lexia/contestacion/generate-draft', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            iterationInstruction: iterationInstruction ?? undefined,
          }),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err.error ?? 'Error al generar borrador')
        }
        const reader = res.body?.getReader()
        const decoder = new TextDecoder()
        let content = ''
        if (reader) {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            content += decoder.decode(value, { stream: true })
            setDraftContent(content)
          }
        }
        setState((prev) =>
          prev ? { ...prev, draft_content: content, draft_generado_at: new Date().toISOString() } : prev
        )
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Error al generar borrador')
      } finally {
        setIsGeneratingDraft(false)
      }
    },
    [sessionId]
  )

  const handleSaveDraft = useCallback(async () => {
    if (!sessionId) return
    setIsSavingDraft(true)
    try {
      const res = await fetch('/api/lexia/contestacion/save-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? 'Error al guardar')
      }
      const { draftId, caseId: savedCaseId } = await res.json()
      router.push(
        `/lexia/redactor?borrador=${draftId}${savedCaseId ? `&caso=${savedCaseId}` : ''}`
      )
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al guardar borrador')
    } finally {
      setIsSavingDraft(false)
    }
  }, [sessionId, router])

  const handleIterate = useCallback(
    (instruction: string) => {
      setShowIteration(false)
      handleGenerarBorrador(instruction)
    },
    [handleGenerarBorrador]
  )

  const caseInfoForBar =
    layoutCaseContext ?? (caseId ? { id: caseId, caseNumber: '', title: '' } : null)

  const bloques = state?.bloques ?? []
  const preguntas = state?.preguntas_generadas ?? []
  const respuestas = { ...(state?.respuestas_usuario ?? {}), ...localResponses }
  const formDataConsolidado = state?.form_data_consolidado

  const showInput =
    currentStep === 'init' || (currentStep === 'parsed' && !bloques.length)
  const showBloquesOnly = currentStep === 'parsed' && bloques.length > 0
  const showQuestions =
    currentStep === 'questions' ||
    currentStep === 'need_more_info' ||
    (currentStep === 'analyzed' && preguntas.length > 0)
  const showReady = currentStep === 'ready_for_redaction' && formDataConsolidado
  const hasDraft = draftContent.length > 0 || isGeneratingDraft

  return (
    <div className="flex flex-col h-full">
      <div className="flex-shrink-0 border-b border-border px-4 py-3 bg-muted/30">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 flex items-center justify-center rounded-lg bg-primary/10">
            <PenTool className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-semibold mb-2">Contestación guiada</h1>
            <LexiaCaseContextBar
              caseContext={caseInfoForBar}
              basePath="/lexia/contestacion"
              editable={true}
              emptyLabel="Sin caso asociado"
              withCaseLabel="Contestación para"
            />
            <p className="text-xs text-muted-foreground mt-1.5">
              Elegí un documento del caso, subí un archivo PDF o Word, o pegá el texto de la demanda para analizarla.
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <Card className="max-w-4xl mx-auto p-6">
          {(showBloquesOnly || showQuestions || showReady) && (
            <ContestacionProgress
              currentStep={currentStep}
              className="mb-6"
            />
          )}

          {showInput && (
            <div className="space-y-4">
              <Tabs
                value={demandaSource}
                onValueChange={(v) => {
                  setDemandaSource(v as DemandaSource)
                  if (v !== 'document') setDemandaDocumentId(null)
                  if (v !== 'upload') setUploadedFileName(null)
                }}
              >
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="document" disabled={!caseId}>
                    <File className="h-4 w-4 mr-2" />
                    Documento del caso
                  </TabsTrigger>
                  <TabsTrigger value="upload">
                    <Upload className="h-4 w-4 mr-2" />
                    Subir archivo
                  </TabsTrigger>
                  <TabsTrigger value="paste">
                    <FileText className="h-4 w-4 mr-2" />
                    Pegar texto
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="document" className="space-y-4 pt-4">
                  {!caseId ? (
                    <p className="text-sm text-muted-foreground">
                      Seleccioná un caso arriba para ver documentos del caso.
                    </p>
                  ) : (
                    <>
                      <div>
                        <label className="text-sm font-medium mb-2 block">
                          Seleccionar documento
                        </label>
                        <Select
                          value={demandaDocumentId ?? ''}
                          onValueChange={handleDocumentSelect}
                          disabled={isLoadingDocs || isExtracting}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Elegí un documento PDF o Word..." />
                          </SelectTrigger>
                          <SelectContent>
                            {caseDocuments.length === 0 && !isLoadingDocs && (
                              <SelectItem value="_none" disabled>
                                No hay documentos PDF o Word en este caso
                              </SelectItem>
                            )}
                            {caseDocuments.map((doc) => (
                              <SelectItem key={doc.id} value={doc.id}>
                                {doc.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {isExtracting && (
                          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            Extrayendo texto...
                          </p>
                        )}
                      </div>
                      {demandaRaw && (
                        <div>
                          <label className="text-sm font-medium mb-2 block">
                            Texto extraído (podés revisar o editar)
                          </label>
                          <Textarea
                            value={demandaRaw}
                            onChange={(e) => setDemandaRaw(e.target.value)}
                            className="min-h-[200px] font-mono text-sm"
                            disabled={isLoading}
                          />
                        </div>
                      )}
                    </>
                  )}
                </TabsContent>
                <TabsContent value="upload" className="space-y-4 pt-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      Subir archivo PDF o Word
                    </label>
                    <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
                      <input
                        type="file"
                        accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                        onChange={handleFileUpload}
                        className="hidden"
                        id="demanda-file-upload"
                      />
                      <label
                        htmlFor="demanda-file-upload"
                        className="cursor-pointer flex flex-col items-center gap-2 text-muted-foreground hover:text-foreground"
                      >
                        {isExtracting ? (
                          <>
                            <Loader2 className="h-8 w-8 animate-spin" />
                            <span>Extrayendo texto...</span>
                          </>
                        ) : (
                          <>
                            <Upload className="h-8 w-8" />
                            <span>
                              {uploadedFileName
                                ? `Archivo: ${uploadedFileName} (${demandaRaw.length} caracteres)`
                                : 'Hacé clic o arrastrá un archivo PDF o Word'}
                            </span>
                          </>
                        )}
                      </label>
                    </div>
                  </div>
                  {demandaRaw && (
                    <div>
                      <label className="text-sm font-medium mb-2 block">
                        Texto extraído (podés revisar o editar)
                      </label>
                      <Textarea
                        value={demandaRaw}
                        onChange={(e) => setDemandaRaw(e.target.value)}
                        className="min-h-[200px] font-mono text-sm"
                        disabled={isLoading}
                      />
                    </div>
                  )}
                </TabsContent>
                <TabsContent value="paste" className="space-y-4 pt-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      Texto de la demanda
                    </label>
                    <Textarea
                      value={demandaRaw}
                      onChange={(e) => setDemandaRaw(e.target.value)}
                      placeholder="Pegá aquí el texto completo de la demanda..."
                      className="min-h-[300px] font-mono text-sm"
                      disabled={isLoading}
                    />
                  </div>
                </TabsContent>
              </Tabs>
              <Button
                onClick={handleAnalizar}
                disabled={isLoading || !demandaRaw.trim()}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Analizando demanda...
                  </>
                ) : (
                  <>
                    <FileText className="h-4 w-4 mr-2" />
                    Analizar demanda
                  </>
                )}
              </Button>
            </div>
          )}

          {showBloquesOnly && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Bloques detectados</h2>
                {state?.tipo_demanda_detectado && (
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                    Tipo: {state.tipo_demanda_detectado}
                  </span>
                )}
              </div>
              <div className="space-y-4">
                {bloques.map((bloque: DemandBlock) => (
                  <div
                    key={bloque.id}
                    className="border border-border rounded-lg p-4 bg-background"
                  >
                    <h3 className="font-medium text-sm mb-2 flex items-center gap-2">
                      <span className="text-muted-foreground">{bloque.orden}.</span>
                      {bloque.titulo}
                      {bloque.tipo && (
                        <span className="text-xs text-muted-foreground font-normal">
                          ({bloque.tipo})
                        </span>
                      )}
                    </h3>
                    <p className="text-sm text-muted-foreground line-clamp-4">
                      {bloque.contenido}
                    </p>
                  </div>
                ))}
              </div>
              <Button onClick={handleContinuarAnalisis} disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Analizando bloques...
                  </>
                ) : (
                  <>
                    Continuar a análisis
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </>
                )}
              </Button>
            </div>
          )}

          {currentStep === 'analyzed' && !preguntas.length && isLoading && (
            <div className="py-12 text-center text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
              <p>Generando preguntas por bloque...</p>
            </div>
          )}

          {showQuestions && preguntas.length > 0 && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold">Respondé por cada bloque</h2>
              {(currentStep === 'need_more_info' && bloqueIdsPendientes.length > 0) && (
                <p className="text-sm text-amber-600 dark:text-amber-500">
                  {agentMessage ?? 'Falta información en algunos bloques. Completá los que faltan.'}
                </p>
              )}
              {agentMessage && currentStep !== 'need_more_info' && (
                <p className="text-sm text-muted-foreground">{agentMessage}</p>
              )}
              <div className="space-y-4">
                {bloques.map((bloque) => (
                  <ContestacionBlockQuestions
                    key={bloque.id}
                    bloque={bloque}
                    preguntas={preguntas}
                    response={respuestas[bloque.id]}
                    onChange={(r) => handleResponseChange(bloque.id, r)}
                    isPending={isLoading}
                    bloqueIdsPendientes={bloqueIdsPendientes}
                  />
                ))}
              </div>
              <Button onClick={handleEnviarRespuestas} disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Enviando...
                  </>
                ) : (
                  'Enviar respuestas'
                )}
              </Button>
            </div>
          )}

          {showReady && formDataConsolidado && !hasDraft && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold">Listo para redacción</h2>
              <ContestacionReadySummary formData={formDataConsolidado} />
              <div className="flex items-center gap-3">
                <Button
                  onClick={() => handleGenerarBorrador()}
                  disabled={isGeneratingDraft}
                >
                  {isGeneratingDraft ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Generando borrador...
                    </>
                  ) : (
                    <>
                      Generar borrador
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </>
                  )}
                </Button>
                <span className="text-sm text-muted-foreground">
                  Se generará el borrador con IA. Luego podés guardarlo o modificarlo.
                </span>
              </div>
            </div>
          )}

          {showReady && hasDraft && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold">Borrador de contestación</h2>
              <ContestacionDraftView
                content={draftContent}
                isStreaming={isGeneratingDraft}
                isSaving={isSavingDraft}
                onSaveClick={handleSaveDraft}
              />
              {!isGeneratingDraft && draftContent && (
                <div className="space-y-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowIteration((s) => !s)}
                  >
                    {showIteration ? 'Ocultar modificación' : 'Modificar borrador'}
                  </Button>
                  {showIteration && (
                    <ContestacionIterationChat
                      onSend={handleIterate}
                      isGenerating={isGeneratingDraft}
                    />
                  )}
                </div>
              )}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
