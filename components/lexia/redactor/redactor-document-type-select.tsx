'use client'

import { useEffect, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import type { DocumentType } from '@/lib/ai/draft-schemas'
import { DOCUMENT_TYPES } from '@/lib/ai/draft-schemas'
import { DOCUMENT_TYPE_CONFIG } from '@/lib/lexia/document-type-config'
import { getDemandaVariantLabel } from '@/lib/lexia/demand-variants'

interface TemplateItem {
  id: string
  organization_id: string | null
  document_type: string
  variant?: string
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

type View = 'types' | 'demanda-variants'

export function RedactorDocumentTypeSelect({ onSelect }: RedactorDocumentTypeSelectProps) {
  const [view, setView] = useState<View>('types')
  const [templates, setTemplates] = useState<TemplateItem[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/lexia/templates?documentType=demanda')
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
  const demandaTemplates = Array.from(byKey.values()).filter((t) => t.document_type === 'demanda')

  const handleSelectType = (documentType: DocumentType) => {
    if (documentType === 'demanda') {
      setView('demanda-variants')
    } else {
      onSelect({ documentType, variant: '' })
    }
  }

  const handleSelectDemandaVariant = (variant: string) => {
    onSelect({ documentType: 'demanda', variant })
  }

  const handleBack = () => {
    setView('types')
  }

  if (view === 'demanda-variants') {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={handleBack}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Volver
          </Button>
        </div>
        <div>
          <h2 className="text-lg font-semibold mb-1">¿Qué tipo de demanda?</h2>
          <p className="text-sm text-muted-foreground">
            Elegí la plantilla según el tipo de incumplimiento o demanda que necesitás redactar
          </p>
        </div>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Cargando plantillas...</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {demandaTemplates.map((t) => {
              const variant = t.variant ?? ''
              const label =
                variant ? getDemandaVariantLabel(variant) : 'Demanda (estándar)'
              const config = DOCUMENT_TYPE_CONFIG.demanda
              const Icon = config?.icon
              return (
                <Card
                  key={`demanda-${variant}`}
                  className="cursor-pointer transition-colors hover:bg-muted/50 hover:border-primary/50"
                  onClick={() => handleSelectDemandaVariant(variant)}
                >
                  <CardContent className="flex items-start gap-3 p-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                      {Icon ? <Icon className="h-5 w-5 text-primary" /> : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{label}</p>
                      <p className="text-xs text-muted-foreground">{config?.description ?? ''}</p>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold mb-1">Selecciona el tipo de documento</h2>
        <p className="text-sm text-muted-foreground">
          Elige el tipo de documento legal que necesitás redactar
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {DOCUMENT_TYPES.map((documentType) => {
          const config = DOCUMENT_TYPE_CONFIG[documentType]
          const Icon = config?.icon
          return (
            <Card
              key={documentType}
              className="cursor-pointer transition-colors hover:bg-muted/50 hover:border-primary/50"
              onClick={() => handleSelectType(documentType)}
            >
              <CardContent className="flex items-start gap-3 p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  {Icon ? <Icon className="h-5 w-5 text-primary" /> : null}
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
