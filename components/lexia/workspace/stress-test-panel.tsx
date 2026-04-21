'use client'

/**
 * Stress-test panel.
 *
 * Corre /stress-test sobre el documento completo y muestra un informe:
 *   - veredicto global (strong | acceptable | weak)
 *   - findings ordenados por severidad
 *   - por cada finding: ataques, defensas, rewrite sugerido
 *   - acciones: ir al párrafo / aplicar reescritura
 */

import { useCallback, useEffect, useState } from 'react'
import {
  ShieldAlert,
  Loader2,
  AlertTriangle,
  ChevronRight,
  Check,
  Wand2,
  Crosshair,
  RefreshCw,
} from 'lucide-react'

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { StressReport, StressFinding } from '@/lib/lexia/workspace'

interface StressTestPanelProps {
  open: boolean
  onClose: () => void
  documentId: string
  clientRole: string | null
  context: { documentIds: string[]; personIds: string[] }
  onNavigateToPassage: (passage: string) => void
  onApplyRewrite: (passage: string, rewrite: string) => void
}

export function StressTestPanel(props: StressTestPanelProps) {
  const { open, onClose, documentId, context, onNavigateToPassage, onApplyRewrite } = props
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [report, setReport] = useState<StressReport | null>(null)

  const run = useCallback(async () => {
    setLoading(true)
    setError(null)
    setReport(null)
    try {
      const res = await fetch(`/api/lexia/documents/${documentId}/stress-test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Error del servidor' }))
        throw new Error((err as { error?: string }).error || `HTTP ${res.status}`)
      }
      const data = (await res.json()) as { report: StressReport }
      setReport(data.report)
    } catch (err) {
      setError((err as Error).message || 'Error al correr el stress-test')
    } finally {
      setLoading(false)
    }
  }, [documentId, context])

  // Auto-run on open (first time only)
  useEffect(() => {
    if (open && !report && !loading && !error) {
      void run()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  return (
    <Sheet open={open} onOpenChange={(o) => (o ? undefined : onClose())}>
      <SheetContent side="right" className="w-[min(680px,94vw)] sm:max-w-[680px] flex flex-col p-0">
        <SheetHeader className="px-5 pt-5 pb-3 border-b border-border">
          <SheetTitle className="flex items-center gap-2 text-base">
            <ShieldAlert className="h-4 w-4 text-amber-600" />
            Stress-test del borrador
          </SheetTitle>
          <SheetDescription className="text-xs">
            Simulación desde la vereda contraria: qué atacaría la otra parte y cómo cerrarías los
            huecos antes de presentar.
          </SheetDescription>
        </SheetHeader>

        <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-muted/20">
          {report ? <OverallBadge overall={report.overall} /> : <span className="text-xs text-muted-foreground">—</span>}
          <Button size="sm" variant="outline" onClick={run} disabled={loading}>
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5 mr-1" />
            )}
            Volver a correr
          </Button>
        </div>

        <div className="flex-1 overflow-auto px-5 py-4 space-y-4">
          {loading && !report && (
            <div className="flex flex-col items-center justify-center py-16 text-sm text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin mb-2" />
              Auditando secciones del documento…
            </div>
          )}

          {error && (
            <div className="text-sm rounded-md border border-red-300 bg-red-50 dark:bg-red-950/30 text-red-800 dark:text-red-300 px-3 py-2">
              {error}
            </div>
          )}

          {report && (
            <>
              <p className="text-sm leading-relaxed">{report.summary}</p>

              {report.findings.length === 0 ? (
                <div className="text-sm text-muted-foreground text-center py-8">
                  No se encontraron observaciones.
                </div>
              ) : (
                <ul className="space-y-3">
                  {report.findings.map((f, i) => (
                    <FindingCard
                      key={i}
                      finding={f}
                      onNavigate={() => onNavigateToPassage(f.passage)}
                      onApplyRewrite={
                        f.suggestedRewrite
                          ? () => onApplyRewrite(f.passage, f.suggestedRewrite!)
                          : undefined
                      }
                    />
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

function OverallBadge({ overall }: { overall: StressReport['overall'] }) {
  const cfg =
    overall === 'strong'
      ? { label: 'Sólido', cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300', icon: <Check className="h-3 w-3" /> }
      : overall === 'weak'
        ? { label: 'Vulnerable', cls: 'bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300', icon: <AlertTriangle className="h-3 w-3" /> }
        : { label: 'Aceptable', cls: 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300', icon: <AlertTriangle className="h-3 w-3" /> }
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full', cfg.cls)}>
      {cfg.icon}
      Veredicto general: {cfg.label}
    </span>
  )
}

interface FindingCardProps {
  finding: StressFinding
  onNavigate: () => void
  onApplyRewrite?: () => void
}

function FindingCard({ finding, onNavigate, onApplyRewrite }: FindingCardProps) {
  const [expanded, setExpanded] = useState(finding.severity === 'high')

  const severityCfg =
    finding.severity === 'high'
      ? { label: 'Alto', cls: 'border-red-300 bg-red-50 dark:bg-red-950/20' }
      : finding.severity === 'medium'
        ? { label: 'Medio', cls: 'border-amber-300 bg-amber-50 dark:bg-amber-950/20' }
        : { label: 'Bajo', cls: 'border-border bg-muted/20' }

  return (
    <li className={cn('rounded-md border px-3 py-2.5', severityCfg.cls)}>
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="flex items-center gap-2 w-full text-left"
      >
        <ChevronRight className={cn('h-3.5 w-3.5 transition-transform', expanded && 'rotate-90')} />
        <Badge variant="outline" className="text-[10px]">
          {severityCfg.label}
        </Badge>
        <span className="text-xs font-medium">{finding.section}</span>
        <span className="text-[11px] text-muted-foreground ml-auto">
          {finding.attacks.length} ataque(s)
        </span>
      </button>

      <p className="text-[12px] text-muted-foreground mt-1.5 line-clamp-2 italic">
        “{finding.passage.slice(0, 240)}{finding.passage.length > 240 ? '…' : ''}”
      </p>

      <div className="flex items-center gap-1 mt-2">
        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onNavigate}>
          <Crosshair className="h-3 w-3 mr-1" />
          Ir al párrafo
        </Button>
        {onApplyRewrite && (
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onApplyRewrite}>
            <Wand2 className="h-3 w-3 mr-1" />
            Aplicar reescritura
          </Button>
        )}
      </div>

      {expanded && (
        <div className="mt-2.5 space-y-2.5 text-xs">
          {finding.attacks.length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3 text-red-600" /> Ataques previsibles
              </div>
              <ul className="space-y-1.5">
                {finding.attacks.map((a, i) => (
                  <li key={i} className="rounded bg-background/60 border border-border/60 px-2 py-1.5">
                    <div className="font-medium">{a.title}</div>
                    <div className="text-muted-foreground leading-snug mt-0.5">{a.argument}</div>
                    {a.citation && (
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        Citación posible: {a.citation}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {finding.defenses.length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
                Cómo blindarlo
              </div>
              <ul className="list-disc pl-4 space-y-0.5">
                {finding.defenses.map((d, i) => (
                  <li key={i}>{d}</li>
                ))}
              </ul>
            </div>
          )}

          {finding.suggestedRewrite && (
            <div>
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
                Reescritura sugerida
              </div>
              <div className="rounded bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-300 dark:border-emerald-900 px-2 py-1.5 leading-relaxed">
                {finding.suggestedRewrite}
              </div>
            </div>
          )}
        </div>
      )}
    </li>
  )
}
