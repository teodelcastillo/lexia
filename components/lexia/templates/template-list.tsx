'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Loader2, Pencil, Settings2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { DOCUMENT_TYPE_CONFIG } from '@/lib/lexia/document-type-config'
import { getDemandaVariantLabel } from '@/lib/lexia/demand-variants'
import type { DocumentType } from '@/lib/ai/draft-schemas'

interface TemplateItem {
  id: string
  organization_id: string | null
  document_type: string
  variant?: string
  name: string
  is_active: boolean
}

interface DisplayItem {
  documentType: DocumentType
  variant: string
  label: string
  description: string
  hasOrg: boolean
  templateId?: string
}

export function TemplateList() {
  const router = useRouter()
  const [templates, setTemplates] = useState<TemplateItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [creating, setCreating] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/lexia/templates')
        if (res.ok) {
          const data = await res.json()
          setTemplates(data ?? [])
        }
      } catch (err) {
        console.error('[TemplateList] Error:', err)
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

  const orgByKey = new Map<string, TemplateItem>()
  for (const t of templates) {
    if (t.organization_id) {
      orgByKey.set(`${t.document_type}:${t.variant ?? ''}`, t)
    }
  }

  const displayItems: DisplayItem[] = deduped.map((t) => {
    const config = DOCUMENT_TYPE_CONFIG[t.document_type as DocumentType]
    const variant = t.variant ?? ''
    const label =
      t.document_type === 'demanda' && variant
        ? getDemandaVariantLabel(variant)
        : config?.label ?? t.name
    const hasOrg = orgByKey.has(`${t.document_type}:${variant}`)
    const orgTemplate = orgByKey.get(`${t.document_type}:${variant}`)
    return {
      documentType: t.document_type as DocumentType,
      variant,
      label,
      description: config?.description ?? '',
      hasOrg,
      templateId: orgTemplate?.id,
    }
  })

  const handlePersonalize = async (documentType: DocumentType, variant: string) => {
    const key = `${documentType}:${variant}`
    setCreating(key)
    try {
      const res = await fetch('/api/lexia/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentType, variant }),
      })
      if (res.ok) {
        const created = await res.json()
        setTemplates((prev) => [...prev, created])
        const url = variant
          ? `/lexia/plantillas/${documentType}?variant=${encodeURIComponent(variant)}`
          : `/lexia/plantillas/${documentType}`
        router.push(url)
      } else {
        const err = await res.json()
        throw new Error(err.error || 'Error al crear plantilla')
      }
    } catch (err) {
      console.error('[TemplateList] Create error:', err)
      toast.error(err instanceof Error ? err.message : 'Error al crear plantilla')
    } finally {
      setCreating(null)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold mb-1">Plantillas por tipo de documento</h2>
        <p className="text-sm text-muted-foreground">
          Personalizá las plantillas del Redactor Jurídico para tu estudio
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {displayItems.map((item) => {
          const config = DOCUMENT_TYPE_CONFIG[item.documentType]
          const Icon = config?.icon
          const key = `${item.documentType}:${item.variant}`
          const editUrl = item.variant
            ? `/lexia/plantillas/${item.documentType}?variant=${encodeURIComponent(item.variant)}`
            : `/lexia/plantillas/${item.documentType}`

          return (
            <Card key={key} className="overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    {Icon ? <Icon className="h-5 w-5 text-primary" /> : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{item.label}</p>
                    <p className="text-xs text-muted-foreground mb-2">{item.description}</p>
                    <Badge variant={item.hasOrg ? 'default' : 'secondary'} className="text-xs">
                      {item.hasOrg ? 'Plantilla del estudio' : 'Plantilla estándar'}
                    </Badge>
                  </div>
                </div>
                <div className="mt-4 flex gap-2">
                  {item.hasOrg ? (
                    <Button asChild size="sm" variant="outline" className="flex-1">
                      <Link href={editUrl}>
                        <Pencil className="h-4 w-4 mr-1" />
                        Editar
                      </Link>
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={() => handlePersonalize(item.documentType, item.variant)}
                      disabled={creating === key}
                    >
                      {creating === key ? (
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      ) : (
                        <Settings2 className="h-4 w-4 mr-1" />
                      )}
                      Personalizar
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
