-- =============================================================================
-- Migration 025: Lexia Document Templates (Redactor Jurídico)
-- =============================================================================
-- Creates lexia_document_templates table for the Document Drafting Studio.
-- Stores templates per document type with structure schemas and prompt fragments.
-- organization_id NULL = global templates available to all orgs.
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. Table lexia_document_templates
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.lexia_document_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL,
  name TEXT NOT NULL,
  structure_schema JSONB DEFAULT '{}'::jsonb,
  template_content TEXT DEFAULT '',
  system_prompt_fragment TEXT DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique: one global template per type (org NULL), one per org per type (org set)
CREATE UNIQUE INDEX IF NOT EXISTS idx_lexia_doc_templates_uniq_global
  ON public.lexia_document_templates (document_type) WHERE organization_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_lexia_doc_templates_uniq_org
  ON public.lexia_document_templates (organization_id, document_type) WHERE organization_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_lexia_doc_templates_org ON public.lexia_document_templates(organization_id);
CREATE INDEX IF NOT EXISTS idx_lexia_doc_templates_type ON public.lexia_document_templates(document_type);
CREATE INDEX IF NOT EXISTS idx_lexia_doc_templates_active ON public.lexia_document_templates(is_active) WHERE is_active = true;

COMMENT ON TABLE public.lexia_document_templates IS 'Templates for legal document types in Lexia Document Drafting Studio';
COMMENT ON COLUMN public.lexia_document_templates.document_type IS 'demanda, contestacion, apelacion, casacion, recurso_extraordinario, contrato, carta_documento, mediacion, oficio_judicial';
COMMENT ON COLUMN public.lexia_document_templates.structure_schema IS 'JSON schema of form fields (partes, hechos, pretension, etc.)';
COMMENT ON COLUMN public.lexia_document_templates.system_prompt_fragment IS 'Document-type-specific system prompt fragment';

-- Updated_at trigger
CREATE TRIGGER update_lexia_document_templates_updated_at
  BEFORE UPDATE ON public.lexia_document_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- 2. RLS Policies
-- =============================================================================
ALTER TABLE public.lexia_document_templates ENABLE ROW LEVEL SECURITY;

-- Users can read templates from their org OR global templates (organization_id IS NULL)
DROP POLICY IF EXISTS "lexia_doc_templates_select" ON public.lexia_document_templates;
CREATE POLICY "lexia_doc_templates_select" ON public.lexia_document_templates
  FOR SELECT
  USING (
    organization_id = current_user_organization_id()
    OR organization_id IS NULL
  );

-- Users can insert org-specific templates (org will be auto-assigned)
DROP POLICY IF EXISTS "lexia_doc_templates_insert" ON public.lexia_document_templates;
CREATE POLICY "lexia_doc_templates_insert" ON public.lexia_document_templates
  FOR INSERT
  WITH CHECK (
    organization_id = current_user_organization_id()
    OR organization_id IS NULL
  );

-- Users can update only their org's templates
DROP POLICY IF EXISTS "lexia_doc_templates_update" ON public.lexia_document_templates;
CREATE POLICY "lexia_doc_templates_update" ON public.lexia_document_templates
  FOR UPDATE
  USING (
    organization_id = current_user_organization_id()
  );

-- Users can delete only their org's templates (not global)
DROP POLICY IF EXISTS "lexia_doc_templates_delete" ON public.lexia_document_templates;
CREATE POLICY "lexia_doc_templates_delete" ON public.lexia_document_templates
  FOR DELETE
  USING (
    organization_id = current_user_organization_id()
  );

