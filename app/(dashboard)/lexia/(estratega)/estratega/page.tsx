'use client'

import { useState, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  Target, Loader2, RefreshCw, ShieldAlert, BookOpen, GitBranch, Clock, Lightbulb,
  ArrowRight, CheckCircle2, AlertTriangle,
} from 'lucide-react'
import { toast } from 'sonner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { LexiaCaseContextBar } from '@/components/lexia/lexia-case-context-bar'
import { useLexiaCaseContext } from '@/lib/lexia/lexia-case-context'
import { RiskMatrixDisplay } from '@/components/lexia/estratega/risk-matrix-display'
import { ScenariosDisplay } from '@/components/lexia/estratega/scenarios-display'
import { TimelineDisplay } from '@/components/lexia/estratega/timeline-display'
import { JurisprudenceDisplay } from '@/components/lexia/estratega/jurisprudence-display'
import type { StrategicAnalysis } from '@/lib/lexia/estratega/types'

const RISK_LEVEL_BADGE: Record<string, string> = {
  low:      'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400',
  medium:   'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400',
  high:     'bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400',
  critical: 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400',
}

const RISK_LEVEL_LABEL: Record<string, string> = {
  low: 'Bajo', medium: 'Medio', high: 'Alto', critical: 'Crítico',
}

const STRATEGY_LABEL: Record<string, string> = {
  conservative: 'Conservador', moderate: 'Moderado', aggressive: 'Agresivo',
}

