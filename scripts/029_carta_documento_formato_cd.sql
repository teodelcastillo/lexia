-- =============================================================================
-- Migration 029: Carta Documento - Formato Oficial Correo Argentino (CD)
-- =============================================================================
-- Actualiza la plantilla carta_documento para coincidir con el formato oficial
-- de la Carta Documento del Correo Argentino al imprimir.
-- =============================================================================

BEGIN;

UPDATE public.lexia_document_templates
SET
  structure_schema = '{
    "fields": [
      {"key": "remitente_linea1", "label": "REMITENTE (1er línea)", "type": "text", "required": true, "placeholder": "Nombre o razón social"},
      {"key": "remitente_linea2", "label": "2da línea (si no alcanza primera)", "type": "text", "required": false, "placeholder": "Opcional"},
      {"key": "remitente_domicilio", "label": "Domicilio remitente", "type": "text", "required": true},
      {"key": "remitente_codigo_postal", "label": "Código postal remitente", "type": "text", "required": true},
      {"key": "remitente_localidad", "label": "Localidad remitente", "type": "text", "required": true},
      {"key": "remitente_provincia", "label": "Provincia remitente", "type": "text", "required": true},
      {"key": "destinatario_linea1", "label": "DESTINATARIO (1er línea)", "type": "text", "required": true, "placeholder": "Nombre o razón social"},
      {"key": "destinatario_linea2", "label": "2da línea (si no alcanza primera)", "type": "text", "required": false, "placeholder": "Opcional"},
      {"key": "destinatario_domicilio", "label": "Domicilio destinatario", "type": "text", "required": true},
      {"key": "destinatario_codigo_postal", "label": "Código postal destinatario", "type": "text", "required": true},
      {"key": "destinatario_localidad", "label": "Localidad destinatario", "type": "text", "required": true},
      {"key": "destinatario_provincia", "label": "Provincia destinatario", "type": "text", "required": true},
      {"key": "lugar_fecha", "label": "Lugar y fecha (opcional)", "type": "text", "required": false, "placeholder": "Ej: Córdoba, 13 de febrero de 2026"},
      {"key": "texto", "label": "TEXTO", "type": "textarea", "required": true, "placeholder": "Contenido de la carta documento"},
      {"key": "saludo", "label": "Saludo (alineado a derecha)", "type": "text", "required": true, "placeholder": "Ej: Saludo muy atte."},
      {"key": "apellido_nombres", "label": "Apellido y Nombres", "type": "text", "required": true},
      {"key": "documento_tipo", "label": "Tipo de documento", "type": "text", "required": true, "placeholder": "DNI, CUIT, etc."},
      {"key": "documento_numero", "label": "Número de documento", "type": "text", "required": true},
      {"key": "dato_adicional", "label": "Un dato más (opcional)", "type": "text", "required": false, "placeholder": "Ej: Matrícula, teléfono"},
      {"key": "reducir_fuente", "label": "Carta muy larga - reducir tamaño de letra", "type": "checkbox", "required": false, "placeholder": "Marcar si la carta es muy larga. El PDF se imprimirá en hoja oficio."}
    ]
  }'::jsonb,
  template_content = 'REMITENTE
{{remitente_linea1}}
{{remitente_linea2}}
{{remitente_domicilio}}
{{remitente_codigo_postal}} {{remitente_localidad}} {{remitente_provincia}}

DESTINATARIO
{{destinatario_linea1}}
{{destinatario_linea2}}
{{destinatario_domicilio}}
{{destinatario_codigo_postal}} {{destinatario_localidad}} {{destinatario_provincia}}

{{lugar_fecha}}

TEXTO
{{texto}}

{{saludo}}
{{apellido_nombres}}
{{documento_tipo}}: {{documento_numero}}
{{dato_adicional}}',
  system_prompt_fragment = 'CARTA DOCUMENTO - FORMATO OFICIAL CORREO ARGENTINO (CD):

Estructura de salida para impresión en hoja oficio, coincidente con el formato oficial de la Carta Documento:

1. REMITENTE: 1er línea (nombre o razón social), 2da línea si aplica, domicilio, código postal, localidad, provincia.
2. DESTINATARIO: idem con sus datos.
3. LUGAR Y FECHA: opcional, alineado a la derecha como en carta formal.
4. TEXTO: contenido principal del comunicado.
5. SALUDO: alineado a derecha (ej: "Saludo muy atte.").
6. FIRMA: Apellido y Nombres, documento (aclarar tipo: DNI, CUIT, etc.), dato adicional opcional.

Si el usuario marcó "reducir fuente" (carta muy larga), indicar que el documento debe imprimirse en hoja oficio con tamaño de letra reducido. Comparar a trasluz con la CD antes de enviar.

Formato formal, claro, sin abreviaturas innecesarias en el texto principal.'
WHERE document_type = 'carta_documento'
  AND variant = ''
  AND organization_id IS NULL;

COMMIT;
