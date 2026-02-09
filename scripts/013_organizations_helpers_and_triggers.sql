-- =============================================================================
-- Migration 013: Organization Helpers and Auto-Assignment Triggers
-- =============================================================================
-- Creates helper functions and triggers to automatically assign organization_id
-- when inserting rows, based on context (user, case, company, etc.)
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. Helper function to get current user's organization_id
-- =============================================================================
CREATE OR REPLACE FUNCTION current_user_organization_id()
RETURNS UUID AS $$
BEGIN
  RETURN (
    SELECT organization_id 
    FROM public.profiles 
    WHERE id = auth.uid()
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION current_user_organization_id() IS 'Returns the organization_id of the currently authenticated user';

-- =============================================================================
-- 2. Function to auto-assign organization_id on INSERT
-- =============================================================================
CREATE OR REPLACE FUNCTION auto_assign_organization_id()
RETURNS TRIGGER AS $$
DECLARE
  v_org_id UUID;
BEGIN
  -- Get organization_id based on table and context
  CASE TG_TABLE_NAME
    -- People: get from creator's profile
    WHEN 'people' THEN
      SELECT organization_id INTO v_org_id
      FROM public.profiles
      WHERE id = auth.uid();
      
    -- Companies: get from creator's profile
    WHEN 'companies' THEN
      SELECT organization_id INTO v_org_id
      FROM public.profiles
      WHERE id = auth.uid();
      
    -- Cases: get from company, fallback to creator's profile
    WHEN 'cases' THEN
      -- Try to get from company first
      IF NEW.company_id IS NOT NULL THEN
        SELECT organization_id INTO v_org_id
        FROM public.companies
        WHERE id = NEW.company_id;
      END IF;
      
      -- Fallback to creator's organization
      IF v_org_id IS NULL THEN
        SELECT organization_id INTO v_org_id
        FROM public.profiles
        WHERE id = auth.uid();
      END IF;
      
    -- Case assignments: get from case
    WHEN 'case_assignments' THEN
      SELECT organization_id INTO v_org_id
      FROM public.cases
      WHERE id = NEW.case_id;
      
    -- Case participants: get from case
    WHEN 'case_participants' THEN
      SELECT organization_id INTO v_org_id
      FROM public.cases
      WHERE id = NEW.case_id;
      
    -- Tasks: get from case
    WHEN 'tasks' THEN
      SELECT organization_id INTO v_org_id
      FROM public.cases
      WHERE id = NEW.case_id;
      
    -- Documents: get from case
    WHEN 'documents' THEN
      SELECT organization_id INTO v_org_id
      FROM public.cases
      WHERE id = NEW.case_id;
      
    -- Deadlines: get from case
    WHEN 'deadlines' THEN
      SELECT organization_id INTO v_org_id
      FROM public.cases
      WHERE id = NEW.case_id;
      
    -- Case notes: get from case
    WHEN 'case_notes' THEN
      SELECT organization_id INTO v_org_id
      FROM public.cases
      WHERE id = NEW.case_id;
      
    -- Activity log: get from case if available, else from user
    WHEN 'activity_log' THEN
      IF NEW.case_id IS NOT NULL THEN
        SELECT organization_id INTO v_org_id
        FROM public.cases
        WHERE id = NEW.case_id;
      END IF;
      
      -- Fallback to user's organization
      IF v_org_id IS NULL THEN
        SELECT organization_id INTO v_org_id
        FROM public.profiles
        WHERE id = auth.uid();
      END IF;
      
    -- Notifications: get from user (notification target)
    WHEN 'notifications' THEN
      SELECT organization_id INTO v_org_id
      FROM public.profiles
      WHERE id = NEW.user_id;
      
    -- Lexia usage: get from user
    WHEN 'lexia_usage_periods' THEN
      SELECT organization_id INTO v_org_id
      FROM public.profiles
      WHERE id = NEW.user_id;
      
    WHEN 'lexia_usage_log' THEN
      SELECT organization_id INTO v_org_id
      FROM public.profiles
      WHERE id = NEW.user_id;
      
    -- Default: get from user's profile
    ELSE
      SELECT organization_id INTO v_org_id
      FROM public.profiles
      WHERE id = auth.uid();
  END CASE;
  
  -- Set organization_id if not already set
  IF NEW.organization_id IS NULL THEN
    NEW.organization_id = v_org_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION auto_assign_organization_id() IS 'Automatically assigns organization_id based on table context (case, company, user, etc.)';

-- =============================================================================
-- 3. Create triggers for all tables
-- =============================================================================

-- People
DROP TRIGGER IF EXISTS auto_assign_org_people ON public.people;
CREATE TRIGGER auto_assign_org_people
  BEFORE INSERT ON public.people
  FOR EACH ROW
  WHEN (NEW.organization_id IS NULL)
  EXECUTE FUNCTION auto_assign_organization_id();

-- Companies
DROP TRIGGER IF EXISTS auto_assign_org_companies ON public.companies;
CREATE TRIGGER auto_assign_org_companies
  BEFORE INSERT ON public.companies
  FOR EACH ROW
  WHEN (NEW.organization_id IS NULL)
  EXECUTE FUNCTION auto_assign_organization_id();

-- Cases
DROP TRIGGER IF EXISTS auto_assign_org_cases ON public.cases;
CREATE TRIGGER auto_assign_org_cases
  BEFORE INSERT ON public.cases
  FOR EACH ROW
  WHEN (NEW.organization_id IS NULL)
  EXECUTE FUNCTION auto_assign_organization_id();

-- Case assignments
DROP TRIGGER IF EXISTS auto_assign_org_case_assignments ON public.case_assignments;
CREATE TRIGGER auto_assign_org_case_assignments
  BEFORE INSERT ON public.case_assignments
  FOR EACH ROW
  WHEN (NEW.organization_id IS NULL)
  EXECUTE FUNCTION auto_assign_organization_id();

-- Case participants
DROP TRIGGER IF EXISTS auto_assign_org_case_participants ON public.case_participants;
CREATE TRIGGER auto_assign_org_case_participants
  BEFORE INSERT ON public.case_participants
  FOR EACH ROW
  WHEN (NEW.organization_id IS NULL)
  EXECUTE FUNCTION auto_assign_organization_id();

-- Tasks
DROP TRIGGER IF EXISTS auto_assign_org_tasks ON public.tasks;
CREATE TRIGGER auto_assign_org_tasks
  BEFORE INSERT ON public.tasks
  FOR EACH ROW
  WHEN (NEW.organization_id IS NULL)
  EXECUTE FUNCTION auto_assign_organization_id();

-- Documents
DROP TRIGGER IF EXISTS auto_assign_org_documents ON public.documents;
CREATE TRIGGER auto_assign_org_documents
  BEFORE INSERT ON public.documents
  FOR EACH ROW
  WHEN (NEW.organization_id IS NULL)
  EXECUTE FUNCTION auto_assign_organization_id();

-- Deadlines
DROP TRIGGER IF EXISTS auto_assign_org_deadlines ON public.deadlines;
CREATE TRIGGER auto_assign_org_deadlines
  BEFORE INSERT ON public.deadlines
  FOR EACH ROW
  WHEN (NEW.organization_id IS NULL)
  EXECUTE FUNCTION auto_assign_organization_id();

-- Case notes
DROP TRIGGER IF EXISTS auto_assign_org_case_notes ON public.case_notes;
CREATE TRIGGER auto_assign_org_case_notes
  BEFORE INSERT ON public.case_notes
  FOR EACH ROW
  WHEN (NEW.organization_id IS NULL)
  EXECUTE FUNCTION auto_assign_organization_id();

-- Activity log
DROP TRIGGER IF EXISTS auto_assign_org_activity_log ON public.activity_log;
CREATE TRIGGER auto_assign_org_activity_log
  BEFORE INSERT ON public.activity_log
  FOR EACH ROW
  WHEN (NEW.organization_id IS NULL)
  EXECUTE FUNCTION auto_assign_organization_id();

-- Notifications
DROP TRIGGER IF EXISTS auto_assign_org_notifications ON public.notifications;
CREATE TRIGGER auto_assign_org_notifications
  BEFORE INSERT ON public.notifications
  FOR EACH ROW
  WHEN (NEW.organization_id IS NULL)
  EXECUTE FUNCTION auto_assign_organization_id();

-- Lexia usage periods
DROP TRIGGER IF EXISTS auto_assign_org_lexia_usage_periods ON public.lexia_usage_periods;
CREATE TRIGGER auto_assign_org_lexia_usage_periods
  BEFORE INSERT ON public.lexia_usage_periods
  FOR EACH ROW
  WHEN (NEW.organization_id IS NULL)
  EXECUTE FUNCTION auto_assign_organization_id();

-- Lexia usage log
DROP TRIGGER IF EXISTS auto_assign_org_lexia_usage_log ON public.lexia_usage_log;
CREATE TRIGGER auto_assign_org_lexia_usage_log
  BEFORE INSERT ON public.lexia_usage_log
  FOR EACH ROW
  WHEN (NEW.organization_id IS NULL)
  EXECUTE FUNCTION auto_assign_organization_id();

COMMIT;
