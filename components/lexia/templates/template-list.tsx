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
import { DOCUMENT_TYPES, type DocumentType } from '@/lib/ai/draft-schemas'

interface TemplateItem {
  id: string
  organization_id: string | null
  document_type: string
  name: string
  is_active: boolean
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
          setTemplates(data)
        }
      } catch (err) {
        console.error('[TemplateList] Error:', err)
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [])

  const orgTemplatesByType = new Map<string, TemplateItem>()
  for (const t of templates) {
    if (t.organization_id) {
      orgTemplatesByType.set(t.document_type, t)
    }
  }

  const handlePersonalize = async (documentType: DocumentType) => {
    setCreating(documentType)
    try {
      const res = await fetch('/api/lexia/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentType }),
      })
      if (res.ok) {
        const created = await res.json()
        setTemplates((prev) => [...prev, created])
        router.push(`/lexia/plantillas/${documentType}`)
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
        {DOCUMENT_TYPES.map((documentType) => {
          const config = DOCUMENT_TYPE_CONFIG[documentType]
          const Icon = config.icon
          const orgTemplate = orgTemplatesByType.get(documentType)
          const hasOrg = !!orgTemplate

          return (
            <Card key={documentType} className="overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{config.label}</p>
                    <p className="text-xs text-muted-foreground mb-2">{config.description}</p>
                    <Badge variant={hasOrg ? 'default' : 'secondary'} className="text-xs">
                      {hasOrg ? 'Plantilla del estudio' : 'Plantilla estándar'}
                    </Badge>
                  </div>
                </div>
                <div className="mt-4 flex gap-2">
                  {hasOrg ? (
                    <Button asChild size="sm" variant="outline" className="flex-1">
                      <Link href={`/lexia/plantillas/${documentType}`}>
                        <Pencil className="h-4 w-4 mr-1" />
                        Editar
                      </Link>
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={() => handlePersonalize(documentType)}
                      disabled={creating === documentType}
                    >
                      {creating === documentType ? (
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
