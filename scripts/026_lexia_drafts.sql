-- =============================================================================
-- Migration 026: Lexia Drafts (Borradores del Redactor)
-- =============================================================================
-- Creates lexia_drafts table for saving and resuming document drafts.
-- Optional case_id for association with a case.
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. Table lexia_drafts
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.lexia_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  case_id UUID REFERENCES public.cases(id) ON DELETE SET NULL,
  document_type TEXT NOT NULL,
  name TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  form_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lexia_drafts_user ON public.lexia_drafts(user_id);
CREATE INDEX IF NOT EXISTS idx_lexia_drafts_case ON public.lexia_drafts(case_id) WHERE case_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_lexia_drafts_org ON public.lexia_drafts(organization_id) WHERE organization_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_lexia_drafts_created ON public.lexia_drafts(created_at DESC);

COMMENT ON TABLE public.lexia_drafts IS 'Saved drafts from Lexia Redactor Juridico for resuming work';
COMMENT ON COLUMN public.lexia_drafts.document_type IS 'demanda, contestacion, apelacion, etc.';
COMMENT ON COLUMN public.lexia_drafts.form_data IS 'Form data used to generate the draft';

-- Updated_at trigger
CREATE TRIGGER update_lexia_drafts_updated_at
  BEFORE UPDATE ON public.lexia_drafts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- 2. Add lexia_drafts to auto_assign_organization_id (extends 022)
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

-- Trigger for lexia_drafts
DROP TRIGGER IF EXISTS auto_assign_org_lexia_drafts ON public.lexia_drafts;
CREATE TRIGGER auto_assign_org_lexia_drafts
  BEFORE INSERT ON public.lexia_drafts
  FOR EACH ROW
  WHEN (NEW.organization_id IS NULL)
  EXECUTE FUNCTION auto_assign_organization_id();

-- =============================================================================
-- 3. RLS Policies
-- =============================================================================
ALTER TABLE public.lexia_drafts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lexia_drafts_select" ON public.lexia_drafts;
CREATE POLICY "lexia_drafts_select" ON public.lexia_drafts
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR (organization_id = current_user_organization_id())
  );

DROP POLICY IF EXISTS "lexia_drafts_insert" ON public.lexia_drafts;
CREATE POLICY "lexia_drafts_insert" ON public.lexia_drafts
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "lexia_drafts_update" ON public.lexia_drafts;
CREATE POLICY "lexia_drafts_update" ON public.lexia_drafts
  FOR UPDATE
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "lexia_drafts_delete" ON public.lexia_drafts;
CREATE POLICY "lexia_drafts_delete" ON public.lexia_drafts
  FOR DELETE
  USING (user_id = auth.uid());

-- =============================================================================
-- 4. Grant permissions
-- =============================================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lexia_drafts TO authenticated;

COMMIT;
