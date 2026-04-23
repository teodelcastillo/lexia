'use client'

/**
 * Jurisprudence panel (SAIJ-backed).
 *
 * Lateral drawer that lets the lawyer search real Argentine jurisprudence
 * from SAIJ (with persistent cache) and insert a citation into the document
 * as a proper `citation` mark. Every result carries id-infojus + canonical
 * URL, so nothing comes from an LLM imagination.
 */

import { useCallback, useRef, useState } from 'react'
import {
  Loader2,
  Search,
  BookOpen,
  ExternalLink,
  AlertTriangle,
  Plus,
  Gavel,
} from 'lucide-react'

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export interface JurisPanelResult {
  id: string
  source: string
  externalId: string
  kind: string
  title: string
  court: string | null
  jurisdiction: string | null
  decisionDate: string | null
  summary: string | null
  url: string
}

interface JurisprudencePanelProps {
  open: boolean
  onClose: () => void
  caseId: string | null
  /**
   * Insert a verified citation into the editor at the current selection.
   * The caller decides how to wrap it (mark, text, etc.)
   */
  onInsertCitation: (payload: {
    label: string
    url: string
    summary: string | null
    externalId: string
  }) => void
  /** Default query pre-populated from case metadata. */
  defaultQuery?: string
  defaultJurisdiction?: string
}

const JURISDICTIONS = [
  { value: 'any', label: 'Todas las jurisdicciones' },
  { value: 'Nacional', label: 'Nacional / Federal' },
  { value: 'Cordoba', label: 'Cordoba' },
  { value: 'Buenos Aires', label: 'Buenos Aires' },
  { value: 'CABA', label: 'CABA' },
]

export function JurisprudencePanel(props: JurisprudencePanelProps) {
  const { open, onClose, caseId, onInsertCitation, defaultQuery, defaultJurisdiction } =
    props

  const [query, setQuery] = useState(defaultQuery ?? '')
  const [jurisdiction, setJurisdiction] = useState<string>(defaultJurisdiction ?? 'any')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<JurisPanelResult[]>([])
  const [degraded, setDegraded] = useState(false)
  const [source, setSource] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const doSearch = useCallback(async () => {
    const q = query.trim()
    if (q.length < 2) return
    setLoading(true)
    setError(null)
    setResults([])
    setDegraded(false)
    setSource(null)

    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl

    try {
      const res = await fetch('/api/lexia/jurisprudence/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: q,
          tipo: 'fallo',
          jurisdiction: jurisdiction === 'any' ? null : jurisdiction,
          limit: 10,
          caseId: caseId ?? undefined,
        }),
        signal: ctrl.signal,
      })
      if (!res.ok) {
        setError(`Error del servidor (${res.status})`)
        return
      }
      const data = (await res.json()) as {
        results: JurisPanelResult[]
        source: string
        degraded: boolean
        error?: string
      }
      setResults(data.results ?? [])
      setSource(data.source)
      setDegraded(Boolean(data.degraded))
      if (data.error) setError(data.error)
    } catch (err) {
      if ((err as { name?: string }).name !== 'AbortError') {
        setError('No se pudo completar la busqueda.')
      }
    } finally {
      setLoading(false)
    }
  }, [query, jurisdiction, caseId])

  const handleInsert = (r: JurisPanelResult) => {
    const courtPart = r.court ? `, ${r.court}` : ''
    const datePart = r.decisionDate ? ` (${r.decisionDate})` : ''
    const label = `"${r.title.replace(/"/g, '')}"${courtPart}${datePart}`
    onInsertCitation({
      label,
      url: r.url,
      summary: r.summary,
      externalId: r.externalId,
    })
  }

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-xl flex flex-col p-0 gap-0">
        <SheetHeader className="border-b px-5 py-4">
          <SheetTitle className="flex items-center gap-2">
            <Gavel className="h-4 w-4" /> Jurisprudencia SAIJ
          </SheetTitle>
          <SheetDescription>
            Busqueda en la base publica SAIJ con cache local. Cada resultado incluye id-infojus y enlace oficial.
          </SheetDescription>
        </SheetHeader>

        <div className="px-5 py-4 border-b bg-muted/30 space-y-3 flex-shrink-0">
          <div className="flex gap-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ej: despido indirecto falta de pago"
              onKeyDown={(e) => {
                if (e.key === 'Enter') doSearch()
              }}
              className="flex-1"
            />
            <Button onClick={doSearch} disabled={loading || query.trim().length < 2}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              <span className="ml-1.5 hidden sm:inline">Buscar</span>
            </Button>
          </div>
          <Select value={jurisdiction} onValueChange={setJurisdiction}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {JURISDICTIONS.map((j) => (
                <SelectItem key={j.value} value={j.value} className="text-xs">
                  {j.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex-1 overflow-auto">
          {degraded && (
            <div className="px-5 py-3 border-b bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 text-xs flex gap-2 items-start">
              <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-medium">SAIJ no respondio a tiempo</div>
                <div>Se muestran resultados del cache local. Intenta de nuevo mas tarde.</div>
              </div>
            </div>
          )}

          {error && !degraded && (
            <div className="px-5 py-3 border-b bg-red-50 dark:bg-red-950/30 text-red-800 dark:text-red-200 text-xs">
              {error}
            </div>
          )}

          {source && !loading && results.length > 0 && (
            <div className="px-5 py-2 text-[11px] text-muted-foreground border-b">
              {results.length} resultado(s) · fuente:{' '}
              <span className="font-medium">{source}</span>
            </div>
          )}

          {!loading && !error && results.length === 0 && (
            <div className="px-5 py-10 text-center text-sm text-muted-foreground">
              <BookOpen className="mx-auto h-8 w-8 opacity-40 mb-2" />
              <p>Escribe un tema o frase para buscar jurisprudencia.</p>
            </div>
          )}

          {results.map((r) => (
            <article key={r.id} className="px-5 py-4 border-b hover:bg-muted/30">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm leading-snug">{r.title}</p>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    {r.court && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {r.court}
                      </Badge>
                    )}
                    {r.decisionDate && (
                      <span className="text-[11px] text-muted-foreground">
                        {r.decisionDate}
                      </span>
                    )}
                    <span className="text-[10px] text-muted-foreground font-mono">
                      id-infojus: {r.externalId}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col gap-1 flex-shrink-0">
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => handleInsert(r)}
                    title="Insertar cita en el documento"
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" /> Insertar
                  </Button>
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-primary inline-flex items-center gap-1 hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" /> Abrir en SAIJ
                  </a>
                </div>
              </div>
              {r.summary && (
                <p className="mt-2 text-sm text-muted-foreground line-clamp-4">
                  {r.summary}
                </p>
              )}
            </article>
          ))}

          {loading && (
            <div className="py-12 text-center text-muted-foreground text-sm">
              <Loader2 className="mx-auto h-6 w-6 animate-spin mb-2" />
              Consultando SAIJ…
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
