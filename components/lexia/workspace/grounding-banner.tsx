'use client'

/**
 * Grounding banner — document integrity header in the Workspace.
 *
 * Polls /api/lexia/documents/[id]/grounding and renders a status pill:
 *   - grounded  (verde)  : every cited source verified
 *   - partial   (ambar)  : some warnings, no invalid
 *   - ungrounded (rojo)  : at least one cite flagged as invalid
 *   - empty              : no citations yet
 *
 * Clicking the banner opens a drawer with the full list of citation issues,
 * each with suggested corrections and the sourceType responsible for the
 * verdict (dataset, saij_cache, llm_judge, heuristic).
 */

import { useCallback, useEffect, useState } from 'react'
import {
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Info,
  X,
  ExternalLink,
  Loader2,
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

export interface GroundingIssue {
  editId: string
  index: number
  label: string
  status: 'warning' | 'invalid'
  explanation: string
  suggestedLabel?: string
  source?: string
  sourceType?: string
}

export interface GroundingData {
  status: 'grounded' | 'partial' | 'ungrounded' | 'empty'
  counts: { verified: number; warning: number; invalid: number; total: number }
  issues: GroundingIssue[]
}

interface GroundingBannerProps {
  documentId: string
  /** Increment to trigger refetch after applying a new edit. */
  refreshKey?: number
}

export function GroundingBanner({ documentId, refreshKey }: GroundingBannerProps) {
  const [data, setData] = useState<GroundingData | null>(null)
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/lexia/documents/${documentId}/grounding`, {
        cache: 'no-store',
      })
      if (!res.ok) return
      const body = (await res.json()) as GroundingData
      setData(body)
    } catch {
      // best-effort
    } finally {
      setLoading(false)
    }
  }, [documentId])

  useEffect(() => {
    void refresh()
  }, [refresh, refreshKey])

  if (!data || data.status === 'empty') return null

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={cn(
          'inline-flex items-center gap-2 px-2.5 py-1 rounded-full border text-[11px] font-medium transition-colors',
          data.status === 'grounded' &&
            'bg-emerald-50 border-emerald-300 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:border-emerald-800/60 dark:text-emerald-300',
          data.status === 'partial' &&
            'bg-amber-50 border-amber-300 text-amber-900 hover:bg-amber-100 dark:bg-amber-950/40 dark:border-amber-800/60 dark:text-amber-200',
          data.status === 'ungrounded' &&
            'bg-red-50 border-red-300 text-red-800 hover:bg-red-100 dark:bg-red-950/40 dark:border-red-800/60 dark:text-red-300'
        )}
        title="Ver integridad de citas del documento"
      >
        {data.status === 'grounded' && <ShieldCheck className="h-3.5 w-3.5" />}
        {data.status === 'partial' && <ShieldAlert className="h-3.5 w-3.5" />}
        {data.status === 'ungrounded' && <ShieldX className="h-3.5 w-3.5" />}
        {loading ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <span>
            {data.counts.verified}/{data.counts.total} citas verificadas
          </span>
        )}
      </button>

      <Sheet open={open} onOpenChange={(o) => setOpen(o)}>
        <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col p-0 gap-0">
          <SheetHeader className="border-b px-5 py-4">
            <SheetTitle className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4" /> Integridad de citas
            </SheetTitle>
            <SheetDescription>
              Estado de verificación de todas las citas aceptadas en este documento.
            </SheetDescription>
          </SheetHeader>

          <div className="px-5 py-3 border-b bg-muted/30 flex items-center gap-2 text-xs">
            <Badge variant="outline" className="bg-emerald-50 text-emerald-700">
              {data.counts.verified} verificadas
            </Badge>
            <Badge variant="outline" className="bg-amber-50 text-amber-700">
              {data.counts.warning} warnings
            </Badge>
            <Badge variant="outline" className="bg-red-50 text-red-700">
              {data.counts.invalid} invalidas
            </Badge>
          </div>

          <div className="flex-1 overflow-auto">
            {data.issues.length === 0 ? (
              <div className="px-5 py-10 text-sm text-muted-foreground text-center">
                Todas las citas estan verificadas.
              </div>
            ) : (
              data.issues.map((issue, idx) => (
                <article
                  key={`${issue.editId}-${issue.index}-${idx}`}
                  className="px-5 py-4 border-b"
                >
                  <div className="flex items-start gap-2">
                    {issue.status === 'invalid' ? (
                      <ShieldX className="h-4 w-4 mt-0.5 text-red-600" />
                    ) : (
                      <ShieldAlert className="h-4 w-4 mt-0.5 text-amber-600" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm break-words">{issue.label}</div>
                      <p className="text-xs text-muted-foreground mt-1">{issue.explanation}</p>
                      {issue.suggestedLabel && issue.suggestedLabel !== issue.label && (
                        <div className="mt-2 text-xs">
                          <span className="text-muted-foreground">Sugerencia: </span>
                          <span className="font-medium">{issue.suggestedLabel}</span>
                        </div>
                      )}
                      <div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
                        {issue.sourceType && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            {issue.sourceType}
                          </Badge>
                        )}
                        {issue.source && issue.source.startsWith('http') && (
                          <a
                            href={issue.source}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-primary hover:underline"
                          >
                            <ExternalLink className="h-3 w-3" /> Abrir fuente
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </article>
              ))
            )}
          </div>

          <div className="border-t px-5 py-3 flex items-center justify-between">
            <div className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Info className="h-3.5 w-3.5" />
              La verificacion corre sobre dataset + cache SAIJ + juez LLM.
            </div>
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
              <X className="h-3 w-3 mr-1" /> Cerrar
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