export default function EstrategaPage() {
  const searchParams = useSearchParams()
  const caseId = searchParams.get('caso')
  const layoutCaseContext = useLexiaCaseContext()

  const [analysis, setAnalysis] = useState<StrategicAnalysis | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)

  const caseInfoForBar =
    layoutCaseContext ?? (caseId ? { id: caseId, caseNumber: '', title: '' } : null)

  const runAnalysis = useCallback(async () => {
    if (!caseId) {
      toast.error('Seleccioná un caso para analizar')
      return
    }
    setIsAnalyzing(true)
    try {
      const res = await fetch('/api/lexia/estratega/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caseId }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Error al ejecutar el análisis')
      }
      setAnalysis(data.analysis)
      toast.success('Análisis estratégico completado')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al analizar')
    } finally {
      setIsAnalyzing(false)
    }
  }, [caseId])

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-border px-4 py-3 bg-muted/30">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 flex items-center justify-center rounded-lg bg-primary/10">
            <Target className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-semibold mb-2">Lexia Estratega</h1>
            <LexiaCaseContextBar
              caseContext={caseInfoForBar}
              basePath="/lexia/estratega"
              editable={true}
              emptyLabel="Sin caso asociado"
              withCaseLabel="Análisis estratégico de"
            />
            <p className="text-xs text-muted-foreground mt-1.5">
              Análisis predictivo de riesgos, jurisprudencia, escenarios y timeline para tu caso.
            </p>
          </div>
          {analysis && (
            <Button
              variant="outline"
              size="sm"
              onClick={runAnalysis}
              disabled={isAnalyzing || !caseId}
              className="flex-shrink-0"
            >
              {isAnalyzing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              <span className="ml-2 hidden sm:inline">Actualizar</span>
            </Button>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-auto p-6">
        {/* No case selected */}
        {!caseId && (
          <div className="max-w-lg mx-auto text-center py-16">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Target className="h-8 w-8 text-primary/60" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Seleccioná un caso</h2>
            <p className="text-muted-foreground text-sm">
              Elegí un caso desde el selector superior para ejecutar el análisis estratégico.
            </p>
          </div>
        )}

        {/* Case selected but no analysis yet */}
        {caseId && !analysis && !isAnalyzing && (
          <div className="max-w-lg mx-auto text-center py-16">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Target className="h-8 w-8 text-primary/60" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Listo para analizar</h2>
            <p className="text-muted-foreground text-sm mb-6">
              El análisis incluye matriz de riesgos, jurisprudencia relevante, 3 escenarios estratégicos
              y un timeline detallado. Demora aproximadamente 1-2 minutos.
            </p>
            <Button onClick={runAnalysis} size="lg" className="gap-2">
              <Target className="h-4 w-4" />
              Ejecutar análisis estratégico
            </Button>
          </div>
        )}

        {/* Loading */}
        {isAnalyzing && (
          <div className="max-w-lg mx-auto text-center py-16">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4 animate-pulse">
              <Loader2 className="h-8 w-8 text-primary animate-spin" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Analizando caso...</h2>
            <p className="text-muted-foreground text-sm">
              Identificando riesgos, buscando jurisprudencia, generando escenarios y timeline.
              Esto puede tomar 1-2 minutos.
            </p>
            <div className="mt-6 space-y-2 text-left max-w-sm mx-auto">
              {[
                'Analizando factores de riesgo...',
                'Buscando jurisprudencia relevante...',
                'Generando escenarios estratégicos...',
                'Construyendo timeline...',
              ].map((step, i) => (
                <div key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  {step}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Analysis results */}
        {analysis && !isAnalyzing && (
          <div className="max-w-5xl mx-auto space-y-6">
            {/* Summary bar */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">Riesgo general</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-2xl font-bold">{analysis.riskMatrix.overallScore.toFixed(1)}</span>
                    <span className="text-muted-foreground text-sm">/10</span>
                    <Badge className={`text-xs ${RISK_LEVEL_BADGE[analysis.riskMatrix.riskLevel]}`}>
                      {RISK_LEVEL_LABEL[analysis.riskMatrix.riskLevel]}
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">Estrategia recomendada</p>
                  <p className="text-lg font-bold mt-1">
                    {STRATEGY_LABEL[analysis.recommendations.primaryStrategy]}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">Duración estimada</p>
                  <p className="text-lg font-bold mt-1">
                    {analysis.timeline.totalEstimatedMonths} meses
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">Jurisprudencia</p>
                  <p className="text-lg font-bold mt-1">
                    {analysis.jurisprudence.length} fallos
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Recommendations summary */}
            <Card className="border-primary/20 bg-primary/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Lightbulb className="h-4 w-4 text-primary" />
                  Recomendación estratégica
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm">{analysis.recommendations.reasoning}</p>
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                    Próximos pasos
                  </p>
                  <ul className="space-y-1.5">
                    {analysis.recommendations.nextSteps.map((step, i) => (
                      <li key={i} className="flex gap-2 text-sm">
                        <ArrowRight className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                        <span>{step}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </CardContent>
            </Card>

            {/* Tabs */}
            <Tabs defaultValue="risks">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="risks" className="flex items-center gap-1.5 text-xs">
                  <ShieldAlert className="h-3.5 w-3.5" />
                  Riesgos
                </TabsTrigger>
                <TabsTrigger value="jurisprudence" className="flex items-center gap-1.5 text-xs">
                  <BookOpen className="h-3.5 w-3.5" />
                  Jurisprudencia
                </TabsTrigger>
                <TabsTrigger value="scenarios" className="flex items-center gap-1.5 text-xs">
                  <GitBranch className="h-3.5 w-3.5" />
                  Escenarios
                </TabsTrigger>
                <TabsTrigger value="timeline" className="flex items-center gap-1.5 text-xs">
                  <Clock className="h-3.5 w-3.5" />
                  Timeline
                </TabsTrigger>
              </TabsList>

              <TabsContent value="risks" className="mt-4">
                <RiskMatrixDisplay riskMatrix={analysis.riskMatrix} />
              </TabsContent>

              <TabsContent value="jurisprudence" className="mt-4">
                <JurisprudenceDisplay jurisprudence={analysis.jurisprudence} />
              </TabsContent>

              <TabsContent value="scenarios" className="mt-4">
                <ScenariosDisplay
                  scenarios={analysis.scenarios}
                  recommendedType={analysis.recommendations.primaryStrategy}
                />
              </TabsContent>

              <TabsContent value="timeline" className="mt-4">
                <TimelineDisplay timeline={analysis.timeline} />
              </TabsContent>
            </Tabs>

            {/* Footer metadata */}
            <div className="flex items-center gap-4 text-xs text-muted-foreground border-t pt-3">
              <div className="flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" />
                Analizado: {new Date(analysis.analyzedAt).toLocaleString('es-AR')}
              </div>
              <div className="flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                Tokens usados: {analysis.metadata.tokensUsed.toLocaleString()}
              </div>
              <span>v{analysis.metadata.analysisVersion}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
