-- =============================================================================
-- Migration 024: Fix case_assignments RLS infinite recursion
-- =============================================================================
-- The case_assignments policies use subqueries that SELECT from case_assignments,
-- causing infinite recursion when evaluating RLS. Fix by using SECURITY DEFINER
-- functions that bypass RLS for the inner checks.
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. Helper functions (SECURITY DEFINER bypasses RLS)
-- =============================================================================

-- Returns case_ids where the current user is assigned (any role)
CREATE OR REPLACE FUNCTION public.user_assigned_case_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT case_id FROM public.case_assignments WHERE user_id = auth.uid()
$$;

-- Returns case_ids where the current user is assigned as leader
-- Uses case_role (from migration 006). If your DB has assignment_role, run that migration first.
CREATE OR REPLACE FUNCTION public.user_leader_case_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT case_id FROM public.case_assignments
  WHERE user_id = auth.uid() AND case_role = 'leader'
$$;

-- =============================================================================
-- 2. Recreate case_assignments policies using the helper functions
-- =============================================================================

DROP POLICY IF EXISTS "case_assignments_select_org" ON public.case_assignments;
DROP POLICY IF EXISTS "case_assignments_insert_org" ON public.case_assignments;
DROP POLICY IF EXISTS "case_assignments_update_org" ON public.case_assignments;
DROP POLICY IF EXISTS "case_assignments_delete_org" ON public.case_assignments;

CREATE POLICY "case_assignments_select_org" ON public.case_assignments
FOR SELECT
USING (
  organization_id = current_user_organization_id()
  AND (
    is_admin()
    OR user_id = auth.uid()
    OR case_id IN (SELECT user_assigned_case_ids())
  )
);

CREATE POLICY "case_assignments_insert_org" ON public.case_assignments
FOR INSERT
WITH CHECK (
  organization_id = current_user_organization_id()
  AND (
    is_admin()
    OR case_id IN (SELECT user_leader_case_ids())
  )
);

CREATE POLICY "case_assignments_update_org" ON public.case_assignments
FOR UPDATE
USING (
  organization_id = current_user_organization_id()
  AND (
    is_admin()
    OR case_id IN (SELECT user_leader_case_ids())
  )
);

CREATE POLICY "case_assignments_delete_org" ON public.case_assignments
FOR DELETE
USING (
  organization_id = current_user_organization_id()
  AND (
    is_admin()
    OR case_id IN (SELECT user_leader_case_ids())
  )
);

COMMIT;
