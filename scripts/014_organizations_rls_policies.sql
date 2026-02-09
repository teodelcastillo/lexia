-- =============================================================================
-- Migration 014: Update RLS Policies for Multi-Tenancy
-- =============================================================================
-- Updates all RLS policies to include organization_id filtering
-- This ensures users can only access data from their own organization
-- =============================================================================

BEGIN;

-- =============================================================================
-- Helper: Update is_admin() function to check organization
-- =============================================================================
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND system_role = 'admin_general'
    AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- =============================================================================
-- 1. Organizations RLS Policies
-- =============================================================================
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- Users can only see their own organization
CREATE POLICY "organizations_select_own" ON public.organizations
FOR SELECT
USING (
  id = current_user_organization_id()
  OR is_admin()
);

-- Only admins can create organizations (or via signup flow)
CREATE POLICY "organizations_insert_admin" ON public.organizations
FOR INSERT
WITH CHECK (is_admin());

-- Only admins can update organizations
CREATE POLICY "organizations_update_admin" ON public.organizations
FOR UPDATE
USING (is_admin());

-- Only admins can delete organizations
CREATE POLICY "organizations_delete_admin" ON public.organizations
FOR DELETE
USING (is_admin());

-- =============================================================================
-- 2. Profiles RLS Policies (Updated)
-- =============================================================================
-- Drop old policies
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update" ON public.profiles;
DROP POLICY IF EXISTS "profiles_delete" ON public.profiles;

-- Users can see profiles from their organization
CREATE POLICY "profiles_select_org" ON public.profiles
FOR SELECT
USING (
  organization_id = current_user_organization_id()
  OR is_admin()
);

-- Users can insert profiles in their organization
CREATE POLICY "profiles_insert_org" ON public.profiles
FOR INSERT
WITH CHECK (
  organization_id = current_user_organization_id()
  OR is_admin()
);

-- Users can update profiles in their organization
CREATE POLICY "profiles_update_org" ON public.profiles
FOR UPDATE
USING (
  organization_id = current_user_organization_id()
  OR is_admin()
);

-- Only admins can delete profiles
CREATE POLICY "profiles_delete_admin" ON public.profiles
FOR DELETE
USING (is_admin());

-- =============================================================================
-- 3. People RLS Policies (Updated)
-- =============================================================================
DROP POLICY IF EXISTS "people_select" ON public.people;
DROP POLICY IF EXISTS "people_insert" ON public.people;
DROP POLICY IF EXISTS "people_update" ON public.people;
DROP POLICY IF EXISTS "people_delete" ON public.people;

CREATE POLICY "people_select_org" ON public.people
FOR SELECT
USING (
  organization_id = current_user_organization_id()
  OR is_admin()
);

CREATE POLICY "people_insert_org" ON public.people
FOR INSERT
WITH CHECK (
  organization_id = current_user_organization_id()
  OR is_admin()
);

CREATE POLICY "people_update_org" ON public.people
FOR UPDATE
USING (
  organization_id = current_user_organization_id()
  OR is_admin()
);

CREATE POLICY "people_delete_org" ON public.people
FOR DELETE
USING (
  organization_id = current_user_organization_id()
  AND is_admin()
);

-- =============================================================================
-- 4. Companies RLS Policies (Updated)
-- =============================================================================
DROP POLICY IF EXISTS "companies_select" ON public.companies;
DROP POLICY IF EXISTS "companies_insert" ON public.companies;
DROP POLICY IF EXISTS "companies_update" ON public.companies;
DROP POLICY IF EXISTS "companies_delete" ON public.companies;

CREATE POLICY "companies_select_org" ON public.companies
FOR SELECT
USING (
  organization_id = current_user_organization_id()
  OR is_admin()
);

CREATE POLICY "companies_insert_org" ON public.companies
FOR INSERT
WITH CHECK (
  organization_id = current_user_organization_id()
  OR is_admin()
);

CREATE POLICY "companies_update_org" ON public.companies
FOR UPDATE
USING (
  organization_id = current_user_organization_id()
  OR is_admin()
);

CREATE POLICY "companies_delete_org" ON public.companies
FOR DELETE
USING (
  organization_id = current_user_organization_id()
  AND is_admin()
);

