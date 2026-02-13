'use client'

import { useState, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Copy, FileDown, FileText, Loader2, Pencil, Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import type { DocumentType } from '@/lib/ai/draft-schemas'
import { CartaDocumentoHeader, type CartaDocumentoFormData } from './carta-documento-header'
import { CartaDocumentoPreview, type CartaDocumentoPreviewData } from './carta-documento-preview'

function buildCartaDocumentoPreviewHtml(
  fd: CartaDocumentoPreviewData,
  bodyContent: string,
  reducirFuente: boolean
): string {
  const esc = (s: string | undefined) =>
    (s || '\u00A0').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const fs = reducirFuente ? '11px' : '12px'
  const headerHtml = buildCartaDocumentoHeaderHtml(fd, reducirFuente, true)
  const lugarFecha = fd.lugar_fecha?.trim()
    ? `<div style="text-align:right;margin-bottom:1rem">${esc(fd.lugar_fecha)}</div>`
    : ''
  const saludo = fd.saludo?.trim()
    ? `<div style="text-align:right;margin-top:1rem">${esc(fd.saludo)}</div>`
    : ''
  const firma = []
  if (fd.apellido_nombres?.trim()) firma.push(`<div style="font-weight:500">${esc(fd.apellido_nombres)}</div>`)
  if (fd.documento_tipo?.trim() && fd.documento_numero?.trim())
    firma.push(`<div style="margin-top:0.25rem">${esc(fd.documento_tipo)} ${esc(fd.documento_numero)}</div>`)
  if (fd.dato_adicional?.trim())
    firma.push(`<div style="margin-top:0.25rem;font-size:0.9em">${esc(fd.dato_adicional)}</div>`)
  const firmaHtml = firma.length ? `<div style="margin-top:1.5rem">${firma.join('')}</div>` : ''

  return `
    ${headerHtml}
    <div style="margin-top:7em;min-height:7em"></div>
    ${headerHtml}
    <div style="margin-top:1.5rem"></div>
    ${lugarFecha}
    <div style="text-align:justify;margin:1rem 0;white-space:pre-wrap;font-family:Georgia,Times,serif;font-size:${fs};line-height:1.5">${esc(bodyContent)}</div>
    ${saludo}
    ${firmaHtml}
  `
}

function buildCartaDocumentoHeaderHtml(
  fd: CartaDocumentoFormData,
  reducirFuente: boolean,
  hideBranding = false
): string {
  const esc = (s: string | undefined) => (s || '\u00A0').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const fs = reducirFuente ? '11px' : '12px'
  const logoBanner = hideBranding
    ? ''
    : `<div class="cd-logo"><strong>CORREO</strong><span style="display:block;font-size:11px">ARGENTINO</span></div>
      <div class="cd-banner">A.R. - CARTA DOCUMENTO</div>`
  const blocksClass = hideBranding ? 'cd-blocks cd-print-form' : 'cd-blocks'
  const remTitle = hideBranding ? '' : '<div class="cd-block-title">Remitente</div>'
  const destTitle = hideBranding ? '' : '<div class="cd-block-title">Destinatario</div>'
  const domicilio = hideBranding ? '' : '<div style="font-size:10px;margin-top:4px;margin-bottom:2px">DOMICILIO</div>'
  const cpLabel = hideBranding ? '' : '<span style="font-size:9px;display:block">CÓDIGO POSTAL</span>'
  const locLabel = hideBranding ? '' : '<span style="font-size:9px;display:block">LOCALIDAD</span>'
  const provLabel = hideBranding ? '' : '<span style="font-size:9px;display:block">PROVINCIA</span>'
  return `
    <div class="cd-print-header" style="font-family:Arial,sans-serif;font-size:${fs};--cd-blue:#1a3a5c;--cd-yellow:#f5e6a3;--cd-border:#b0b0b0;">
      <style>.cd-print-header .cd-logo{background:var(--cd-yellow);padding:6px 10px;display:inline-block}.cd-print-header .cd-banner{background:var(--cd-blue);color:#fff;padding:8px 12px;font-weight:bold;font-size:13px;margin-top:0}.cd-print-header .cd-blocks{display:flex;gap:12px;margin-top:8px}.cd-print-header .cd-block{flex:1;min-width:0}.cd-print-header .cd-block-title{font-size:10px;font-weight:bold;margin-bottom:4px;text-transform:uppercase}.cd-print-header .cd-field{border-bottom:1px solid var(--cd-border);padding:4px 6px;min-height:22px}.cd-print-header .cd-blocks.cd-print-form .cd-field{border:none!important;border-bottom:none!important}.cd-print-header .cd-field-row{display:flex;gap:8px;margin-top:4px}.cd-print-header .cd-field-row .cd-field{flex:1;min-width:0}.cd-print-header .cd-field-row .cd-field:nth-child(1){flex:0 0 70px}.cd-print-header .cd-field-row .cd-field:nth-child(2){flex:1.5}.cd-print-header .cd-field-row .cd-field:nth-child(3){flex:1}@media print{.cd-print-header{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style>
      ${logoBanner}
      <div class="${blocksClass}">
        <div class="cd-block">
          ${remTitle}
          <div class="cd-field">${esc(fd.remitente_linea1)}</div>
          <div class="cd-field">${esc(fd.remitente_linea2)}</div>
          ${domicilio}
          <div class="cd-field">${esc(fd.remitente_domicilio)}</div>
          <div class="cd-field-row">
            <div class="cd-field">${cpLabel}${esc(fd.remitente_codigo_postal)}</div>
            <div class="cd-field">${locLabel}${esc(fd.remitente_localidad)}</div>
            <div class="cd-field">${provLabel}${esc(fd.remitente_provincia)}</div>
          </div>
        </div>
        <div class="cd-block">
          ${destTitle}
          <div class="cd-field">${esc(fd.destinatario_linea1)}</div>
          <div class="cd-field">${esc(fd.destinatario_linea2)}</div>
          ${domicilio}
          <div class="cd-field">${esc(fd.destinatario_domicilio)}</div>
          <div class="cd-field-row">
            <div class="cd-field">${cpLabel}${esc(fd.destinatario_codigo_postal)}</div>
            <div class="cd-field">${locLabel}${esc(fd.destinatario_localidad)}</div>
            <div class="cd-field">${provLabel}${esc(fd.destinatario_provincia)}</div>
          </div>
        </div>
      </div>
    </div>
  `
}

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
  /** Datos del formulario (para carta_documento: encabezado CD oficial) */
  formData?: Record<string, string>
}

