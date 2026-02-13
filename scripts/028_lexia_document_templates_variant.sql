-- =============================================================================
-- Migration 028: Lexia Document Templates - Variant Support
-- =============================================================================
-- Adds variant column to support multiple templates per (org, document_type).
-- variant '' = standard template; incumplimiento_locacion, etc. = demand variants.
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. Add variant column
-- =============================================================================
ALTER TABLE public.lexia_document_templates
  ADD COLUMN IF NOT EXISTS variant TEXT NOT NULL DEFAULT '';

COMMENT ON COLUMN public.lexia_document_templates.variant IS 'Variante de plantilla: incumplimiento_locacion, incumplimiento_compraventa, incumplimiento_suministro, incumplimiento_servicios. Vacío = plantilla estándar.';

-- =============================================================================
-- 2. Drop old unique indexes
-- =============================================================================
DROP INDEX IF EXISTS idx_lexia_doc_templates_uniq_global;
DROP INDEX IF EXISTS idx_lexia_doc_templates_uniq_org;

-- =============================================================================
-- 3. Create new unique indexes including variant
-- =============================================================================
CREATE UNIQUE INDEX IF NOT EXISTS idx_lexia_doc_templates_uniq_global
  ON public.lexia_document_templates (document_type, variant)
  WHERE organization_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_lexia_doc_templates_uniq_org
  ON public.lexia_document_templates (organization_id, document_type, variant)
  WHERE organization_id IS NOT NULL;