-- =============================================================================
-- 5. Cases RLS Policies (Updated)
-- =============================================================================
DROP POLICY IF EXISTS "cases_select" ON public.cases;
DROP POLICY IF EXISTS "cases_select_client" ON public.cases;
DROP POLICY IF EXISTS "cases_insert" ON public.cases;
DROP POLICY IF EXISTS "cases_update" ON public.cases;
DROP POLICY IF EXISTS "cases_delete" ON public.cases;

-- Select: Users can see cases from their org, clients can see via case_participants
CREATE POLICY "cases_select_org" ON public.cases
FOR SELECT
USING (
  (
    organization_id = current_user_organization_id()
    AND (
      (auth.jwt() ->> 'system_role') = 'admin_general'
      OR
      (auth.jwt() ->> 'system_role') IN ('case_leader', 'lawyer_executive')
      OR
      -- Users assigned to the case
      id IN (
        SELECT case_id 
        FROM public.case_assignments 
        WHERE user_id = auth.uid()
      )
    )
  )
  OR
  -- Clients can see cases where they are participants
  (
    (auth.jwt() ->> 'system_role') = 'client'
    AND id IN (
      SELECT cp.case_id 
      FROM public.case_participants cp
      JOIN public.people p ON p.id = cp.person_id
      WHERE p.portal_user_id = auth.uid()
        AND cp.role = 'client_representative'
        AND cp.is_active = true
        AND cp.organization_id = current_user_organization_id()
    )
  )
);

CREATE POLICY "cases_insert_org" ON public.cases
FOR INSERT
WITH CHECK (
  organization_id = current_user_organization_id()
  AND (
    (auth.jwt() ->> 'system_role') = 'admin_general'
    OR
    (auth.jwt() ->> 'system_role') = 'case_leader'
  )
);

CREATE POLICY "cases_update_org" ON public.cases
FOR UPDATE
USING (
  organization_id = current_user_organization_id()
  AND (
    (auth.jwt() ->> 'system_role') = 'admin_general'
    OR
    id IN (
      SELECT case_id 
      FROM public.case_assignments 
      WHERE user_id = auth.uid() 
      AND case_role = 'leader'
    )
  )
);

CREATE POLICY "cases_delete_org" ON public.cases
FOR DELETE
USING (
  organization_id = current_user_organization_id()
  AND is_admin()
);

-- =============================================================================
-- 6. Case Assignments RLS Policies (Updated)
-- =============================================================================
DROP POLICY IF EXISTS "case_assignments_select" ON public.case_assignments;
DROP POLICY IF EXISTS "case_assignments_insert" ON public.case_assignments;
DROP POLICY IF EXISTS "case_assignments_update" ON public.case_assignments;
DROP POLICY IF EXISTS "case_assignments_delete" ON public.case_assignments;

CREATE POLICY "case_assignments_select_org" ON public.case_assignments
FOR SELECT
USING (
  organization_id = current_user_organization_id()
  AND (
    is_admin()
    OR
    user_id = auth.uid()
    OR
    case_id IN (
      SELECT case_id 
      FROM public.case_assignments 
      WHERE user_id = auth.uid()
    )
  )
);

CREATE POLICY "case_assignments_insert_org" ON public.case_assignments
FOR INSERT
WITH CHECK (
  organization_id = current_user_organization_id()
  AND (
    is_admin()
    OR
    case_id IN (
      SELECT case_id 
      FROM public.case_assignments 
      WHERE user_id = auth.uid() 
      AND case_role = 'leader'
    )
  )
);

CREATE POLICY "case_assignments_update_org" ON public.case_assignments
FOR UPDATE
USING (
  organization_id = current_user_organization_id()
  AND (
    is_admin()
    OR
    case_id IN (
      SELECT case_id 
      FROM public.case_assignments 
      WHERE user_id = auth.uid() 
      AND case_role = 'leader'
    )
  )
);

CREATE POLICY "case_assignments_delete_org" ON public.case_assignments
FOR DELETE
USING (
  organization_id = current_user_organization_id()
  AND (
    is_admin()
    OR
    case_id IN (
      SELECT case_id 
      FROM public.case_assignments 
      WHERE user_id = auth.uid() 
      AND case_role = 'leader'
    )
  )
);

