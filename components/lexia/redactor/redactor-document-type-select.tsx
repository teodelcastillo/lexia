'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import type { DocumentType } from '@/lib/ai/draft-schemas'
import { DOCUMENT_TYPE_CONFIG } from '@/lib/lexia/document-type-config'
import { getDemandaVariantLabel } from '@/lib/lexia/demand-variants'

interface TemplateItem {
  id: string
  organization_id: string | null
  document_type: string
  variant: string
  name: string
  is_active: boolean
}

export interface SelectedTemplate {
  documentType: DocumentType
  variant: string
}

interface RedactorDocumentTypeSelectProps {
  onSelect: (template: SelectedTemplate) => void
}

export function RedactorDocumentTypeSelect({ onSelect }: RedactorDocumentTypeSelectProps) {
  const [templates, setTemplates] = useState<TemplateItem[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/lexia/templates')
        if (res.ok) {
          const data = await res.json()
          setTemplates(data ?? [])
        }
      } catch (err) {
        console.error('[RedactorDocumentTypeSelect] Error loading templates:', err)
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [])

  const byKey = new Map<string, TemplateItem>()
  for (const t of templates) {
    const key = `${t.document_type}:${t.variant ?? ''}`
    const existing = byKey.get(key)
    if (!existing || (t.organization_id && !existing.organization_id)) {
      byKey.set(key, t)
    }
  }
  const deduped = Array.from(byKey.values())

  const selectableItems = deduped.map((t) => {
    const config = DOCUMENT_TYPE_CONFIG[t.document_type as DocumentType]
    const label =
      t.document_type === 'demanda' && t.variant
        ? getDemandaVariantLabel(t.variant)
        : config?.label ?? t.name
    const description = config?.description ?? ''
    const Icon = config?.icon
    return {
      documentType: t.document_type as DocumentType,
      variant: t.variant ?? '',
      label,
      description,
      Icon,
    }
  })

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold mb-1">Selecciona el tipo de documento</h2>
          <p className="text-sm text-muted-foreground">Cargando plantillas...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold mb-1">Selecciona el tipo de documento</h2>
        <p className="text-sm text-muted-foreground">
          Elige el tipo de documento legal que necesitas redactar
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {selectableItems.map((item) => {
          const Icon = item.Icon
          return (
            <Card
              key={`${item.documentType}-${item.variant}`}
              className="cursor-pointer transition-colors hover:bg-muted/50 hover:border-primary/50"
              onClick={() => onSelect({ documentType: item.documentType, variant: item.variant })}
            >
              <CardContent className="flex items-start gap-3 p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  {Icon ? <Icon className="h-5 w-5 text-primary" /> : null}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.description}</p>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