-- =============================================================================
-- 4. Seed global templates for demanda incumplimiento variants
-- =============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.lexia_document_templates WHERE document_type = 'demanda' AND variant = 'incumplimiento_locacion' AND organization_id IS NULL) THEN
    INSERT INTO public.lexia_document_templates (
      document_type, name, organization_id, variant, structure_schema, template_content, system_prompt_fragment
    ) VALUES (
      'demanda', 'Demanda - Incumplimiento Locación', NULL, 'incumplimiento_locacion',
      '{"fields":[{"key":"actor","label":"Actor","type":"party","partyPrefix":"actor","partyLabel":"Actor"},{"key":"demandado","label":"Demandado principal","type":"party","partyPrefix":"demandado","partyLabel":"Demandado"},{"key":"garantes","label":"Garantes (si aplica)","type":"textarea","required":false},{"key":"suma_reclamada","label":"Suma total reclamada","type":"text","required":true},{"key":"hechos_relacion_locativa","label":"I. Del inmueble y relación locativa","type":"textarea","required":true},{"key":"hechos_obligaciones","label":"II. Obligaciones contractuales","type":"textarea","required":true},{"key":"hechos_intimacion","label":"III. Intimación y entrega","type":"textarea","required":true},{"key":"hechos_constatacion","label":"IV. Restitución y constatación","type":"textarea","required":true},{"key":"hechos_trabajos","label":"V. Trabajos de reparación","type":"textarea","required":true},{"key":"dano_emergente_detalle","label":"Daño emergente (detalle)","type":"textarea","required":true},{"key":"suma_dano_emergente","label":"Suma daño emergente","type":"text","required":true},{"key":"lucro_cesante_detalle","label":"Lucro cesante (detalle)","type":"textarea","required":false},{"key":"suma_lucro_cesante","label":"Suma lucro cesante","type":"text","required":false},{"key":"prueba_documental","label":"Prueba documental","type":"textarea","required":true},{"key":"prueba_testimonial","label":"Prueba testimonial","type":"textarea","required":false}]}'::jsonb,
      'I. OBJETO\n{{actor}}\n{{demandado}}\n{{garantes}}\nSuma: {{suma_reclamada}}\n\nII. HECHOS\nI. Del inmueble y relación locativa:\n{{hechos_relacion_locativa}}\n\nII. Obligaciones contractuales:\n{{hechos_obligaciones}}\n\nIII. Intimación y entrega:\n{{hechos_intimacion}}\n\nIV. Restitución y constatación:\n{{hechos_constatacion}}\n\nV. Trabajos de reparación:\n{{hechos_trabajos}}\n\nVI. RUBROS RECLAMADOS\nDaño emergente: {{dano_emergente_detalle}}\nSuma: {{suma_dano_emergente}}\n\nLucro cesante: {{lucro_cesante_detalle}}\nSuma: {{suma_lucro_cesante}}\n\nVII. PRUEBA\nDocumental: {{prueba_documental}}\nTestimonial: {{prueba_testimonial}}',
      'DEMANDA DE INCUMPLIMIENTO CONTRACTUAL (LOCACIÓN) - ESTRUCTURA: I. OBJETO (comparecencia, demandados, pretensiones, mediación). II. HECHOS con subsecciones I a V: I) Inmueble y relación locativa; II) Obligaciones contractuales (cláusulas); III) Intimación y entrega de llaves; IV) Restitución y constatación notarial; V) Trabajos de reparación. VI. RUBROS (daño emergente con comprobantes, lucro cesante). VII. PRUEBA (documental, informativa, testimonial, confesional). VIII. RESERVA FEDERAL. IX. PETITORIO. Tono formal, técnico, fundamentado en cláusulas. Citar jurisprudencia cuando aplique (buena fe, fuerza obligatoria).'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.lexia_document_templates WHERE document_type = 'demanda' AND variant = 'incumplimiento_compraventa' AND organization_id IS NULL) THEN
    INSERT INTO public.lexia_document_templates (
      document_type, name, organization_id, variant, structure_schema, template_content, system_prompt_fragment
    ) VALUES (
      'demanda', 'Demanda - Incumplimiento Compraventa', NULL, 'incumplimiento_compraventa',
      '{"fields":[{"key":"actor","label":"Actor","type":"party","partyPrefix":"actor","partyLabel":"Actor"},{"key":"demandado","label":"Demandado principal","type":"party","partyPrefix":"demandado","partyLabel":"Demandado"},{"key":"suma_reclamada","label":"Suma total reclamada","type":"text","required":true},{"key":"hechos_contrato","label":"I. Del contrato y objeto","type":"textarea","required":true},{"key":"hechos_incumplimiento","label":"II. Del incumplimiento (entrega, vicios, garantías)","type":"textarea","required":true},{"key":"hechos_intimacion","label":"III. Intimación y respuesta","type":"textarea","required":true},{"key":"hechos_perjuicios","label":"IV. De los perjuicios ocasionados","type":"textarea","required":true},{"key":"dano_emergente_detalle","label":"Daño emergente (detalle)","type":"textarea","required":true},{"key":"suma_dano_emergente","label":"Suma daño emergente","type":"text","required":true},{"key":"pretension","label":"Pretensión (resolución, devolución, indemnización)","type":"textarea","required":true},{"key":"prueba_documental","label":"Prueba documental","type":"textarea","required":true},{"key":"prueba_testimonial","label":"Prueba testimonial","type":"textarea","required":false}]}'::jsonb,
      'I. OBJETO\n{{actor}}\n{{demandado}}\nSuma: {{suma_reclamada}}\n\nII. HECHOS\nI. Del contrato y objeto:\n{{hechos_contrato}}\n\nII. Del incumplimiento:\n{{hechos_incumplimiento}}\n\nIII. Intimación:\n{{hechos_intimacion}}\n\nIV. Perjuicios:\n{{hechos_perjuicios}}\n\nVI. RUBROS\nDaño emergente: {{dano_emergente_detalle}}\nSuma: {{suma_dano_emergente}}\n\nPretensión: {{pretension}}\n\nVII. PRUEBA\n{{prueba_documental}}\n{{prueba_testimonial}}',
      'DEMANDA DE INCUMPLIMIENTO CONTRACTUAL (COMPRAVENTA) - ESTRUCTURA: I. OBJETO. II. HECHOS: I) Contrato y objeto; II) Incumplimiento (falta de entrega, vicios, garantías); III) Intimación; IV) Perjuicios. VI. RUBROS (daño emergente, resolución, devolución). VII. PRUEBA. VIII. RESERVA FEDERAL. IX. PETITORIO. Foco en incumplimiento de entrega, vicios ocultos o garantías.'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.lexia_document_templates WHERE document_type = 'demanda' AND variant = 'incumplimiento_suministro' AND organization_id IS NULL) THEN
    INSERT INTO public.lexia_document_templates (
      document_type, name, organization_id, variant, structure_schema, template_content, system_prompt_fragment
    ) VALUES (
      'demanda', 'Demanda - Incumplimiento Suministro', NULL, 'incumplimiento_suministro',
      '{"fields":[{"key":"actor","label":"Actor","type":"party","partyPrefix":"actor","partyLabel":"Actor"},{"key":"demandado","label":"Demandado principal","type":"party","partyPrefix":"demandado","partyLabel":"Demandado"},{"key":"suma_reclamada","label":"Suma total reclamada","type":"text","required":true},{"key":"hechos_contrato","label":"I. Del contrato de suministro","type":"textarea","required":true},{"key":"hechos_incumplimiento","label":"II. Del incumplimiento (falta de entrega, calidad)","type":"textarea","required":true},{"key":"hechos_intimacion","label":"III. Intimación y respuesta","type":"textarea","required":true},{"key":"hechos_perjuicios","label":"IV. De los perjuicios","type":"textarea","required":true},{"key":"dano_emergente_detalle","label":"Daño emergente (detalle)","type":"textarea","required":true},{"key":"suma_dano_emergente","label":"Suma daño emergente","type":"text","required":true},{"key":"lucro_cesante_detalle","label":"Lucro cesante (detalle)","type":"textarea","required":false},{"key":"suma_lucro_cesante","label":"Suma lucro cesante","type":"text","required":false},{"key":"prueba_documental","label":"Prueba documental","type":"textarea","required":true},{"key":"prueba_testimonial","label":"Prueba testimonial","type":"textarea","required":false}]}'::jsonb,
      'I. OBJETO\n{{actor}}\n{{demandado}}\nSuma: {{suma_reclamada}}\n\nII. HECHOS\nI. Del contrato de suministro:\n{{hechos_contrato}}\n\nII. Del incumplimiento:\n{{hechos_incumplimiento}}\n\nIII. Intimación:\n{{hechos_intimacion}}\n\nIV. Perjuicios:\n{{hechos_perjuicios}}\n\nVI. RUBROS\nDaño emergente: {{dano_emergente_detalle}}\nLucro cesante: {{lucro_cesante_detalle}}\n\nVII. PRUEBA\n{{prueba_documental}}\n{{prueba_testimonial}}',
      'DEMANDA DE INCUMPLIMIENTO CONTRACTUAL (SUMINISTRO) - ESTRUCTURA: I. OBJETO. II. HECHOS: I) Contrato de suministro; II) Incumplimiento (falta de entrega, calidad defectuosa); III) Intimación; IV) Perjuicios. VI. RUBROS (daño emergente, lucro cesante). VII. PRUEBA. VIII. RESERVA FEDERAL. IX. PETITORIO. Foco en falta de entrega o calidad defectuosa del suministro.'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.lexia_document_templates WHERE document_type = 'demanda' AND variant = 'incumplimiento_servicios' AND organization_id IS NULL) THEN
    INSERT INTO public.lexia_document_templates (
      document_type, name, organization_id, variant, structure_schema, template_content, system_prompt_fragment
    ) VALUES (
      'demanda', 'Demanda - Incumplimiento Servicios', NULL, 'incumplimiento_servicios',
      '{"fields":[{"key":"actor","label":"Actor","type":"party","partyPrefix":"actor","partyLabel":"Actor"},{"key":"demandado","label":"Demandado principal","type":"party","partyPrefix":"demandado","partyLabel":"Demandado"},{"key":"suma_reclamada","label":"Suma total reclamada","type":"text","required":true},{"key":"hechos_contrato","label":"I. Del contrato de prestación de servicios","type":"textarea","required":true},{"key":"hechos_incumplimiento","label":"II. Del incumplimiento o mala ejecución","type":"textarea","required":true},{"key":"hechos_intimacion","label":"III. Intimación y respuesta","type":"textarea","required":true},{"key":"hechos_perjuicios","label":"IV. De los perjuicios","type":"textarea","required":true},{"key":"dano_emergente_detalle","label":"Daño emergente (detalle)","type":"textarea","required":true},{"key":"suma_dano_emergente","label":"Suma daño emergente","type":"text","required":true},{"key":"pretension","label":"Pretensión (indemnización)","type":"textarea","required":true},{"key":"prueba_documental","label":"Prueba documental","type":"textarea","required":true},{"key":"prueba_testimonial","label":"Prueba testimonial","type":"textarea","required":false}]}'::jsonb,
      'I. OBJETO\n{{actor}}\n{{demandado}}\nSuma: {{suma_reclamada}}\n\nII. HECHOS\nI. Del contrato de servicios:\n{{hechos_contrato}}\n\nII. Del incumplimiento:\n{{hechos_incumplimiento}}\n\nIII. Intimación:\n{{hechos_intimacion}}\n\nIV. Perjuicios:\n{{hechos_perjuicios}}\n\nVI. RUBROS\nDaño emergente: {{dano_emergente_detalle}}\nPretensión: {{pretension}}\n\nVII. PRUEBA\n{{prueba_documental}}\n{{prueba_testimonial}}',
      'DEMANDA DE INCUMPLIMIENTO CONTRACTUAL (PRESTACIÓN DE SERVICIOS) - ESTRUCTURA: I. OBJETO. II. HECHOS: I) Contrato de servicios; II) Incumplimiento o mala ejecución; III) Intimación; IV) Perjuicios. VI. RUBROS (daño emergente, indemnización). VII. PRUEBA. VIII. RESERVA FEDERAL. IX. PETITORIO. Foco en incumplimiento o mala ejecución del servicio.'
    );
  END IF;
END;
$$;

COMMIT;
