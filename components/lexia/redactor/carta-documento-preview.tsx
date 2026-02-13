'use client'

/**
 * Vista previa completa Carta Documento - Formato oficial
 * Replica el layout de la imagen: encabezado (duplicado), lugar/fecha, texto, saludo, firma.
 * Para previsualización en plataforma e impresión en hoja oficio.
 */

import { CartaDocumentoHeader, type CartaDocumentoFormData } from './carta-documento-header'

export interface CartaDocumentoPreviewData extends CartaDocumentoFormData {
  lugar_fecha?: string
  saludo?: string
  apellido_nombres?: string
  documento_tipo?: string
  documento_numero?: string
  dato_adicional?: string
}

interface CartaDocumentoPreviewProps {
  formData: CartaDocumentoPreviewData
  /** Contenido del cuerpo (TEXTO) - generado por la IA o editado */
  bodyContent: string
  /** Reducir fuente para cartas largas */
  reducirFuente?: boolean
  /** Modo impresión (sin bordes decorativos, hoja oficio) */
  printMode?: boolean
  /** Editable: mostrar textarea para el cuerpo */
  editable?: boolean
  onBodyChange?: (content: string) => void
  disabled?: boolean
  className?: string
}

export function CartaDocumentoPreview({
  formData,
  bodyContent,
  reducirFuente = false,
  printMode = false,
  editable = false,
  onBodyChange,
  disabled = false,
  className = '',
}: CartaDocumentoPreviewProps) {
  const fs = reducirFuente ? '11px' : '12px'
  const lineH = reducirFuente ? 1.4 : 1.5

  return (
    <div
      className={`carta-doc-preview ${className}`}
      style={{
        fontFamily: 'Georgia, Times, serif',
        fontSize: fs,
        lineHeight: lineH,
        maxWidth: printMode ? '21.6cm' : '100%',
        margin: printMode ? 0 : '0 auto',
      }}
    >
      <style>{`
        .carta-doc-preview .cd-body { text-align: justify; margin: 1rem 0; white-space: pre-wrap; }
        .carta-doc-preview .cd-body-editable { min-height: 200px; width: 100%; resize: vertical; }
        .carta-doc-preview .cd-right { text-align: right; }
        .carta-doc-preview .cd-firma { margin-top: 1.5rem; }
        @media print {
          .carta-doc-preview { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>

      {/* Encabezado (duplicado como en el formato físico) */}
      <CartaDocumentoHeader
        formData={formData}
        reducirFuente={reducirFuente}
        printMode={printMode}
      />

      <div style={{ marginTop: printMode ? '1.5rem' : '1.2rem' }} />

      {/* Segunda copia del encabezado */}
      <CartaDocumentoHeader
        formData={formData}
        reducirFuente={reducirFuente}
        printMode={printMode}
      />

      <div style={{ marginTop: printMode ? '1.5rem' : '1.2rem' }} />

      {/* Lugar y fecha - alineado a derecha */}
      {formData.lugar_fecha?.trim() && (
        <div className="cd-right" style={{ marginBottom: '1rem' }}>
          {formData.lugar_fecha}
        </div>
      )}

      {/* TEXTO - cuerpo principal */}
      <div className="cd-body">
        {editable && onBodyChange ? (
          <textarea
            className="cd-body-editable rounded border border-input bg-background px-3 py-2 text-sm"
            value={bodyContent}
            onChange={(e) => onBodyChange(e.target.value)}
            disabled={disabled}
            placeholder="Contenido de la carta documento..."
          />
        ) : (
          <div style={{ whiteSpace: 'pre-wrap' }}>{bodyContent || '\u00A0'}</div>
        )}
      </div>

      {/* Saludo - alineado a derecha */}
      {formData.saludo?.trim() && (
        <div className="cd-right" style={{ marginTop: '1rem' }}>
          {formData.saludo}
        </div>
      )}

      {/* Firma: Apellido y Nombres, Documento, Dato adicional */}
      <div className="cd-firma">
        {formData.apellido_nombres?.trim() && (
          <div style={{ fontWeight: 500 }}>{formData.apellido_nombres}</div>
        )}
        {formData.documento_tipo?.trim() && formData.documento_numero?.trim() && (
          <div style={{ marginTop: '0.25rem' }}>
            {formData.documento_tipo} {formData.documento_numero}
          </div>
        )}
        {formData.dato_adicional?.trim() && (
          <div style={{ marginTop: '0.25rem', fontSize: '0.9em' }}>
            {formData.dato_adicional}
          </div>
        )}
      </div>
    </div>
  )
}
