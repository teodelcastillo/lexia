'use client'

import { useState, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Copy, FileDown, FileText, Loader2, Pencil, Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import type { DocumentType } from '@/lib/ai/draft-schemas'

const DOCUMENT_TYPE_NAMES: Record<DocumentType, string> = {
  demanda: 'Demanda',
  contestacion: 'Contestación',
  apelacion: 'Recurso de Apelación',
  casacion: 'Recurso de Casación',
  recurso_extraordinario: 'Recurso Extraordinario',
  contrato: 'Contrato',
  carta_documento: 'Carta Documento',
  mediacion: 'Mediación',
  oficio_judicial: 'Oficio Judicial',
}

interface RedactorDraftViewProps {
  documentType: DocumentType
  content: string
  isStreaming?: boolean
  onContentChange?: (content: string) => void
  onSaveClick?: () => void
}

export function RedactorDraftView({
  documentType,
  content,
  isStreaming = false,
  onContentChange,
  onSaveClick,
}: RedactorDraftViewProps) {
  const contentRef = useRef<HTMLDivElement>(null)
  const [isEditing, setIsEditing] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content)
      toast.success('Copiado al portapapeles')
    } catch {
      toast.error('Error al copiar')
    }
  }

  const handleExportWord = async () => {
    try {
      const res = await fetch('/api/lexia/draft/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content,
          fileName: `${DOCUMENT_TYPE_NAMES[documentType].toLowerCase().replace(/\s+/g, '-')}-borrador.docx`,
        }),
      })
      if (!res.ok) throw new Error('Export failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${DOCUMENT_TYPE_NAMES[documentType].toLowerCase().replace(/\s+/g, '-')}-borrador.docx`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Documento Word descargado')
    } catch {
      toast.error('Error al exportar a Word')
    }
  }

  const handleExportPdf = () => {
    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      toast.error('Permite ventanas emergentes para exportar a PDF')
      return
    }
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${DOCUMENT_TYPE_NAMES[documentType]} - Borrador</title>
          <style>
            body { font-family: serif; padding: 2cm; line-height: 1.6; max-width: 21cm; margin: 0 auto; }
            pre { white-space: pre-wrap; font-family: inherit; }
          </style>
        </head>
        <body>
          <pre>${content.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
        </body>
      </html>
    `)
    printWindow.document.close()
    printWindow.onload = () => {
      printWindow.print()
      printWindow.onafterprint = () => printWindow.close()
    }
    toast.success('Abre la ventana de impresión y elige "Guardar como PDF"')
  }

  const proseClasses =
    'prose prose-sm dark:prose-invert max-w-none prose-p:text-foreground prose-headings:text-foreground prose-strong:text-foreground prose-li:text-foreground prose-pre:whitespace-pre-wrap prose-pre:bg-muted/50 prose-pre:p-4 prose-pre:rounded-lg prose-pre:text-foreground'

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-wrap items-center gap-2 pb-4 border-b border-border">
        {onContentChange && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsEditing((e) => !e)}
            disabled={!content || isStreaming}
          >
            {isEditing ? (
              <>
                <Eye className="h-4 w-4 mr-2" />
                Vista previa
              </>
            ) : (
              <>
                <Pencil className="h-4 w-4 mr-2" />
                Editar
              </>
            )}
          </Button>
        )}
        {onSaveClick && (
          <Button variant="outline" size="sm" onClick={onSaveClick} disabled={!content || isStreaming}>
            Guardar borrador
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={handleCopy} disabled={!content || isStreaming}>
          <Copy className="h-4 w-4 mr-2" />
          Copiar
        </Button>
        <Button variant="outline" size="sm" onClick={handleExportWord} disabled={!content || isStreaming}>
          <FileDown className="h-4 w-4 mr-2" />
          Exportar Word
        </Button>
        <Button variant="outline" size="sm" onClick={handleExportPdf} disabled={!content || isStreaming}>
          <FileText className="h-4 w-4 mr-2" />
          Exportar PDF
        </Button>
      </div>

      <div className="flex-1 overflow-auto mt-4">
        {content ? (
          isEditing && onContentChange ? (
            <Textarea
              value={content}
              onChange={(e) => onContentChange(e.target.value)}
              disabled={isStreaming}
              className="min-h-[400px] font-sans text-sm leading-relaxed text-foreground resize-none"
              placeholder="El borrador aparecerá aquí..."
            />
          ) : (
            <div
              ref={contentRef}
              className={`${proseClasses} text-foreground`}
            >
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {content}
              </ReactMarkdown>
            </div>
          )
        ) : (
          <div className="flex items-center gap-2 text-muted-foreground py-8">
            {isStreaming ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Generando borrador...</span>
              </>
            ) : (
              <span>El borrador aparecerá aquí</span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
