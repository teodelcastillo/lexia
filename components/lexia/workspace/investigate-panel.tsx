'use client'

/**
 * Investigar panel (Fase 2 del Workspace).
 *
 * Permite al abogado hacer preguntas en lenguaje natural sobre los
 * documentos del caso seleccionados. Devuelve:
 *  - respuesta en prosa
 *  - citas textuales con nombre del documento y pasaje
 *  - caveats (qué NO cubren los documentos)
 *  - preguntas de seguimiento sugeridas
 *
 * Se abre como Sheet a la derecha del editor. No modifica el documento
 * hasta que el abogado explícitamente decida insertar un pasaje.
 */

import { useEffect, useRef, useState } from 'react'
import {
  Sparkles,
  Loader2,
  Send,
  BookOpen,
  AlertTriangle,
  ArrowRight,
  Quote,
  FileSearch,
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
import { Badge } from '@/components/ui/badge'
import { parsePartialJson } from '@/lib/lexia/workspace'

interface Citation {
  documentId: string
  documentName: string
  passage: string
  relevance: 'high' | 'medium' | 'low'
}

interface InvestigateAnswer {
  answer?: string
  citations?: Citation[]
  caveats?: string[]
  followUps?: string[]
}

interface InvestigatePanelProps {
  open: boolean
  onClose: () => void
  caseId: string | null
  /** All case documents the lawyer could query. */
  documents: Array<{ id: string; name: string }>
  /** Documents currently active as context in the sidebar (pre-selected). */
  defaultDocumentIds: string[]
  /** Insert a verbatim passage into the editor at the current cursor position. */
  onInsertPassage?: (text: string) => void
}

export function InvestigatePanel(props: InvestigatePanelProps) {
  const { open, onClose, caseId, documents, defaultDocumentIds, onInsertPassage } = props

  const [question, setQuestion] = useState('')
  const [selected, setSelected] = useState<string[]>(defaultDocumentIds)
  const [loading, setLoading] = useState(false)
  const [answer, setAnswer] = useState<InvestigateAnswer | null>(null)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (open) {
      setSelected((prev) => (prev.length === 0 ? defaultDocumentIds : prev))
      setTimeout(() => inputRef.current?.focus(), 60)
    } else {
      abortRef.current?.abort()
    }
  }, [open, defaultDocumentIds])

  async function run() {
    if (!caseId) {
      setError('Este documento no está asociado a un caso. Asocialo para investigar.')
      return
    }
    if (selected.length === 0) {
      setError('Elegí al menos un documento.')
      return
    }
    if (!question.trim()) return

    setError(null)
    setAnswer(null)
    setLoading(true)

    const controller = new AbortController()
    abortRef.current?.abort()
    abortRef.current = controller

    try {
      const res = await fetch('/api/lexia/investigar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caseId,
          documentIds: selected,
          question: question.trim(),
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
        const partial = parsePartialJson<InvestigateAnswer>(buffer)
        if (partial && typeof partial === 'object') {
          setAnswer({ ...partial })
        }
      }
      buffer += decoder.decode()
      const finalObj = parsePartialJson<InvestigateAnswer>(buffer)
      if (finalObj) setAnswer(finalObj)
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      setError((err as Error).message || 'Error al investigar')
    } finally {
      setLoading(false)
    }
  }

  const relevanceStyle: Record<Citation['relevance'], string> = {
    high: 'border-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 dark:border-emerald-800/60',
    medium: 'border-amber-300 bg-amber-50 dark:bg-amber-950/40 dark:border-amber-800/60',
    low: 'border-border bg-muted/40',
  }

  return (
    <Sheet open={open} onOpenChange={(o) => (o ? undefined : onClose())}>
      <SheetContent side="right" className="w-[min(540px,92vw)] sm:max-w-[540px] flex flex-col p-0">
        <SheetHeader className="px-5 pt-5 pb-3 border-b border-border">
          <SheetTitle className="flex items-center gap-2 text-base">
            <FileSearch className="h-4 w-4 text-primary" />
            Investigar en el caso
          </SheetTitle>
          <SheetDescription className="text-xs">
            Preguntale a Lexia sobre los documentos del caso. Cita pasajes textuales y marca qué NO está cubierto.
          </SheetDescription>
        </SheetHeader>

        {/* Document selector */}
        <div className="px-5 py-3 border-b border-border max-h-[22vh] overflow-auto">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-2">
            Documentos a consultar ({selected.length}/{documents.length})
          </div>
          {documents.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">
              No hay documentos cargados en este caso.
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {documents.map((d) => {
                const active = selected.includes(d.id)
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() =>
                      setSelected((prev) =>
                        active ? prev.filter((x) => x !== d.id) : [...prev, d.id]
                      )
                    }
                    className={`text-xs px-2 py-1 rounded-full border truncate max-w-[220px] ${
                      active
                        ? 'bg-primary/10 border-primary/40 text-primary'
                        : 'bg-background border-border text-muted-foreground hover:bg-muted'
                    }`}
                    title={d.name}
                  >
                    {d.name}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Question input */}
        <div className="px-5 py-3 border-b border-border">
          <Textarea
            ref={inputRef}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                e.preventDefault()
                void run()
              }
            }}
            placeholder={
              'Preguntá, por ejemplo: "¿Qué fechas de vencimiento menciona la demanda?" o "¿El contrato preveía cláusula arbitral?"'
            }
            className="min-h-[72px] resize-none text-sm"
            disabled={loading}
          />
          <div className="flex items-center justify-between mt-2">
            <span className="text-[11px] text-muted-foreground">
              ⌘ + Enter para enviar
            </span>
            <Button size="sm" onClick={run} disabled={loading || !question.trim()}>
              {loading ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-1" />
              )}
              Investigar
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

          {loading && !answer && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Lexia está leyendo los documentos…
            </div>
          )}

          {!loading && !answer && !error && (
            <div className="text-center text-muted-foreground text-sm py-10">
              <Sparkles className="h-6 w-6 mx-auto mb-2 opacity-40" />
              Hacé una pregunta concreta. Lexia solo responderá a partir del texto de los documentos que elijas.
            </div>
          )}

          {answer?.answer && (
            <section>
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1.5">
                Respuesta
              </div>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{answer.answer}</p>
            </section>
          )}

          {answer?.citations && answer.citations.length > 0 && (
            <section>
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1">
                <BookOpen className="h-3 w-3" /> Citas textuales
              </div>
              <ul className="space-y-2">
                {answer.citations.map((c, i) => (
                  <li
                    key={i}
                    className={`rounded-md border px-3 py-2 text-xs ${relevanceStyle[c.relevance ?? 'medium']}`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="font-medium truncate max-w-[260px]">{c.documentName}</span>
                      <Badge variant="outline" className="text-[10px]">
                        {c.relevance === 'high'
                          ? 'alta'
                          : c.relevance === 'low'
                            ? 'baja'
                            : 'media'}
                      </Badge>
                    </div>
                    <blockquote className="flex gap-2 text-[12px] leading-snug italic">
                      <Quote className="h-3 w-3 flex-shrink-0 mt-0.5 opacity-60" />
                      <span className="whitespace-pre-wrap">{c.passage}</span>
                    </blockquote>
                    {onInsertPassage && (
                      <div className="mt-2 flex justify-end">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-[11px]"
                          onClick={() => onInsertPassage(c.passage)}
                        >
                          Insertar en el documento
                          <ArrowRight className="h-3 w-3 ml-1" />
                        </Button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {answer?.caveats && answer.caveats.length > 0 && (
            <section className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 px-3 py-2">
              <div className="text-[10px] uppercase tracking-wide text-amber-800 dark:text-amber-400 mb-1 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" /> Lo que los documentos NO cubren
              </div>
              <ul className="text-xs list-disc pl-4 space-y-0.5 text-amber-900 dark:text-amber-200">
                {answer.caveats.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </section>
          )}

          {answer?.followUps && answer.followUps.length > 0 && (
            <section>
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1.5">
                Preguntas sugeridas
              </div>
              <div className="flex flex-wrap gap-1.5">
                {answer.followUps.map((q, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setQuestion(q)}
                    className="text-[11px] px-2 py-1 rounded-full border border-border bg-background hover:bg-muted text-left"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
