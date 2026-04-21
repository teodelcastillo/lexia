'use client'

/**
 * Citation chips with live verification.
 *
 * Given a list of citations (from an AI edit proposal), fires a verification
 * request to /api/lexia/verify-citation and renders a chip per citation whose
 * color/icon reflects the verdict:
 *   - verified : green check
 *   - warning  : amber warning
 *   - invalid  : red x
 *   - unknown  : neutral, while the verifier is running
 *
 * Hover shows the explanation and (if any) a suggested corrected label.
 */

import { useEffect, useRef, useState } from 'react'
import { Check, AlertTriangle, XCircle, Loader2 } from 'lucide-react'

import type { Citation } from '@/lib/lexia/workspace'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

export type CitationVerdict = {
  index: number
  status: 'verified' | 'warning' | 'invalid'
  confidence: number
  explanation: string
  suggestedLabel?: string
  source?: string
}

interface CitationChipsProps {
  citations: Citation[]
  /** If true, fires verification automatically on mount / when citations change. */
  autoVerify?: boolean
}

export function CitationChips({ citations, autoVerify = true }: CitationChipsProps) {
  const [verdicts, setVerdicts] = useState<Record<number, CitationVerdict>>({})
  const [verifying, setVerifying] = useState(false)
  const lastKey = useRef<string>('')

  useEffect(() => {
    if (!autoVerify || citations.length === 0) return
    const key = citations.map((c) => `${c.kind}:${c.label}`).join('|')
    if (key === lastKey.current) return
    lastKey.current = key
    setVerdicts({})
    setVerifying(true)

    const controller = new AbortController()
    fetch('/api/lexia/verify-citation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ citations }),
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json() as Promise<{ verdicts: CitationVerdict[] }>
      })
      .then((data) => {
        const map: Record<number, CitationVerdict> = {}
        for (const v of data.verdicts ?? []) map[v.index] = v
        setVerdicts(map)
      })
      .catch(() => {
        // Best effort; leave chips in unknown state
      })
      .finally(() => setVerifying(false))

    return () => controller.abort()
  }, [citations, autoVerify])

  if (citations.length === 0) return null

  return (
    <TooltipProvider delayDuration={120}>
      <div className="flex flex-wrap gap-1.5">
        {citations.map((c, i) => {
          const v = verdicts[i]
          const status: string = v?.status ?? 'unknown'
          const tooltip = v
            ? `${v.explanation}${v.suggestedLabel ? `\nSugerencia: ${v.suggestedLabel}` : ''}${v.source ? `\nFuente: ${v.source}` : ''}`
            : verifying
              ? 'Verificando cita…'
              : 'Cita sin verificar'
          return (
            <Tooltip key={i}>
              <TooltipTrigger asChild>
                <span
                  className={cn(
                    'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border',
                    status === 'verified' &&
                      'bg-emerald-50 border-emerald-300 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-800/60 dark:text-emerald-300',
                    status === 'warning' &&
                      'bg-amber-50 border-amber-300 text-amber-900 dark:bg-amber-950/40 dark:border-amber-800/60 dark:text-amber-200',
                    status === 'invalid' &&
                      'bg-red-50 border-red-300 text-red-800 dark:bg-red-950/40 dark:border-red-800/60 dark:text-red-300',
                    status === 'unknown' && 'bg-muted border-border text-muted-foreground'
                  )}
                >
                  {status === 'verified' && <Check className="h-3 w-3" />}
                  {status === 'warning' && <AlertTriangle className="h-3 w-3" />}
                  {status === 'invalid' && <XCircle className="h-3 w-3" />}
                  {status === 'unknown' && verifying && (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  )}
                  <span className="truncate max-w-[280px]">{c.label}</span>
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs whitespace-pre-wrap">
                <div className="space-y-1">
                  <div className="font-medium">{c.label}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {c.kind === 'norma'
                      ? 'Normativa'
                      : c.kind === 'jurisprudencia'
                        ? 'Jurisprudencia'
                        : 'Doctrina'}
                  </div>
                  <div className="text-xs leading-snug">{tooltip}</div>
                </div>
              </TooltipContent>
            </Tooltip>
          )
        })}
      </div>
    </TooltipProvider>
  )
}

/**
 * Public map returned by the verifier, indexed by citation order.
 * Exported to let the editor decide what status to stamp on the mark.
 */
export type CitationVerdictMap = Record<number, CitationVerdict>
