-- Migration 047: Make case_id optional on deadlines (events)
-- Events can now exist without being linked to a case.
-- =============================================================================

BEGIN;

-- 1. Allow case_id to be NULL
ALTER TABLE public.deadlines
  ALTER COLUMN case_id DROP NOT NULL;

-- Update FK to SET NULL on case delete
ALTER TABLE public.deadlines
  DROP CONSTRAINT IF EXISTS deadlines_case_id_fkey;

ALTER TABLE public.deadlines
  ADD CONSTRAINT deadlines_case_id_fkey
  FOREIGN KEY (case_id) REFERENCES public.cases(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.deadlines.case_id IS 'Optional link to a case. NULL = standalone event not tied to any case.';

-- 2. Update organization trigger: when case_id is NULL, get org from created_by
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
      IF NEW.case_id IS NOT NULL THEN
        SELECT organization_id INTO v_org_id FROM public.cases WHERE id = NEW.case_id;
      END IF;
      IF v_org_id IS NULL THEN
        SELECT organization_id INTO v_org_id FROM public.profiles WHERE id = NEW.created_by;
      END IF;
    WHEN 'documents' THEN
      SELECT organization_id INTO v_org_id FROM public.cases WHERE id = NEW.case_id;
    WHEN 'deadlines' THEN
      IF NEW.case_id IS NOT NULL THEN
        SELECT organization_id INTO v_org_id FROM public.cases WHERE id = NEW.case_id;
      END IF;
      IF v_org_id IS NULL THEN
        SELECT organization_id INTO v_org_id FROM public.profiles WHERE id = NEW.created_by;
      END IF;
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

-- 3. Update RLS policies for deadlines (allow case_id IS NULL)
DROP POLICY IF EXISTS "deadlines_select_org" ON public.deadlines;
DROP POLICY IF EXISTS "deadlines_insert_org" ON public.deadlines;
DROP POLICY IF EXISTS "deadlines_update_org" ON public.deadlines;
DROP POLICY IF EXISTS "deadlines_delete_org" ON public.deadlines;

CREATE POLICY "deadlines_select_org" ON public.deadlines
FOR SELECT
USING (
  organization_id = current_user_organization_id()
  AND (
    is_admin()
    OR
    created_by = auth.uid()
    OR
    assigned_to = auth.uid()
    OR
    (case_id IS NOT NULL AND case_id IN (
      SELECT case_id FROM public.case_assignments WHERE user_id = auth.uid()
    ))
    OR
    (
      (auth.jwt() ->> 'system_role') = 'client'
      AND case_id IS NOT NULL
      AND case_id IN (
        SELECT cp.case_id FROM public.case_participants cp
        JOIN public.people p ON p.id = cp.person_id
        WHERE p.portal_user_id = auth.uid()
          AND cp.role = 'client_representative'
          AND cp.is_active = true
          AND cp.organization_id = current_user_organization_id()
      )
    )
  )
);

CREATE POLICY "deadlines_insert_org" ON public.deadlines
FOR INSERT
WITH CHECK (
  organization_id = current_user_organization_id()
  AND (
    is_admin()
    OR
    case_id IS NULL
    OR
    case_id IN (
      SELECT case_id FROM public.case_assignments WHERE user_id = auth.uid()
    )
  )
);

CREATE POLICY "deadlines_update_org" ON public.deadlines
FOR UPDATE
USING (
  organization_id = current_user_organization_id()
  AND (
    is_admin()
    OR
    created_by = auth.uid()
    OR
    assigned_to = auth.uid()
    OR
    (case_id IS NOT NULL AND case_id IN (
      SELECT case_id FROM public.case_assignments
      WHERE user_id = auth.uid() AND case_role = 'leader'
    ))
  )
);

CREATE POLICY "deadlines_delete_org" ON public.deadlines
FOR DELETE
USING (
  organization_id = current_user_organization_id()
  AND (
    is_admin()
    OR
    (case_id IS NULL AND created_by = auth.uid())
    OR
    (case_id IS NOT NULL AND case_id IN (
      SELECT case_id FROM public.case_assignments
      WHERE user_id = auth.uid() AND case_role = 'leader'
    ))
  )
);

COMMIT;
