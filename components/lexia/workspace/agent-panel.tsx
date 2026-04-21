'use client'

/**
 * Agent Mode panel.
 *
 * Two-phase UX:
 *   1. PLAN  — the lawyer writes an objective and Lexia streams a plan.
 *              Each step is a checkbox; the lawyer can uncheck steps to
 *              skip them before running.
 *   2. EXEC  — when the lawyer confirms, each checked step is executed in
 *              sequence and applied to the editor via applyAgentStep.
 *
 * Live log shows status per step: pending | running | applied | error.
 * Nothing happens silently: the lawyer sees the reasoning/content of every
 * step and can cancel mid-run.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Bot,
  Sparkles,
  Loader2,
  Send,
  Check,
  X,
  AlertTriangle,
  Play,
  Square,
  RefreshCw,
  BookOpen,
} from 'lucide-react'

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import {
  parsePartialJson,
  type AgentPlan,
  type AgentStep,
  type AgentStepResult,
} from '@/lib/lexia/workspace'
import { CitationChips } from './citation-chips'

type StepStatus = 'queued' | 'skipped' | 'running' | 'applied' | 'error'

interface StepLogEntry {
  stepId: string
  status: StepStatus
  result?: AgentStepResult
  applyMessage?: string
  error?: string
}

interface AgentPanelProps {
  open: boolean
  onClose: () => void
  documentId: string
  /** Active context (documentIds/personIds) chosen in the sidebar. */
  context: { documentIds: string[]; personIds: string[] }
  /** Apply a completed step to the editor. Must return an info message. */
  onApplyStep: (step: AgentStepResult, planStep: AgentStep) => { ok: boolean; message?: string }
  /** Optional: trigger the stress-test panel at the end of the run. */
  onRequestStressTest?: () => void
}

