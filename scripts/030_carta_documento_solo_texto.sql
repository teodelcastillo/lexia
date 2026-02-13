-- =============================================================================
-- Migration 030: Carta Documento - IA genera solo el TEXTO (cuerpo)
-- =============================================================================
-- La previsualización y la impresión componen el documento desde formData + body.
-- La IA debe generar ÚNICAMENTE el contenido legal (el cuerpo del comunicado).
-- =============================================================================

BEGIN;

UPDATE public.lexia_document_templates
SET
  template_content = '{{texto}}',
  system_prompt_fragment = 'CARTA DOCUMENTO - FORMATO OFICIAL CORREO ARGENTINO (CD):

IMPORTANTE: Genera ÚNICAMENTE el TEXTO del comunicado (el contenido legal/formal). No incluyas encabezado, remitente, destinatario, lugar y fecha, saludo ni firma: esos se generan automáticamente desde los datos del formulario.

El texto debe ser:
- Formal y claro
- Párrafos bien estructurados, justificados
- Sin abreviaturas innecesarias
- Contenido legal completo según los datos proporcionados

Si el usuario marcó "reducir fuente" (carta muy larga), el documento se imprimirá en hoja oficio con letra reducida. Comparar a trasluz con la CD antes de enviar.'
WHERE document_type = 'carta_documento'
  AND variant = ''
  AND organization_id IS NULL;

COMMIT;
