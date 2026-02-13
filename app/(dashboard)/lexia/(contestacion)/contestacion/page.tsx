'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { PenTool, Loader2, FileText } from 'lucide-react'
import { LexiaCaseContextBar } from '@/components/lexia/lexia-case-context-bar'
import { useLexiaCaseContext } from '@/lib/lexia/lexia-case-context'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import type { ContestacionSessionState, DemandBlock } from '@/lib/lexia/contestacion/types'

export default function ContestacionPage() {
  const searchParams = useSearchParams()
  const caseId = searchParams.get('caso')
  const layoutCaseContext = useLexiaCaseContext()

  const [demandaRaw, setDemandaRaw] = useState('')
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [state, setState] = useState<ContestacionSessionState | null>(null)
  const [currentStep, setCurrentStep] = useState<string>('init')
  const [isAnalyzing, setIsAnalyzing] = useState(false)

  const runOrchestrate = useCallback(async (sid: string) => {
    try {
      const res = await fetch('/api/lexia/contestacion/orchestrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: sid }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Error al orquestar')
      }
      const data = await res.json()
      setState(data.state ?? null)
      setCurrentStep(data.nextStep ?? 'init')
      return data
    } catch (err) {
      throw err
    }
  }, [])

  const handleAnalizar = async () => {
    const trimmed = demandaRaw.trim()
    if (!trimmed) {
      toast.error('Ingresá el texto de la demanda para analizar')
      return
    }

    setIsAnalyzing(true)
    try {
      const res = await fetch('/api/lexia/contestacion/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caseId: caseId || null,
          demandaRaw: trimmed,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Error al crear sesión')
      }

      const data = await res.json()
      setSessionId(data.sessionId)
      setState(data.state ?? null)
      setCurrentStep(data.current_step ?? 'init')

      if (data.current_step === 'init' && data.sessionId) {
        const orchestrateRes = await runOrchestrate(data.sessionId)
        if (orchestrateRes.action?.type === 'parse') {
          setState(orchestrateRes.state)
          setCurrentStep(orchestrateRes.nextStep ?? 'parsed')
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al analizar la demanda')
    } finally {
      setIsAnalyzing(false)
    }
  }

  const caseInfoForBar = layoutCaseContext ?? (caseId
    ? { id: caseId, caseNumber: '', title: '' }
    : null)

  const bloques = state?.bloques ?? []
  const showBloques = currentStep === 'parsed' && bloques.length > 0

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
              Pegá el texto de la demanda para analizarla y detectar sus bloques.
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <Card className="max-w-4xl mx-auto p-6">
          {!showBloques ? (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Texto de la demanda
                </label>
                <Textarea
                  value={demandaRaw}
                  onChange={(e) => setDemandaRaw(e.target.value)}
                  placeholder="Pegá aquí el texto completo de la demanda..."
                  className="min-h-[300px] font-mono text-sm"
                  disabled={isAnalyzing}
                />
              </div>
              <Button
                onClick={handleAnalizar}
                disabled={isAnalyzing || !demandaRaw.trim()}
              >
                {isAnalyzing ? (
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
              {currentStep === 'init' && sessionId && !isAnalyzing && (
                <p className="text-sm text-muted-foreground">
                  Ingresá el texto de la demanda y hacé clic en Analizar.
                </p>
              )}
            </div>
          ) : (
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
                      <span className="text-muted-foreground">
                        {bloque.orden}.
                      </span>
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
              <p className="text-xs text-muted-foreground">
                La base está lista para la Etapa 2 (análisis y preguntas por bloque).
              </p>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