export function AgentPanel(props: AgentPanelProps) {
  const { open, onClose, documentId, context, onApplyStep, onRequestStressTest } = props

  const [phase, setPhase] = useState<'idle' | 'planning' | 'plan-ready' | 'executing' | 'done'>(
    'idle'
  )
  const [objective, setObjective] = useState('')
  const [plan, setPlan] = useState<AgentPlan | null>(null)
  const [skippedSteps, setSkippedSteps] = useState<Set<string>>(new Set())
  const [log, setLog] = useState<StepLogEntry[]>([])
  const [error, setError] = useState<string | null>(null)

  const abortRef = useRef<AbortController | null>(null)
  const cancelRunRef = useRef<boolean>(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 60)
    } else {
      abortRef.current?.abort()
      cancelRunRef.current = true
    }
  }, [open])

  const reset = useCallback(() => {
    setPhase('idle')
    setPlan(null)
    setSkippedSteps(new Set())
    setLog([])
    setError(null)
  }, [])

  // ---------------------------------------------------------------------------
  // Plan generation
  // ---------------------------------------------------------------------------
  const requestPlan = useCallback(async () => {
    if (!objective.trim()) return
    setError(null)
    setPlan(null)
    setLog([])
    setSkippedSteps(new Set())
    setPhase('planning')

    const controller = new AbortController()
    abortRef.current?.abort()
    abortRef.current = controller

    try {
      const res = await fetch(`/api/lexia/documents/${documentId}/agent/plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ objective: objective.trim(), context }),
        signal: controller.signal,
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Error del servidor' }))
        throw new Error((err as { error?: string }).error || `HTTP ${res.status}`)
      }
      const reader = res.body?.getReader()
      if (!reader) throw new Error('Respuesta sin cuerpo')
      const decoder = new TextDecoder()
      let buffer = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const partial = parsePartialJson<AgentPlan>(buffer)
        if (partial) setPlan({ ...(partial as AgentPlan) })
      }
      buffer += decoder.decode()
      const finalPlan = parsePartialJson<AgentPlan>(buffer)
      if (finalPlan) setPlan(finalPlan as AgentPlan)
      setPhase('plan-ready')
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      setError((err as Error).message || 'Error al generar el plan')
      setPhase('idle')
    }
  }, [objective, documentId, context])

  // ---------------------------------------------------------------------------
  // Plan execution
  // ---------------------------------------------------------------------------
  async function executePlan() {
    if (!plan) return
    setPhase('executing')
    cancelRunRef.current = false
    const planRunId = crypto.randomUUID()

    const initialLog: StepLogEntry[] = plan.steps.map((s) => ({
      stepId: s.id,
      status: skippedSteps.has(s.id) ? 'skipped' : 'queued',
    }))
    setLog(initialLog)

    const previousResults: Array<{
      stepId: string
      kind: AgentStepResult['kind']
      heading?: string
      content: string
    }> = []

    for (let i = 0; i < plan.steps.length; i++) {
      if (cancelRunRef.current) break
      const step = plan.steps[i]
      if (skippedSteps.has(step.id)) continue

      setLog((prev) =>
        prev.map((e) => (e.stepId === step.id ? { ...e, status: 'running' as StepStatus } : e))
      )

      try {
        const controller = new AbortController()
        abortRef.current?.abort()
        abortRef.current = controller

        const res = await fetch(`/api/lexia/documents/${documentId}/agent/execute`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            plan,
            stepIndex: i,
            previousResults,
            context,
            planRunId,
          }),
          signal: controller.signal,
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: 'Error del servidor' }))
          throw new Error((err as { error?: string }).error || `HTTP ${res.status}`)
        }
        const reader = res.body?.getReader()
        if (!reader) throw new Error('Respuesta sin cuerpo')
        const decoder = new TextDecoder()
        let buffer = ''
        let latest: AgentStepResult | null = null
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const partial = parsePartialJson<AgentStepResult>(buffer)
          if (partial) {
            latest = partial as AgentStepResult
            // Stream preview: update the log with the partial result.
            setLog((prev) =>
              prev.map((e) =>
                e.stepId === step.id ? { ...e, result: { ...(partial as AgentStepResult) } } : e
              )
            )
          }
        }
        buffer += decoder.decode()
        const finalRes = parsePartialJson<AgentStepResult>(buffer)
        if (finalRes) latest = finalRes as AgentStepResult

        if (!latest || !latest.content) {
          throw new Error('El agente no devolvió contenido para este paso.')
        }

        // Apply to the editor.
        const outcome = onApplyStep(latest, step)
        if (!outcome.ok) {
          throw new Error(outcome.message ?? 'No se pudo aplicar el paso')
        }

        previousResults.push({
          stepId: step.id,
          kind: latest.kind,
          heading: latest.heading,
          content: latest.content,
        })

        setLog((prev) =>
          prev.map((e) =>
            e.stepId === step.id
              ? {
                  ...e,
                  status: 'applied' as StepStatus,
                  result: latest!,
                  applyMessage: outcome.message,
                }
              : e
          )
        )
      } catch (err) {
        if ((err as Error).name === 'AbortError') {
          cancelRunRef.current = true
          break
        }
        setLog((prev) =>
          prev.map((e) =>
            e.stepId === step.id
              ? { ...e, status: 'error' as StepStatus, error: (err as Error).message }
              : e
          )
        )
        // Stop on first error; the lawyer can retry.
        cancelRunRef.current = true
        break
      }
    }

    setPhase('done')
  }

  function cancelRun() {
    cancelRunRef.current = true
    abortRef.current?.abort()
  }

  // ---------------------------------------------------------------------------
  // UI
  // ---------------------------------------------------------------------------
  return (
    <Sheet open={open} onOpenChange={(o) => (o ? undefined : onClose())}>
      <SheetContent side="right" className="w-[min(640px,94vw)] sm:max-w-[640px] flex flex-col p-0">
        <SheetHeader className="px-5 pt-5 pb-3 border-b border-border">
          <SheetTitle className="flex items-center gap-2 text-base">
            <Bot className="h-4 w-4 text-primary" />
            Modo Agente
          </SheetTitle>
          <SheetDescription className="text-xs">
            Describí el objetivo en una frase. Lexia arma un plan, lo revisás y lo ejecuta paso a
            paso sobre el documento.
          </SheetDescription>
        </SheetHeader>

        {/* Objective input (hidden while executing to reduce noise) */}
        {phase !== 'executing' && (
          <div className="px-5 py-3 border-b border-border">
            <Textarea
              ref={inputRef}
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                  e.preventDefault()
                  void requestPlan()
                }
              }}
              placeholder='Ej: "Redactá la demanda completa basándote en el contrato y la pericia. Reclamá daños moral y punitivo."'
              className="min-h-[72px] resize-none text-sm"
              disabled={phase === 'planning'}
            />
            <div className="flex items-center justify-between mt-2">
              <span className="text-[11px] text-muted-foreground">
                ⌘ + Enter para armar el plan
              </span>
              <div className="flex items-center gap-1">
                {phase === 'plan-ready' && (
                  <Button size="sm" variant="ghost" onClick={reset}>
                    <RefreshCw className="h-3 w-3 mr-1" /> Reiniciar
                  </Button>
                )}
                <Button
                  size="sm"
                  onClick={requestPlan}
                  disabled={phase === 'planning' || !objective.trim()}
                >
                  {phase === 'planning' ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4 mr-1" />
                  )}
                  {plan ? 'Regenerar plan' : 'Armar plan'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-auto px-5 py-4 space-y-4">
          {error && (
            <div className="text-sm rounded-md border border-red-300 bg-red-50 dark:bg-red-950/30 text-red-800 dark:text-red-300 px-3 py-2">
              {error}
            </div>
          )}

          {phase === 'idle' && !plan && !error && (
            <div className="text-center text-muted-foreground text-sm py-10">
              <Sparkles className="h-6 w-6 mx-auto mb-2 opacity-40" />
              Escribí el objetivo y presioná <span className="font-medium">Armar plan</span>.
            </div>
          )}

          {plan && (
            <>
              <section>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
                  Qué voy a hacer
                </div>
                <p className="text-sm leading-relaxed">{plan.summary}</p>
              </section>

              {plan.risks && plan.risks.length > 0 && (
                <section className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 px-3 py-2">
                  <div className="text-[10px] uppercase tracking-wide text-amber-800 dark:text-amber-400 mb-1 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" /> Supuestos y riesgos a confirmar
                  </div>
                  <ul className="text-xs list-disc pl-4 space-y-0.5 text-amber-900 dark:text-amber-200">
                    {plan.risks.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </section>
              )}

              <section>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-2 flex items-center justify-between">
                  <span>
                    Pasos ({plan.steps.length - skippedSteps.size} activos de {plan.steps.length})
                  </span>
                </div>
                <ul className="space-y-2">
                  {plan.steps.map((step, idx) => {
                    const entry = log.find((l) => l.stepId === step.id)
                    const skipped = skippedSteps.has(step.id)
                    return (
                      <li
                        key={step.id}
                        className={`rounded-md border px-3 py-2 ${
                          entry?.status === 'applied'
                            ? 'border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-800/60'
                            : entry?.status === 'error'
                              ? 'border-red-300 bg-red-50 dark:bg-red-950/30 dark:border-red-800/60'
                              : entry?.status === 'running'
                                ? 'border-primary/40 bg-primary/5'
                                : skipped
                                  ? 'border-dashed border-border bg-muted/20 opacity-60'
                                  : 'border-border'
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          {phase === 'plan-ready' ? (
                            <Checkbox
                              checked={!skipped}
                              onCheckedChange={(v) => {
                                setSkippedSteps((prev) => {
                                  const next = new Set(prev)
                                  if (v) next.delete(step.id)
                                  else next.add(step.id)
                                  return next
                                })
                              }}
                              className="mt-0.5"
                            />
                          ) : (
                            <StepStatusIcon status={entry?.status ?? 'queued'} />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-medium">
                                {idx + 1}. {step.title}
                              </span>
                              <Badge variant="outline" className="text-[10px]">
                                {step.kind === 'draft_section'
                                  ? 'nueva sección'
                                  : step.kind === 'replace_section'
                                    ? 'reemplazar'
                                    : step.kind === 'insert_after_heading'
                                      ? 'insertar'
                                      : 'reescribir todo'}
                              </Badge>
                              {step.targetHeading && (
                                <span className="text-[10px] text-muted-foreground truncate">
                                  → {step.targetHeading}
                                </span>
                              )}
                            </div>
                            <p className="text-[12px] text-muted-foreground leading-snug mt-0.5">
                              {step.description}
                            </p>

                            {entry?.result?.reasoning && (
                              <p className="text-[11px] italic text-muted-foreground mt-1.5 leading-snug">
                                “{entry.result.reasoning}”
                              </p>
                            )}

                            {entry?.result?.citations && entry.result.citations.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                <CitationChips
                                  citations={entry.result.citations.filter(
                                    (c): c is NonNullable<typeof c> =>
                                      !!c && typeof c.label === 'string' && c.label.length > 0
                                  )}
                                />
                              </div>
                            )}

                            {entry?.result?.caveats && entry.result.caveats.length > 0 && (
                              <div className="mt-1.5 rounded bg-amber-50 dark:bg-amber-950/30 px-2 py-1 text-[11px] text-amber-900 dark:text-amber-200">
                                <div className="flex items-center gap-1 mb-0.5">
                                  <AlertTriangle className="h-3 w-3" />
                                  Atención
                                </div>
                                <ul className="list-disc pl-4 space-y-0.5">
                                  {entry.result.caveats.map((c, i) => (
                                    <li key={i}>{c}</li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {entry?.applyMessage && (
                              <p className="text-[11px] text-muted-foreground mt-1">
                                {entry.applyMessage}
                              </p>
                            )}
                            {entry?.error && (
                              <p className="text-[11px] text-red-700 dark:text-red-300 mt-1">
                                {entry.error}
                              </p>
                            )}
                          </div>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </section>
            </>
          )}
        </div>

        {/* Footer */}
        {plan && (
          <div className="border-t border-border p-3 flex items-center justify-between gap-2 bg-muted/20">
            <span className="text-[11px] text-muted-foreground">
              {phase === 'executing'
                ? 'Ejecutando… los cambios se aplican en vivo al documento.'
                : phase === 'done'
                  ? 'Ejecución finalizada. Revisá el documento.'
                  : 'Revisá el plan y marcá los pasos que querés ejecutar.'}
            </span>
            <div className="flex items-center gap-1">
              {phase === 'executing' ? (
                <Button size="sm" variant="destructive" onClick={cancelRun}>
                  <Square className="h-4 w-4 mr-1" />
                  Detener
                </Button>
              ) : phase === 'plan-ready' ? (
                <Button
                  size="sm"
                  onClick={executePlan}
                  disabled={plan.steps.length - skippedSteps.size === 0}
                >
                  <Play className="h-4 w-4 mr-1" />
                  Ejecutar {plan.steps.length - skippedSteps.size} paso(s)
                </Button>
              ) : phase === 'done' ? (
                <>
                  {onRequestStressTest && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        onRequestStressTest()
                        onClose()
                      }}
                    >
                      <AlertTriangle className="h-4 w-4 mr-1" />
                      Correr stress-test
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={reset}>
                    <RefreshCw className="h-4 w-4 mr-1" />
                    Nuevo plan
                  </Button>
                </>
              ) : null}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

function StepStatusIcon({ status }: { status: StepStatus }) {
  if (status === 'running')
    return <Loader2 className="h-3.5 w-3.5 text-primary animate-spin mt-0.5 flex-shrink-0" />
  if (status === 'applied')
    return <Check className="h-3.5 w-3.5 text-emerald-600 mt-0.5 flex-shrink-0" />
  if (status === 'error')
    return <X className="h-3.5 w-3.5 text-red-600 mt-0.5 flex-shrink-0" />
  if (status === 'skipped')
    return <span className="text-[10px] text-muted-foreground mt-1">skip</span>
  return <BookOpen className="h-3.5 w-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
}
