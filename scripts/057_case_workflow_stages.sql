-- =============================================================================
-- Migration 057: Case Workflow — Etapas Procesales
-- =============================================================================
-- Agrega etapas procesales estructuradas a los casos y tablas de reglas
-- para la creación automática de tareas y vencimientos al avanzar etapa.
--
-- Tipos de proceso soportados: ordinario, abreviado, ejecutivo, laboral
-- Basado en CPCC Córdoba (Ley 8465) y Ley Procesal Laboral (Ley 7987).
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. ETAPA EN CASOS
-- =============================================================================

-- Tipo de proceso: determina qué conjunto de etapas y plazos aplica
CREATE TYPE proceso_tipo AS ENUM (
  'ordinario',      -- CPCC: proceso ordinario civil/comercial
  'abreviado',      -- CPCC: proceso abreviado
  'ejecutivo',      -- CPCC: proceso ejecutivo (cobro de pesos, etc.)
  'laboral',        -- Ley 7987: fuero laboral Córdoba
  'familia',        -- Fuero de familia
  'otro'            -- Otros procesos
);

-- Agrega columnas de workflow a casos
ALTER TABLE public.cases
  ADD COLUMN IF NOT EXISTS proceso_tipo      proceso_tipo,
  ADD COLUMN IF NOT EXISTS etapa_actual      TEXT,           -- slug de la etapa actual
  ADD COLUMN IF NOT EXISTS etapa_updated_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS etapa_updated_by  UUID REFERENCES public.profiles(id);

CREATE INDEX IF NOT EXISTS idx_cases_etapa
  ON public.cases(etapa_actual)
  WHERE etapa_actual IS NOT NULL;

-- =============================================================================
-- 2. HISTORIAL DE ETAPAS
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.case_stage_history (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id         UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  etapa           TEXT NOT NULL,
  etapa_label     TEXT NOT NULL,
  notas           TEXT,
  created_by      UUID REFERENCES public.profiles(id),
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_case_stage_history_case
  ON public.case_stage_history(case_id, created_at DESC);

-- RLS: igual que casos — solo miembros de la org
ALTER TABLE public.case_stage_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY case_stage_history_org_select ON public.case_stage_history
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY case_stage_history_org_insert ON public.case_stage_history
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- =============================================================================
-- 3. NOTIFICACIÓN — nueva etapa
-- =============================================================================

INSERT INTO public.notification_types (key, label, description, default_channel)
VALUES (
  'case_stage_advanced',
  'Avance de etapa procesal',
  'Se registró un avance de etapa en un expediente',
  'in_app'
)
ON CONFLICT (key) DO NOTHING;

COMMIT;
