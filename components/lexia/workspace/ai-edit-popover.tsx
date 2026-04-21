'use client'

/**
 * ⌘K popover: accepts a natural-language instruction and streams an
 * EditOperation from the server. Shows a live diff and lets the lawyer
 * accept / reject / pick an alternative / refine the instruction.
 *
 * Intentionally kept in a single file so the UX flow is easy to audit.
 */

import { useEffect, useRef, useState } from 'react'
import { Sparkles, Loader2, Check, X, RefreshCw, ChevronRight, AlertTriangle, BookOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { DiffView } from './diff-view'
import { CitationChips } from './citation-chips'
import type { EditOperation, EditRequest } from '@/lib/lexia/workspace'
import { parsePartialJson } from '@/lib/lexia/workspace'
import { cn } from '@/lib/utils'

type Mode = 'selection' | 'insert'

interface Context {
  documentIds: string[]
  personIds: string[]
}

export interface AiEditPopoverProps {
  open: boolean
  onClose: () => void
  mode: Mode
  documentId: string
  /** Anchor position in viewport (top-left px). */
  anchor: { x: number; y: number } | null
  /** Original text for selection mode. Empty in insert mode. */
  selectionText: string
  selectionFrom: number
  selectionTo: number
  /** Lawyer-picked context of docs/personas (for "this is what you should use"). */
  context: Context
  /** Called when the lawyer accepts a replacement; receives the final text. */
  onAccept: (args: {
    replacement: string
    citations: EditOperation['citations']
    editId: string | null
  }) => void
}

export function AiEditPopover(props: AiEditPopoverProps) {
  const {
    open,
    onClose,
    mode,
    documentId,
    anchor,
    selectionText,
    selectionFrom,
    selectionTo,
    context,
    onAccept,
  } = props

  const [instruction, setInstruction] = useState('')
  const [loading, setLoading] = useState(false)
  const [op, setOp] = useState<Partial<EditOperation> | null>(null)
  const [editId, setEditId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [variantIndex, setVariantIndex] = useState<number>(-1) // -1 = main, >=0 = alternatives
  const abortRef = useRef<AbortController | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (open) {
      setInstruction('')
      setOp(null)
      setEditId(null)
      setError(null)
      setVariantIndex(-1)
      setTimeout(() => inputRef.current?.focus(), 30)
    } else {
      abortRef.current?.abort()
    }
  }, [open])

  // Keyboard: Esc to close, Enter (Cmd/Ctrl) to send.
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  async function run() {
    if (!instruction.trim() || loading) return
    setLoading(true)
    setError(null)
    setOp(null)
    setEditId(null)
    setVariantIndex(-1)

    const controller = new AbortController()
    abortRef.current?.abort()
    abortRef.current = controller

    const payload: EditRequest = {
      instruction: instruction.trim(),
      mode,
      selection:
        mode === 'selection'
          ? { from: selectionFrom, to: selectionTo, text: selectionText }
          : undefined,
      context,
    }

    try {
      const res = await fetch(`/api/lexia/documents/${documentId}/edit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Error del servidor' }))
        throw new Error((err as { error?: string }).error || `HTTP ${res.status}`)
      }
      const headerEditId = res.headers.get('x-lexia-edit-id')
      if (headerEditId) setEditId(headerEditId)

      const reader = res.body?.getReader()
      if (!reader) throw new Error('Respuesta sin cuerpo')
      const decoder = new TextDecoder()
      let buffer = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const partial = parsePartialJson<Partial<EditOperation>>(buffer)
        if (partial && typeof partial === 'object') {
          setOp({ ...partial })
        }
      }
      // Final parse (no stream: true)
      buffer += decoder.decode()
      const finalObj = parsePartialJson<Partial<EditOperation>>(buffer)
      if (finalObj) setOp(finalObj)
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      setError((err as Error).message || 'Error al generar')
    } finally {
      setLoading(false)
    }
  }

  if (!open || !anchor) return null

  const activeReplacement =
    variantIndex >= 0 && op?.alternatives && op.alternatives[variantIndex] !== undefined
      ? op.alternatives[variantIndex]!
      : (op?.replacement ?? '')

  return (
    <>
      {/* Click-outside mask */}
      <div
        className="fixed inset-0 z-40"
        onMouseDown={(e) => {
          e.preventDefault()
          onClose()
        }}
      />
      <div
        className={cn(
          'fixed z-50 w-[min(620px,92vw)] max-h-[min(70vh,560px)] overflow-hidden',
          'rounded-lg border border-border bg-popover text-popover-foreground shadow-xl',
          'flex flex-col'
        )}
        style={{ left: anchor.x, top: anchor.y }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Input row */}
        <div className="flex items-start gap-2 p-3 border-b border-border">
          <div className="mt-2 flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-primary flex-shrink-0">
            <Sparkles className="h-3.5 w-3.5" />
          </div>
          <Textarea
            ref={inputRef}
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                e.preventDefault()
                void run()
              } else if (e.key === 'Enter' && !e.shiftKey && !op) {
                e.preventDefault()
                void run()
              }
            }}
            placeholder={
              mode === 'selection'
                ? 'Describí cómo querés cambiar lo seleccionado. Ej: "reformulá en tono más técnico y citá el art. 2560 CCyCN"'
                : 'Describí qué redactar en esta posición. Ej: "redactá el capítulo de hechos basándote en la demanda"'
            }
            className="min-h-[54px] resize-none border-0 focus-visible:ring-0 p-0 text-sm"
            disabled={loading}
          />
          <div className="flex items-center gap-1">
            {loading ? (
              <Button size="sm" variant="ghost" onClick={() => abortRef.current?.abort()}>
                <X className="h-4 w-4" /> Cancelar
              </Button>
            ) : (
              <Button size="sm" onClick={run} disabled={!instruction.trim()}>
                {op ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-1" /> Reintentar
                  </>
                ) : (
                  <>
                    <ChevronRight className="h-4 w-4 mr-1" /> Generar
                  </>
                )}
              </Button>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto p-3 space-y-3">
          {error && (
            <div className="text-sm rounded-md border border-red-300 bg-red-50 dark:bg-red-950/30 text-red-800 dark:text-red-300 px-3 py-2">
              {error}
            </div>
          )}

          {loading && !op && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Lexia está pensando y redactando…
            </div>
          )}

          {op && (
            <>
              {op.reasoning && (
                <section className="rounded-md bg-muted/60 px-3 py-2 text-sm">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
                    Qué hice y por qué
                  </div>
                  <p className="leading-relaxed">{op.reasoning}</p>
                </section>
              )}

              {(activeReplacement || selectionText) && (
                <DiffView original={mode === 'selection' ? selectionText : ''} replacement={activeReplacement} />
              )}

              {op.alternatives && op.alternatives.length > 0 && (
                <section>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
                    Alternativas
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <Button
                      size="sm"
                      variant={variantIndex === -1 ? 'default' : 'outline'}
                      className="h-7 text-xs"
                      onClick={() => setVariantIndex(-1)}
                    >
                      Principal
                    </Button>
                    {op.alternatives.map((_, idx) => (
                      <Button
                        key={idx}
                        size="sm"
                        variant={variantIndex === idx ? 'default' : 'outline'}
                        className="h-7 text-xs"
                        onClick={() => setVariantIndex(idx)}
                      >
                        Alternativa {idx + 1}
                      </Button>
                    ))}
                  </div>
                </section>
              )}

              {op.citations && op.citations.length > 0 && !loading && (
                <section>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1 flex items-center gap-1">
                    <BookOpen className="h-3 w-3" /> Citas · verificación automática
                  </div>
                  <CitationChips
                    citations={op.citations.filter(
                      (c): c is NonNullable<typeof c> => !!c && typeof c.label === 'string' && c.label.length > 0
                    )}
                  />
                </section>
              )}

              {op.caveats && op.caveats.length > 0 && (
                <section className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 px-3 py-2">
                  <div className="text-[10px] uppercase tracking-wide text-amber-800 dark:text-amber-400 mb-1 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Atención antes de aceptar
                  </div>
                  <ul className="text-xs list-disc pl-4 space-y-0.5 text-amber-900 dark:text-amber-200">
                    {op.caveats.map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                </section>
              )}
            </>
          )}
        </div>

        {/* Footer actions */}
        {op && !loading && activeReplacement && (
          <div className="flex items-center justify-between border-t border-border p-2 bg-muted/30">
            <span className="text-[11px] text-muted-foreground px-2">
              Enter para aceptar · Esc para descartar
            </span>
            <div className="flex items-center gap-1">
              <Button size="sm" variant="ghost" onClick={onClose}>
                <X className="h-4 w-4 mr-1" /> Rechazar
              </Button>
              <Button
                size="sm"
                onClick={() =>
                  onAccept({
                    replacement: activeReplacement,
                    citations: op.citations,
                    editId,
                  })
                }
              >
                <Check className="h-4 w-4 mr-1" /> Aceptar
              </Button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