-- =============================================================================
-- 7. Case Participants RLS Policies (Updated)
-- =============================================================================
DROP POLICY IF EXISTS "case_participants_select_admin" ON public.case_participants;
DROP POLICY IF EXISTS "case_participants_select_assigned" ON public.case_participants;
DROP POLICY IF EXISTS "case_participants_insert" ON public.case_participants;
DROP POLICY IF EXISTS "case_participants_update" ON public.case_participants;
DROP POLICY IF EXISTS "case_participants_delete" ON public.case_participants;

CREATE POLICY "case_participants_select_org" ON public.case_participants
FOR SELECT
USING (
  organization_id = current_user_organization_id()
  AND (
    is_admin()
    OR
    case_id IN (
      SELECT case_id 
      FROM public.case_assignments 
      WHERE user_id = auth.uid()
    )
  )
);

CREATE POLICY "case_participants_insert_org" ON public.case_participants
FOR INSERT
WITH CHECK (
  organization_id = current_user_organization_id()
  AND (
    is_admin()
    OR
    case_id IN (
      SELECT case_id 
      FROM public.case_assignments 
      WHERE user_id = auth.uid() 
      AND case_role = 'leader'
    )
  )
);

CREATE POLICY "case_participants_update_org" ON public.case_participants
FOR UPDATE
USING (
  organization_id = current_user_organization_id()
  AND (
    is_admin()
    OR
    case_id IN (
      SELECT case_id 
      FROM public.case_assignments 
      WHERE user_id = auth.uid() 
      AND case_role = 'leader'
    )
  )
);

CREATE POLICY "case_participants_delete_org" ON public.case_participants
FOR DELETE
USING (
  organization_id = current_user_organization_id()
  AND (
    is_admin()
    OR
    case_id IN (
      SELECT case_id 
      FROM public.case_assignments 
      WHERE user_id = auth.uid() 
      AND case_role = 'leader'
    )
  )
);

-- =============================================================================
-- 8. Tasks RLS Policies (Updated)
-- =============================================================================
DROP POLICY IF EXISTS "tasks_select" ON public.tasks;
DROP POLICY IF EXISTS "tasks_insert" ON public.tasks;
DROP POLICY IF EXISTS "tasks_update" ON public.tasks;
DROP POLICY IF EXISTS "tasks_delete" ON public.tasks;

CREATE POLICY "tasks_select_org" ON public.tasks
FOR SELECT
USING (
  organization_id = current_user_organization_id()
  AND (
    is_admin()
    OR
    assigned_to = auth.uid()
    OR
    case_id IN (
      SELECT case_id 
      FROM public.case_assignments 
      WHERE user_id = auth.uid()
    )
  )
);

CREATE POLICY "tasks_insert_org" ON public.tasks
FOR INSERT
WITH CHECK (
  organization_id = current_user_organization_id()
  AND (
    is_admin()
    OR
    case_id IN (
      SELECT case_id 
      FROM public.case_assignments 
      WHERE user_id = auth.uid()
    )
  )
);

CREATE POLICY "tasks_update_org" ON public.tasks
FOR UPDATE
USING (
  organization_id = current_user_organization_id()
  AND (
    is_admin()
    OR
    assigned_to = auth.uid()
    OR
    case_id IN (
      SELECT case_id 
      FROM public.case_assignments 
      WHERE user_id = auth.uid() 
      AND case_role = 'leader'
    )
  )
);

CREATE POLICY "tasks_delete_org" ON public.tasks
FOR DELETE
USING (
  organization_id = current_user_organization_id()
  AND (
    is_admin()
    OR
    case_id IN (
      SELECT case_id 
      FROM public.case_assignments 
      WHERE user_id = auth.uid() 
      AND case_role = 'leader'
    )
  )
);

-- =============================================================================
-- 9. Documents RLS Policies (Updated)
-- =============================================================================
DROP POLICY IF EXISTS "documents_select" ON public.documents;
DROP POLICY IF EXISTS "documents_insert" ON public.documents;
DROP POLICY IF EXISTS "documents_update" ON public.documents;
DROP POLICY IF EXISTS "documents_delete" ON public.documents;

