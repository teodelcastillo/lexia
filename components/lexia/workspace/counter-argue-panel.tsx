'use client'

/**
 * Counter-argue (Cuestionar) panel.
 *
 * The lawyer selects a fragment in the editor, clicks "Cuestionar" and this
 * sheet shows how the opposing party would attack it, structural weaknesses,
 * how to defend it and (optionally) a stronger rewrite. It does NOT apply
 * changes automatically — the lawyer decides.
 */

import { useEffect, useRef, useState } from 'react'
import {
  Swords,
  Shield,
  ShieldAlert,
  Loader2,
  Sparkles,
  Quote,
  AlertTriangle,
  RefreshCw,
  ArrowRight,
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
import { parsePartialJson } from '@/lib/lexia/workspace'

interface Attack {
  title: string
  argument: string
  citation?: string
  severity: 'low' | 'medium' | 'high'
}

interface CounterArgueResult {
  attacks?: Attack[]
  weaknesses?: string[]
  defenses?: string[]
  suggestedRewrite?: string
}

interface CounterArguePanelProps {
  open: boolean
  onClose: () => void
  documentId: string
  /** The exact fragment the lawyer wants to stress-test. */
  fragment: string
  clientRole?: 'actor' | 'demandado' | 'recurrente' | 'recurrido' | null
  /** Replace the selection with the suggested rewrite if the lawyer accepts. */
  onApplyRewrite?: (text: string) => void
}

const severityClass: Record<Attack['severity'], string> = {
  high: 'border-red-300 bg-red-50 dark:bg-red-950/30 dark:border-red-800/60',
  medium: 'border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800/60',
  low: 'border-border bg-muted/40',
}

const severityLabel: Record<Attack['severity'], string> = {
  high: 'alta',
  medium: 'media',
  low: 'baja',
}

export function CounterArguePanel(props: CounterArguePanelProps) {
  const { open, onClose, documentId, fragment, clientRole, onApplyRewrite } = props

  const [result, setResult] = useState<CounterArgueResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const startedForFragment = useRef<string>('')

  useEffect(() => {
    if (!open) {
      abortRef.current?.abort()
      return
    }
    // Auto-run on open for the current fragment (but avoid refetching on toggle).
    if (fragment && fragment !== startedForFragment.current) {
      startedForFragment.current = fragment
      void run()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, fragment])

  async function run() {
    if (!fragment || fragment.trim().length < 20) {
      setError('Seleccioná un fragmento de al menos 20 caracteres para cuestionar.')
      return
    }
    setError(null)
    setResult(null)
    setLoading(true)

    const controller = new AbortController()
    abortRef.current?.abort()
    abortRef.current = controller

    try {
      const res = await fetch('/api/lexia/counter-argue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId,
          fragment,
          clientRole: clientRole ?? undefined,
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
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const partial = parsePartialJson<CounterArgueResult>(buffer)
        if (partial && typeof partial === 'object') setResult({ ...partial })
      }
      buffer += decoder.decode()
      const finalObj = parsePartialJson<CounterArgueResult>(buffer)
      if (finalObj) setResult(finalObj)
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      setError((err as Error).message || 'Error al cuestionar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={(o) => (o ? undefined : onClose())}>
      <SheetContent side="right" className="w-[min(560px,92vw)] sm:max-w-[560px] flex flex-col p-0">
        <SheetHeader className="px-5 pt-5 pb-3 border-b border-border">
          <SheetTitle className="flex items-center gap-2 text-base">
            <Swords className="h-4 w-4 text-primary" />
            Cuestionar este fragmento
          </SheetTitle>
          <SheetDescription className="text-xs">
            Lexia ataca tu argumento como lo haría la contraparte. Nada se aplica al documento hasta
            que vos lo decidas.
          </SheetDescription>
        </SheetHeader>

        {/* Fragment preview */}
        <div className="px-5 py-3 border-b border-border">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
            Fragmento bajo ataque
          </div>
          <blockquote className="text-xs leading-relaxed border-l-2 border-primary/50 pl-2.5 italic text-muted-foreground whitespace-pre-wrap max-h-28 overflow-auto">
            {fragment}
          </blockquote>
          <div className="flex items-center justify-between mt-2">
            <Badge variant="outline" className="text-[10px]">
              {clientRole ? `Defendés al ${clientRole}` : 'Sin rol definido'}
            </Badge>
            <Button
              size="sm"
              variant="ghost"
              onClick={run}
              disabled={loading}
              className="h-7 text-xs"
            >
              {loading ? (
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              ) : (
                <RefreshCw className="h-3 w-3 mr-1" />
              )}
              Reanalizar
            </Button>
          </div>
        </div>

        {/* Output */}
        <div className="flex-1 overflow-auto px-5 py-4 space-y-4">
          {error && (
            <div className="text-sm rounded-md border border-red-300 bg-red-50 dark:bg-red-950/30 text-red-800 dark:text-red-300 px-3 py-2">
              {error}
            </div>
          )}

          {loading && !result && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Lexia está armando los ataques de la contraparte…
            </div>
          )}

          {result?.attacks && result.attacks.length > 0 && (
            <section>
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1">
                <ShieldAlert className="h-3 w-3 text-red-500" />
                Ataques de la contraparte
              </div>
              <ul className="space-y-2">
                {result.attacks.map((a, i) => (
                  <li
                    key={i}
                    className={`rounded-md border px-3 py-2 ${severityClass[a.severity ?? 'medium']}`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-xs font-semibold truncate">{a.title}</span>
                      <Badge variant="outline" className="text-[10px]">
                        {severityLabel[a.severity ?? 'medium']}
                      </Badge>
                    </div>
                    <p className="text-xs leading-relaxed whitespace-pre-wrap">{a.argument}</p>
                    {a.citation && (
                      <div className="flex items-center gap-1 mt-1.5 text-[11px] text-muted-foreground">
                        <Quote className="h-3 w-3" /> {a.citation}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {result?.weaknesses && result.weaknesses.length > 0 && (
            <section className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 px-3 py-2">
              <div className="text-[10px] uppercase tracking-wide text-amber-800 dark:text-amber-400 mb-1 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" /> Debilidades estructurales del fragmento
              </div>
              <ul className="text-xs list-disc pl-4 space-y-0.5 text-amber-900 dark:text-amber-200">
                {result.weaknesses.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </section>
          )}

          {result?.defenses && result.defenses.length > 0 && (
            <section className="rounded-md border border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 px-3 py-2">
              <div className="text-[10px] uppercase tracking-wide text-emerald-800 dark:text-emerald-400 mb-1 flex items-center gap-1">
                <Shield className="h-3 w-3" /> Cómo blindarlo
              </div>
              <ul className="text-xs list-disc pl-4 space-y-0.5 text-emerald-900 dark:text-emerald-200">
                {result.defenses.map((d, i) => (
                  <li key={i}>{d}</li>
                ))}
              </ul>
            </section>
          )}

          {result?.suggestedRewrite && (
            <section>
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1.5 flex items-center gap-1">
                <Sparkles className="h-3 w-3 text-primary" /> Reescritura sugerida (más robusta)
              </div>
              <div className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap">
                {result.suggestedRewrite}
              </div>
              {onApplyRewrite && (
                <div className="flex justify-end mt-2">
                  <Button
                    size="sm"
                    onClick={() => onApplyRewrite(result.suggestedRewrite!.trim())}
                  >
                    Reemplazar el fragmento
                    <ArrowRight className="h-3 w-3 ml-1" />
                  </Button>
                </div>
              )}
            </section>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
