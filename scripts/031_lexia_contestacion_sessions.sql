-- =============================================================================
-- Migration 031: Lexia Contestación Sessions
-- =============================================================================
-- Creates lexia_contestacion_sessions table for the guided contestación de demanda
-- flow. Stores session state (parsed blocks, etc.) for the agent orchestrator.
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. Table lexia_contestacion_sessions
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.lexia_contestacion_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  case_id UUID REFERENCES public.cases(id) ON DELETE SET NULL,
  demanda_raw TEXT,
  demanda_document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
  state JSONB DEFAULT '{}'::jsonb,
  current_step TEXT NOT NULL DEFAULT 'init',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lexia_contestacion_sessions_user ON public.lexia_contestacion_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_lexia_contestacion_sessions_case ON public.lexia_contestacion_sessions(case_id) WHERE case_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_lexia_contestacion_sessions_org ON public.lexia_contestacion_sessions(organization_id) WHERE organization_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_lexia_contestacion_sessions_created ON public.lexia_contestacion_sessions(created_at DESC);

COMMENT ON TABLE public.lexia_contestacion_sessions IS 'Sessions for guided contestación de demanda flow; stores parsed blocks and agent state';
COMMENT ON COLUMN public.lexia_contestacion_sessions.state IS 'Full session state: bloques, tipo_demanda_detectado, etc.';
COMMENT ON COLUMN public.lexia_contestacion_sessions.current_step IS 'Current step: init, parsing, parsed, analyzing, etc.';

-- Updated_at trigger
CREATE TRIGGER update_lexia_contestacion_sessions_updated_at
  BEFORE UPDATE ON public.lexia_contestacion_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- 2. Add lexia_contestacion_sessions to auto_assign_organization_id
-- =============================================================================
CREATE OR REPLACE FUNCTION auto_assign_organization_id()
RETURNS TRIGGER AS $$
DECLARE
  v_org_id UUID;
BEGIN
  CASE TG_TABLE_NAME
    WHEN 'lexia_conversations' THEN
      SELECT organization_id INTO v_org_id FROM public.profiles WHERE id = NEW.user_id;
    WHEN 'lexia_messages' THEN
      SELECT organization_id INTO v_org_id FROM public.lexia_conversations WHERE id = NEW.conversation_id;
    WHEN 'lexia_drafts' THEN
      IF NEW.case_id IS NOT NULL THEN
        SELECT organization_id INTO v_org_id FROM public.cases WHERE id = NEW.case_id;
      END IF;
      IF v_org_id IS NULL THEN
        SELECT organization_id INTO v_org_id FROM public.profiles WHERE id = auth.uid();
      END IF;
    WHEN 'lexia_contestacion_sessions' THEN
      IF NEW.case_id IS NOT NULL THEN
        SELECT organization_id INTO v_org_id FROM public.cases WHERE id = NEW.case_id;
      END IF;
      IF v_org_id IS NULL THEN
        SELECT organization_id INTO v_org_id FROM public.profiles WHERE id = auth.uid();
      END IF;
    WHEN 'people' THEN
      SELECT organization_id INTO v_org_id FROM public.profiles WHERE id = auth.uid();
    WHEN 'companies' THEN
      SELECT organization_id INTO v_org_id FROM public.profiles WHERE id = auth.uid();
    WHEN 'cases' THEN
      IF NEW.company_id IS NOT NULL THEN
        SELECT organization_id INTO v_org_id FROM public.companies WHERE id = NEW.company_id;
      END IF;
      IF v_org_id IS NULL THEN
        SELECT organization_id INTO v_org_id FROM public.profiles WHERE id = auth.uid();
      END IF;
    WHEN 'case_assignments' THEN
      SELECT organization_id INTO v_org_id FROM public.cases WHERE id = NEW.case_id;
    WHEN 'case_participants' THEN
      SELECT organization_id INTO v_org_id FROM public.cases WHERE id = NEW.case_id;
    WHEN 'tasks' THEN
      SELECT organization_id INTO v_org_id FROM public.cases WHERE id = NEW.case_id;
    WHEN 'documents' THEN
      SELECT organization_id INTO v_org_id FROM public.cases WHERE id = NEW.case_id;
    WHEN 'deadlines' THEN
      SELECT organization_id INTO v_org_id FROM public.cases WHERE id = NEW.case_id;
    WHEN 'case_notes' THEN
      SELECT organization_id INTO v_org_id FROM public.cases WHERE id = NEW.case_id;
    WHEN 'activity_log' THEN
      IF NEW.case_id IS NOT NULL THEN
        SELECT organization_id INTO v_org_id FROM public.cases WHERE id = NEW.case_id;
      END IF;
      IF v_org_id IS NULL THEN
        SELECT organization_id INTO v_org_id FROM public.profiles WHERE id = auth.uid();
      END IF;
    WHEN 'notifications' THEN
      SELECT organization_id INTO v_org_id FROM public.profiles WHERE id = NEW.user_id;
    WHEN 'lexia_usage_periods' THEN
      SELECT organization_id INTO v_org_id FROM public.profiles WHERE id = NEW.user_id;
    WHEN 'lexia_usage_log' THEN
      SELECT organization_id INTO v_org_id FROM public.profiles WHERE id = NEW.user_id;
    ELSE
      SELECT organization_id INTO v_org_id FROM public.profiles WHERE id = auth.uid();
  END CASE;

  IF NEW.organization_id IS NULL THEN
    NEW.organization_id = v_org_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for lexia_contestacion_sessions
DROP TRIGGER IF EXISTS auto_assign_org_lexia_contestacion_sessions ON public.lexia_contestacion_sessions;
CREATE TRIGGER auto_assign_org_lexia_contestacion_sessions
  BEFORE INSERT ON public.lexia_contestacion_sessions
  FOR EACH ROW
  WHEN (NEW.organization_id IS NULL)
  EXECUTE FUNCTION auto_assign_organization_id();

-- =============================================================================
-- 3. RLS Policies
-- =============================================================================
ALTER TABLE public.lexia_contestacion_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lexia_contestacion_sessions_select" ON public.lexia_contestacion_sessions;
CREATE POLICY "lexia_contestacion_sessions_select" ON public.lexia_contestacion_sessions
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR (organization_id = current_user_organization_id())
  );

DROP POLICY IF EXISTS "lexia_contestacion_sessions_insert" ON public.lexia_contestacion_sessions;
CREATE POLICY "lexia_contestacion_sessions_insert" ON public.lexia_contestacion_sessions
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "lexia_contestacion_sessions_update" ON public.lexia_contestacion_sessions;
CREATE POLICY "lexia_contestacion_sessions_update" ON public.lexia_contestacion_sessions
  FOR UPDATE
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "lexia_contestacion_sessions_delete" ON public.lexia_contestacion_sessions;
CREATE POLICY "lexia_contestacion_sessions_delete" ON public.lexia_contestacion_sessions
  FOR DELETE
  USING (user_id = auth.uid());

-- =============================================================================
-- 4. Grant permissions
-- =============================================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lexia_contestacion_sessions TO authenticated;

COMMIT;