-- =============================================================================
-- 3. Seed global templates (organization_id NULL = available to all)
-- =============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.lexia_document_templates WHERE organization_id IS NULL LIMIT 1) THEN
    INSERT INTO public.lexia_document_templates (
      document_type,
      name,
      organization_id,
      structure_schema,
      system_prompt_fragment
    ) VALUES
      (
        'demanda',
        'Demanda',
        NULL,
        '{"fields": ["actor", "demandado", "hechos", "pretension", "fundamento_legal"]}'::jsonb,
        'DEMANDA - ESTRUCTURA: Encabezado (Tribunal, expediente). PARTE ACTORA y PARTE DEMANDADA con datos completos. HECHOS numerados y orden cronológicamente. FUNDAMENTOS citando artículos y normativa (CPCC Córdoba). PETITORIO con pretensiones claras.'
      ),
      (
        'contestacion',
        'Contestación de Demanda',
        NULL,
        '{"fields": ["demandante", "demandado", "hechos_admitidos", "hechos_negados", "defensas", "excepciones"]}'::jsonb,
        'CONTESTACIÓN - ESTRUCTURA: Encabezado. PARTE DEMANDANTE y PARTE DEMANDADA. HECHOS ADMITIDOS y HECHOS NEGADOS. DEFENSAS DE FONDO. EXCEPCIONES (si corresponde). PETITORIO.'
      ),
      (
        'apelacion',
        'Recurso de Apelación',
        NULL,
        '{"fields": ["recurrente", "recurrido", "resolucion_impugnada", "agravios", "fundamento"]}'::jsonb,
        'RECURSO DE APELACIÓN - ESTRUCTURA: Encabezado. PARTE RECURRENTE y RECURRIDA. RESOLUCIÓN IMPUGNADA (fecha, contenido). AGRAVIOS (motivos específicos). FUNDAMENTOS LEGALES. PETITORIO solicitando revocación o reforma.'
      ),
      (
        'casacion',
        'Recurso de Casación',
        NULL,
        '{"fields": ["recurrente", "recurrido", "jurisprudencia_arbitraria", "agravios"]}'::jsonb,
        'RECURSO DE CASACIÓN - ESTRUCTURA: Encabezado. PARTE RECURRENTE y RECURRIDA. Fundamentación de la infringencia (jurisprudencia arbitraria). AGRAVIOS específicos. PETITORIO.'
      ),
      (
        'recurso_extraordinario',
        'Recurso Extraordinario',
        NULL,
        '{"fields": ["recurrente", "recurrido", "federalidad", "gravedad_institucional"]}'::jsonb,
        'RECURSO EXTRAORDINARIO - ESTRUCTURA: Encabezado. Cuestión federal o gravedad institucional. AGRAVIOS. PETITORIO.'
      ),
      (
        'contrato',
        'Contrato',
        NULL,
        '{"fields": ["partes", "objeto", "clausulas_especiales", "plazo", "obligaciones"]}'::jsonb,
        'CONTRATO - ESTRUCTURA: ANTECEDENTES. PARTES CONTRATANTES. OBJETO. OBLIGACIONES DE CADA PARTE. PLAZO. CLAUSULAS ESPECIALES. FIRMAS.'
      ),
      (
        'carta_documento',
        'Carta Documento',
        NULL,
        '{"fields": ["remitente", "destinatario", "contenido", "tipo_notificacion"]}'::jsonb,
        'CARTA DOCUMENTO - ESTRUCTURA: Datos del remitente y destinatario. TIPO DE NOTIFICACIÓN. CONTENIDO del comunicado. Fecha y firma.'
      ),
      (
        'mediacion',
        'Mediación',
        NULL,
        '{"fields": ["partes", "objeto_mediacion", "propuesta"]}'::jsonb,
        'ESCRITO DE MEDIACIÓN - ESTRUCTURA: PARTES. OBJETO de la mediación. PROPUESTA o solicitud. PETITORIO.'
      ),
      (
        'oficio_judicial',
        'Oficio Judicial',
        NULL,
        '{"fields": ["tribunal", "destinatario", "objeto", "fundamento"]}'::jsonb,
        'OFICIO JUDICIAL - ESTRUCTURA: Encabezado (Tribunal, expediente). DESTINATARIO. OBJETO del oficio. FUNDAMENTO. PETITORIO. Firma y sellos.'
      );
  END IF;
END;
$$;

-- =============================================================================
-- 4. Grant permissions
-- =============================================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lexia_document_templates TO authenticated;

COMMIT;