CREATE POLICY "documents_select_org" ON public.documents
FOR SELECT
USING (
  organization_id = current_user_organization_id()
  AND (
    is_admin()
    OR
    case_id IN (
      SELECT case_id 
      FROM public.case_assignments 
      WHERE user_id = auth.uid()
    )
    OR
    -- Clients can see documents marked as visible
    (
      (auth.jwt() ->> 'system_role') = 'client'
      AND is_visible_to_client = true
      AND case_id IN (
        SELECT cp.case_id 
        FROM public.case_participants cp
        JOIN public.people p ON p.id = cp.person_id
        WHERE p.portal_user_id = auth.uid()
          AND cp.role = 'client_representative'
          AND cp.is_active = true
          AND cp.organization_id = current_user_organization_id()
      )
    )
  )
);

CREATE POLICY "documents_insert_org" ON public.documents
FOR INSERT
WITH CHECK (
  organization_id = current_user_organization_id()
  AND (
    is_admin()
    OR
    case_id IN (
      SELECT case_id 
      FROM public.case_assignments 
      WHERE user_id = auth.uid()
    )
  )
);

CREATE POLICY "documents_update_org" ON public.documents
FOR UPDATE
USING (
  organization_id = current_user_organization_id()
  AND (
    is_admin()
    OR
    case_id IN (
      SELECT case_id 
      FROM public.case_assignments 
      WHERE user_id = auth.uid() 
      AND case_role = 'leader'
    )
  )
);

CREATE POLICY "documents_delete_org" ON public.documents
FOR DELETE
USING (
  organization_id = current_user_organization_id()
  AND (
    is_admin()
    OR
    case_id IN (
      SELECT case_id 
      FROM public.case_assignments 
      WHERE user_id = auth.uid() 
      AND case_role = 'leader'
    )
  )
);

-- =============================================================================
-- 10. Deadlines RLS Policies (Updated)
-- =============================================================================
DROP POLICY IF EXISTS "deadlines_select" ON public.deadlines;
DROP POLICY IF EXISTS "deadlines_insert" ON public.deadlines;
DROP POLICY IF EXISTS "deadlines_update" ON public.deadlines;
DROP POLICY IF EXISTS "deadlines_delete" ON public.deadlines;

