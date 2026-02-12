'use client'

import { use } from 'react'
import Link from 'next/link'
import { FileText, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { TemplateEditor } from '@/components/lexia/templates/template-editor'
import { DOCUMENT_TYPE_CONFIG } from '@/lib/lexia/document-type-config'
import { isDocumentType, type DocumentType } from '@/lib/ai/draft-schemas'

interface PageProps {
  params: Promise<{ documentType: string }>
}

export default function TemplateEditorPage({ params }: PageProps) {
  const { documentType } = use(params)

  if (!isDocumentType(documentType)) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex-shrink-0 border-b border-border px-4 py-3">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/lexia/plantillas">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Volver
            </Link>
          </Button>
        </div>
        <div className="flex-1 p-6">
          <p className="text-muted-foreground">Tipo de documento no válido.</p>
        </div>
      </div>
    )
  }

  const config = DOCUMENT_TYPE_CONFIG[documentType as DocumentType]

  return (
    <div className="flex flex-col h-full">
      <div className="flex-shrink-0 border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
            <FileText className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-semibold">Editar plantilla: {config.label}</h1>
            <p className="text-xs text-muted-foreground">
              {config.description}
            </p>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/lexia/plantillas">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Volver
            </Link>
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-3xl mx-auto">
          <TemplateEditor documentType={documentType as DocumentType} />
        </div>
      </div>
    </div>
  )
}
