'use client'

import { ExternalLink, BookOpen, ChevronDown, ChevronUp } from 'lucide-react'
import { useState } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { Jurisprudence } from '@/lib/lexia/estratega/types'

interface Props {
  jurisprudence: Jurisprudence[]
}

export function JurisprudenceDisplay({ jurisprudence }: Props) {
  const [expanded, setExpanded] = useState<number | null>(null)

  if (jurisprudence.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-40" />
        <p className="text-sm">No se encontró jurisprudencia relevante</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {jurisprudence.map((item, idx) => {
        const isExpanded = expanded === idx
        return (
          <Card key={idx} className="overflow-hidden">
            <button
              className="w-full text-left"
              onClick={() => setExpanded(isExpanded ? null : idx)}
            >
              <CardHeader className="py-3 px-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-sm leading-snug">{item.title}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">{item.court}</Badge>
                      <span className="text-xs text-muted-foreground">{item.date}</span>
                      {item.indemnizationAmount && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          {item.indemnizationAmount}
                        </Badge>
                      )}
                    </div>
                  </div>
                  {isExpanded
                    ? <ChevronUp className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-1" />
                    : <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-1" />
                  }
                </div>
              </CardHeader>
            </button>

            {isExpanded && (
              <CardContent className="pt-0 px-4 pb-4 space-y-3">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Resumen</p>
                  <p className="text-sm">{item.summary}</p>
                </div>

                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Relevancia para el caso</p>
                  <p className="text-sm text-muted-foreground">{item.relevance}</p>
                </div>

                {item.keyArguments.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Argumentos clave</p>
                    <ul className="space-y-1">
                      {item.keyArguments.map((arg, ai) => (
                        <li key={ai} className="text-sm flex gap-2">
                          <span className="text-primary font-bold flex-shrink-0">·</span>
                          <span>{arg}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {item.url && (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Ver fallo completo
                  </a>
                )}
              </CardContent>
            )}
          </Card>
        )
      })}
    </div>
  )
}
