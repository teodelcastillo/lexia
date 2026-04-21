'use client'

/**
 * Left panel: lawyer-curated context for AI operations.
 *
 * The lawyer ticks which documents / persons Lexia should consult when
 * handling ⌘K requests. This is the "alguien entiende mi caso" primitive:
 * no all-or-nothing, just the pieces I want for this particular edit.
 */

import Link from 'next/link'
import { Briefcase, FileText, Users } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'

interface WorkspaceContextPanelProps {
  caseInfo: { id: string; caseNumber: string; title: string } | null
  documents: Array<{ id: string; name: string }>
  persons: Array<{ id: string; name: string; type: string }>
  activeDocumentIds: string[]
  activePersonIds: string[]
  onDocumentToggle: (id: string, on: boolean) => void
  onPersonToggle: (id: string, on: boolean) => void
}

export function WorkspaceContextPanel(props: WorkspaceContextPanelProps) {
  const {
    caseInfo,
    documents,
    persons,
    activeDocumentIds,
    activePersonIds,
    onDocumentToggle,
    onPersonToggle,
  } = props

  return (
    <div className="flex flex-col h-full text-sm">
      {/* Case header */}
      <section className="px-3 py-3 border-b border-border">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1 flex items-center gap-1">
          <Briefcase className="h-3 w-3" /> Caso
        </div>
        {caseInfo ? (
          <Link
            href={`/casos/${caseInfo.id}`}
            className="block hover:underline text-sm font-medium truncate"
          >
            {caseInfo.caseNumber}
            <div className="text-[11px] text-muted-foreground font-normal truncate">
              {caseInfo.title}
            </div>
          </Link>
        ) : (
          <p className="text-xs text-muted-foreground">Documento sin caso asociado.</p>
        )}
      </section>

      {/* Documents */}
      <section className="px-3 py-3 border-b border-border min-h-0 flex flex-col">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-2 flex items-center justify-between">
          <span className="flex items-center gap-1">
            <FileText className="h-3 w-3" /> Documentos
          </span>
          <span className="text-[10px] lowercase tracking-normal text-muted-foreground/70">
            {activeDocumentIds.length > 0 ? `${activeDocumentIds.length} activos` : 'ninguno activo'}
          </span>
        </div>
        {documents.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">
            {caseInfo
              ? 'No hay documentos cargados en este caso.'
              : 'Asociá el documento a un caso para habilitar contexto.'}
          </p>
        ) : (
          <ul className="space-y-1 overflow-auto max-h-[30vh]">
            {documents.map((d) => {
              const active = activeDocumentIds.includes(d.id)
              return (
                <li
                  key={d.id}
                  className={cn(
                    'flex items-center gap-2 rounded px-1.5 py-1 cursor-pointer hover:bg-muted/60',
                    active && 'bg-primary/5'
                  )}
                  onClick={() => onDocumentToggle(d.id, !active)}
                >
                  <Checkbox
                    checked={active}
                    onCheckedChange={(v) => onDocumentToggle(d.id, Boolean(v))}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <span className="text-xs truncate flex-1">{d.name}</span>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {/* Persons */}
      <section className="px-3 py-3 border-b border-border min-h-0 flex flex-col">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-2 flex items-center justify-between">
          <span className="flex items-center gap-1">
            <Users className="h-3 w-3" /> Personas
          </span>
          <span className="text-[10px] lowercase tracking-normal text-muted-foreground/70">
            {activePersonIds.length > 0 ? `${activePersonIds.length} activas` : 'ninguna activa'}
          </span>
        </div>
        {persons.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">Sin personas asociadas.</p>
        ) : (
          <ul className="space-y-1 overflow-auto max-h-[30vh]">
            {persons.map((p) => {
              const active = activePersonIds.includes(p.id)
              return (
                <li
                  key={p.id}
                  className={cn(
                    'flex items-center gap-2 rounded px-1.5 py-1 cursor-pointer hover:bg-muted/60',
                    active && 'bg-primary/5'
                  )}
                  onClick={() => onPersonToggle(p.id, !active)}
                >
                  <Checkbox
                    checked={active}
                    onCheckedChange={(v) => onPersonToggle(p.id, Boolean(v))}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <div className="text-xs flex-1 truncate">
                    {p.name}
                    <span className="ml-1 text-[10px] text-muted-foreground">· {p.type}</span>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section className="px-3 py-3 mt-auto">
        <p className="text-[11px] text-muted-foreground leading-snug">
          Lo que marqués acá es lo que Lexia va a tener en cuenta cuando uses <kbd className="px-1 rounded bg-muted">⌘K</kbd>.
          Nada más, nada menos.
        </p>
      </section>
    </div>
  )
}
