'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Loader2, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { TemplateInstructionsEditor } from './template-instructions-editor'
import { TemplateContentEditor } from './template-content-editor'
import { TemplateFieldsEditor } from './template-fields-editor'
import { DOCUMENT_TYPE_CONFIG } from '@/lib/lexia/document-type-config'
import { DOCUMENT_TYPE_SCHEMAS, type DocumentType, type FormFieldDefinition } from '@/lib/ai/draft-schemas'
import { toast } from 'sonner'

interface TemplateData {
  id: string
  organization_id: string | null
  document_type: string
  name: string
  structure_schema: { fields: FormFieldDefinition[] } | { fields: string[] }
  template_content: string | null
  system_prompt_fragment: string | null
  is_active: boolean
  isOrgTemplate: boolean
  fields: FormFieldDefinition[]
}

interface TemplateEditorProps {
  documentType: DocumentType
}

export function TemplateEditor({ documentType }: TemplateEditorProps) {
  const router = useRouter()
  const [template, setTemplate] = useState<TemplateData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  const [instructions, setInstructions] = useState('')
  const [content, setContent] = useState('')
  const [fields, setFields] = useState<FormFieldDefinition[]>([])

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/lexia/templates/by-type/${documentType}`)
        if (res.ok) {
          const data = await res.json()
          setTemplate(data)
          setInstructions(data.system_prompt_fragment ?? '')
          setContent(data.template_content ?? '')
          setFields(data.fields ?? DOCUMENT_TYPE_SCHEMAS[documentType].fields)
        } else {
          setTemplate(null)
        }
      } catch (err) {
        console.error('[TemplateEditor] Error:', err)
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [documentType])

  const handleSave = async () => {
    if (!template?.id || !template.isOrgTemplate) return
    setIsSaving(true)
    try {
      const structureSchema = { fields }
      const res = await fetch(`/api/lexia/templates/${template.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_prompt_fragment: instructions || null,
          template_content: content || null,
          structure_schema: structureSchema,
        }),
      })
      if (res.ok) {
        toast.success('Plantilla guardada')
      } else {
        const err = await res.json()
        throw new Error(err.error || 'Error al guardar')
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setIsSaving(false)
    }
  }

  const handleRevertToStandard = async () => {
    if (!template?.id || !template.isOrgTemplate) return
    if (!confirm('¿Volver a usar la plantilla estándar? Se eliminará la plantilla personalizada.')) return
    setIsSaving(true)
    try {
      const res = await fetch(`/api/lexia/templates/${template.id}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('Plantilla revertida a estándar')
        router.push('/lexia/plantillas')
      } else {
        const err = await res.json()
        throw new Error(err.error || 'Error al eliminar')
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al revertir')
    } finally {
      setIsSaving(false)
    }
  }

  const config = DOCUMENT_TYPE_CONFIG[documentType]
  const canEdit = template?.isOrgTemplate ?? false

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!template) {
    return (
      <div className="space-y-4">
        <p className="text-muted-foreground">No se encontró la plantilla.</p>
        <Button asChild variant="outline">
          <Link href="/lexia/plantillas">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Volver
          </Link>
        </Button>
      </div>
    )
  }

  if (!canEdit) {
    return (
      <div className="space-y-4">
        <p className="text-muted-foreground">
          Esta plantilla es estándar. Creá una personalizada desde la lista de plantillas.
        </p>
        <Button asChild variant="outline">
          <Link href="/lexia/plantillas">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Volver
          </Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{config.label}</h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleRevertToStandard} disabled={isSaving}>
            Volver a estándar
          </Button>
          <Button size="sm" onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-1" />
            )}
            Guardar
          </Button>
        </div>
      </div>

      <Tabs defaultValue="instructions" className="w-full">
        <TabsList>
          <TabsTrigger value="instructions">Instrucciones</TabsTrigger>
          <TabsTrigger value="content">Contenido base</TabsTrigger>
          <TabsTrigger value="fields">Campos del formulario</TabsTrigger>
        </TabsList>
        <TabsContent value="instructions" className="pt-4">
          <Card>
            <CardContent className="pt-6">
              <TemplateInstructionsEditor
                value={instructions}
                onChange={setInstructions}
                disabled={!canEdit}
              />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="content" className="pt-4">
          <Card>
            <CardContent className="pt-6">
              <TemplateContentEditor
                value={content}
                onChange={setContent}
                availableFields={fields}
                disabled={!canEdit}
              />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="fields" className="pt-4">
          <Card>
            <CardContent className="pt-6">
              <TemplateFieldsEditor
                documentType={documentType}
                fields={fields}
                onChange={setFields}
                disabled={!canEdit}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
