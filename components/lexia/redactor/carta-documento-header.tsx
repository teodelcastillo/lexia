'use client'

/**
 * Encabezado Carta Documento - Formato oficial Correo Argentino
 * Replica el layout del formulario físico para impresión en hoja oficio (21.6 x 33 cm).
 * Los datos deben alinearse a trasluz con la CD del Correo Argentino.
 */

export interface CartaDocumentoFormData {
  remitente_linea1?: string
  remitente_linea2?: string
  remitente_domicilio?: string
  remitente_codigo_postal?: string
  remitente_localidad?: string
  remitente_provincia?: string
  destinatario_linea1?: string
  destinatario_linea2?: string
  destinatario_domicilio?: string
  destinatario_codigo_postal?: string
  destinatario_localidad?: string
  destinatario_provincia?: string
}

interface CartaDocumentoHeaderProps {
  formData: CartaDocumentoFormData
  /** Reducir fuente para cartas largas (imprimir en hoja oficio) */
  reducirFuente?: boolean
  /** Modo impresión: estilos optimizados para PDF/print */
  printMode?: boolean
  /** Ocultar logo y banner (se imprime sobre formulario CD que ya los tiene) */
  hideBranding?: boolean
  className?: string
}

export function CartaDocumentoHeader({
  formData,
  reducirFuente = false,
  printMode = false,
  hideBranding = false,
  className = '',
}: CartaDocumentoHeaderProps) {
  const baseFontSize = reducirFuente ? '11px' : '12px'
  const lineHeight = reducirFuente ? 1.35 : 1.4

  return (
    <div
      className={`cd-header ${className}`}
      style={{
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: baseFontSize,
        lineHeight,
        maxWidth: printMode ? '21.6cm' : '100%',
        margin: printMode ? 0 : '0 auto',
      }}
    >
      <style>{`
        .cd-header {
          --cd-blue: #1a3a5c;
          --cd-blue-light: #2a4a6c;
          --cd-yellow: #f5e6a3;
          --cd-border: #b0b0b0;
          --cd-text: #1a1a1a;
        }
        .cd-header .cd-logo {
          background: var(--cd-yellow);
          padding: 6px 10px;
          display: inline-block;
          margin-bottom: 0;
        }
        .cd-header .cd-logo strong { font-size: 14px; }
        .cd-header .cd-logo span { font-size: 11px; display: block; }
        .cd-header .cd-banner {
          background: var(--cd-blue);
          color: white;
          padding: 8px 12px;
          font-weight: bold;
          font-size: 13px;
          margin-top: 0;
        }
        .cd-header .cd-blocks { display: flex; gap: 12px; margin-top: 8px; }
        .cd-header .cd-block { flex: 1; min-width: 0; }
        .cd-header .cd-block-title { font-size: 10px; font-weight: bold; margin-bottom: 4px; text-transform: uppercase; }
        .cd-header .cd-field { border-bottom: 1px solid var(--cd-border); padding: 4px 6px; min-height: 22px; }
        .cd-header .cd-field-row { display: flex; gap: 8px; margin-top: 4px; }
        .cd-header .cd-field-row .cd-field { flex: 1; min-width: 0; }
        .cd-header .cd-field-row .cd-field:nth-child(1) { flex: 0 0 70px; }
        .cd-header .cd-field-row .cd-field:nth-child(2) { flex: 1.5; }
        .cd-header .cd-field-row .cd-field:nth-child(3) { flex: 1; }
        @media print {
          .cd-header { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>

      {/* Logo y banner (ocultos al imprimir sobre formulario CD) */}
      {!hideBranding && (
        <>
          <div className="cd-logo">
            <strong>CORREO</strong>
            <span>ARGENTINO</span>
          </div>
          <div className="cd-banner">A.R. - CARTA DOCUMENTO</div>
        </>
      )}

      {/* Bloques Remitente | Destinatario */}
      <div className="cd-blocks">
        <div className="cd-block">
          <div className="cd-block-title">Remitente</div>
          <div className="cd-field">{formData.remitente_linea1 || '\u00A0'}</div>
          <div className="cd-field">{formData.remitente_linea2 || '\u00A0'}</div>
          <div style={{ fontSize: '10px', marginTop: '4px', marginBottom: '2px' }}>DOMICILIO</div>
          <div className="cd-field">{formData.remitente_domicilio || '\u00A0'}</div>
          <div className="cd-field-row">
            <div className="cd-field">
              <span style={{ fontSize: '9px', display: 'block' }}>CÓDIGO POSTAL</span>
              {formData.remitente_codigo_postal || '\u00A0'}
            </div>
            <div className="cd-field">
              <span style={{ fontSize: '9px', display: 'block' }}>LOCALIDAD</span>
              {formData.remitente_localidad || '\u00A0'}
            </div>
            <div className="cd-field">
              <span style={{ fontSize: '9px', display: 'block' }}>PROVINCIA</span>
              {formData.remitente_provincia || '\u00A0'}
            </div>
          </div>
        </div>
        <div className="cd-block">
          <div className="cd-block-title">Destinatario</div>
          <div className="cd-field">{formData.destinatario_linea1 || '\u00A0'}</div>
          <div className="cd-field">{formData.destinatario_linea2 || '\u00A0'}</div>
          <div style={{ fontSize: '10px', marginTop: '4px', marginBottom: '2px' }}>DOMICILIO</div>
          <div className="cd-field">{formData.destinatario_domicilio || '\u00A0'}</div>
          <div className="cd-field-row">
            <div className="cd-field">
              <span style={{ fontSize: '9px', display: 'block' }}>CÓDIGO POSTAL</span>
              {formData.destinatario_codigo_postal || '\u00A0'}
            </div>
            <div className="cd-field">
              <span style={{ fontSize: '9px', display: 'block' }}>LOCALIDAD</span>
              {formData.destinatario_localidad || '\u00A0'}
            </div>
            <div className="cd-field">
              <span style={{ fontSize: '9px', display: 'block' }}>PROVINCIA</span>
              {formData.destinatario_provincia || '\u00A0'}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