export function RedactorDraftView({
  documentType,
  content,
  isStreaming = false,
  onContentChange,
  onSaveClick,
  formData,
}: RedactorDraftViewProps) {
  const cdFormData = documentType === 'carta_documento' && formData
    ? (formData as CartaDocumentoFormData)
    : null
  const reducirFuente = formData?.reducir_fuente === 'true'
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
    const isCartaDoc = documentType === 'carta_documento' && cdFormData
    const bodyHtml = isCartaDoc
      ? buildCartaDocumentoPreviewHtml(
          cdFormData as CartaDocumentoPreviewData,
          content,
          reducirFuente
        )
      : `<pre>${content.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>`
    const pageSize = isCartaDoc ? '21.6cm 33cm' : '21cm 29.7cm'
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${DOCUMENT_TYPE_NAMES[documentType]} - Borrador</title>
          <style>
            @page { size: ${pageSize}; margin: 1.5cm; }
            body { font-family: serif; padding: 1.5cm; line-height: 1.6; max-width: 21.6cm; margin: 0 auto; }
            pre { white-space: pre-wrap; font-family: inherit; margin: 0; }
          </style>
        </head>
        <body>
          ${bodyHtml}
        </body>
      </html>
    `)
    printWindow.document.close()
    printWindow.onload = () => {
      printWindow.print()
      printWindow.onafterprint = () => printWindow.close()
    }
    toast.success(
      isCartaDoc
        ? 'Imprimí sobre el formulario CD (sin logo/banner). Hoja oficio, compará a trasluz.'
        : 'Abre la ventana de impresión y elige "Guardar como PDF"'
    )
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
        {cdFormData && content ? (
          <div className="mb-6 p-6 rounded-lg border border-border bg-background shadow-sm">
            <p className="text-xs text-muted-foreground mb-3 font-medium">
              Vista previa Carta Documento (formato oficial)
            </p>
            <CartaDocumentoPreview
              formData={cdFormData as CartaDocumentoPreviewData}
              bodyContent={content}
              reducirFuente={reducirFuente}
              printMode={false}
              editable={isEditing && !!onContentChange}
              onBodyChange={onContentChange}
              disabled={isStreaming}
            />
          </div>
        ) : content ? (
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