CREATE POLICY "deadlines_select_org" ON public.deadlines
FOR SELECT
USING (
  organization_id = current_user_organization_id()
  AND (
    is_admin()
    OR
    created_by = auth.uid()
    OR
    case_id IN (
      SELECT case_id 
      FROM public.case_assignments 
      WHERE user_id = auth.uid()
    )
    OR
    -- Clients can see deadlines for their cases
    (
      (auth.jwt() ->> 'system_role') = 'client'
      AND case_id IN (
        SELECT cp.case_id 
        FROM public.case_participants cp
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
    case_id IN (
      SELECT case_id 
      FROM public.case_assignments 
      WHERE user_id = auth.uid()
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
    case_id IN (
      SELECT case_id 
      FROM public.case_assignments 
      WHERE user_id = auth.uid() 
      AND case_role = 'leader'
    )
  )
);

CREATE POLICY "deadlines_delete_org" ON public.deadlines
FOR DELETE
USING (
  organization_id = current_user_organization_id()
  AND (
    is_admin()
    OR
    case_id IN (
      SELECT case_id 
      FROM public.case_assignments 
      WHERE user_id = auth.uid() 
      AND case_role = 'leader'
    )
  )
);

-- =============================================================================
-- 11. Case Notes RLS Policies (Updated)
-- =============================================================================
DROP POLICY IF EXISTS "case_notes_select" ON public.case_notes;
DROP POLICY IF EXISTS "case_notes_insert" ON public.case_notes;
DROP POLICY IF EXISTS "case_notes_update" ON public.case_notes;
DROP POLICY IF EXISTS "case_notes_delete" ON public.case_notes;

CREATE POLICY "case_notes_select_org" ON public.case_notes
FOR SELECT
USING (
  organization_id = current_user_organization_id()
  AND (
    is_admin()
    OR
    case_id IN (
      SELECT case_id 
      FROM public.case_assignments 
      WHERE user_id = auth.uid()
    )
  )
);

CREATE POLICY "case_notes_insert_org" ON public.case_notes
FOR INSERT
WITH CHECK (
  organization_id = current_user_organization_id()
  AND (
    is_admin()
    OR
    case_id IN (
      SELECT case_id 
      FROM public.case_assignments 
      WHERE user_id = auth.uid()
    )
  )
);

CREATE POLICY "case_notes_update_org" ON public.case_notes
FOR UPDATE
USING (
  organization_id = current_user_organization_id()
  AND (
    is_admin()
    OR
    created_by = auth.uid()
    OR
    case_id IN (
      SELECT case_id 
      FROM public.case_assignments 
      WHERE user_id = auth.uid() 
      AND case_role = 'leader'
    )
  )
);

CREATE POLICY "case_notes_delete_org" ON public.case_notes
FOR DELETE
USING (
  organization_id = current_user_organization_id()
  AND (
    is_admin()
    OR
    created_by = auth.uid()
    OR
    case_id IN (
      SELECT case_id 
      FROM public.case_assignments 
      WHERE user_id = auth.uid() 
      AND case_role = 'leader'
    )
  )
);

-- =============================================================================
-- 12. Activity Log RLS Policies (Updated)
-- =============================================================================
DROP POLICY IF EXISTS "activity_log_select" ON public.activity_log;
DROP POLICY IF EXISTS "activity_log_insert" ON public.activity_log;

CREATE POLICY "activity_log_select_org" ON public.activity_log
FOR SELECT
USING (
  organization_id = current_user_organization_id()
  AND (
    is_admin()
    OR
    user_id = auth.uid()
    OR
    case_id IN (
      SELECT case_id 
      FROM public.case_assignments 
      WHERE user_id = auth.uid()
    )
  )
);

CREATE POLICY "activity_log_insert_org" ON public.activity_log
FOR INSERT
WITH CHECK (
  organization_id = current_user_organization_id()
);

-- =============================================================================
-- 13. Notifications RLS Policies (Updated)
-- =============================================================================
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Authenticated can insert notifications" ON public.notifications;

CREATE POLICY "notifications_select_org" ON public.notifications
FOR SELECT
USING (
  organization_id = current_user_organization_id()
  AND user_id = auth.uid()
);

CREATE POLICY "notifications_update_org" ON public.notifications
FOR UPDATE
USING (
  organization_id = current_user_organization_id()
  AND user_id = auth.uid()
);

CREATE POLICY "notifications_insert_org" ON public.notifications
FOR INSERT
WITH CHECK (
  organization_id = current_user_organization_id()
);

-- =============================================================================
-- 14. Lexia Usage RLS Policies (Updated)
-- =============================================================================
DROP POLICY IF EXISTS "lexia_usage_periods_select" ON public.lexia_usage_periods;
DROP POLICY IF EXISTS "lexia_usage_periods_insert" ON public.lexia_usage_periods;
DROP POLICY IF EXISTS "lexia_usage_log_select" ON public.lexia_usage_log;
DROP POLICY IF EXISTS "lexia_usage_log_insert" ON public.lexia_usage_log;

CREATE POLICY "lexia_usage_periods_select_org" ON public.lexia_usage_periods
FOR SELECT
USING (
  organization_id = current_user_organization_id()
  AND (
    user_id = auth.uid()
    OR is_admin()
  )
);

CREATE POLICY "lexia_usage_periods_insert_org" ON public.lexia_usage_periods
FOR INSERT
WITH CHECK (
  organization_id = current_user_organization_id()
);

CREATE POLICY "lexia_usage_log_select_org" ON public.lexia_usage_log
FOR SELECT
USING (
  organization_id = current_user_organization_id()
  AND (
    user_id = auth.uid()
    OR is_admin()
  )
);

CREATE POLICY "lexia_usage_log_insert_org" ON public.lexia_usage_log
FOR INSERT
WITH CHECK (
  organization_id = current_user_organization_id()
);

COMMIT;
