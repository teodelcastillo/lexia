'use client'

import { Card, CardContent } from '@/components/ui/card'
import type { DocumentType } from '@/lib/ai/draft-schemas'
import { DOCUMENT_TYPE_CONFIG } from '@/lib/lexia/document-type-config'

interface RedactorDocumentTypeSelectProps {
  onSelect: (type: DocumentType) => void
}

export function RedactorDocumentTypeSelect({ onSelect }: RedactorDocumentTypeSelectProps) {
  const types = Object.entries(DOCUMENT_TYPE_CONFIG) as [DocumentType, (typeof DOCUMENT_TYPE_CONFIG)[DocumentType]][]

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold mb-1">Selecciona el tipo de documento</h2>
        <p className="text-sm text-muted-foreground">
          Elige el tipo de documento legal que necesitas redactar
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {types.map(([type, config]) => {
          const Icon = config.icon
          return (
            <Card
              key={type}
              className="cursor-pointer transition-colors hover:bg-muted/50 hover:border-primary/50"
              onClick={() => onSelect(type)}
            >
              <CardContent className="flex items-start gap-3 p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{config.label}</p>
                  <p className="text-xs text-muted-foreground">{config.description}</p>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
