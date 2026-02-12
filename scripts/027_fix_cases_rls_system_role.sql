-- =============================================================================
-- Migration 027: Fix cases RLS - system_role not in JWT top level
-- =============================================================================
-- The cases_insert_org policy uses auth.jwt() ->> 'system_role', but system_role
-- lives in user_metadata, not at JWT top level. Use a helper that reads from
-- profiles (source of truth) instead.
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. Helper: current_user_system_role() - reads from profiles
-- =============================================================================

CREATE OR REPLACE FUNCTION public.current_user_system_role()
RETURNS TEXT AS $$
BEGIN
  RETURN (
    SELECT system_role::text
    FROM public.profiles
    WHERE id = auth.uid()
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public;

COMMENT ON FUNCTION public.current_user_system_role() IS 'Returns system_role of current user from profiles (source of truth)';

-- =============================================================================
-- 2. Recreate cases_insert_org policy using the helper
-- =============================================================================

DROP POLICY IF EXISTS "cases_insert_org" ON public.cases;

CREATE POLICY "cases_insert_org" ON public.cases
FOR INSERT
WITH CHECK (
  organization_id = current_user_organization_id()
  AND (
    current_user_system_role() = 'admin_general'
    OR
    current_user_system_role() = 'case_leader'
  )
);

-- =============================================================================
-- 3. Fix other cases policies that use auth.jwt() ->> 'system_role'
--    (for consistency and to avoid similar issues)
-- =============================================================================

DROP POLICY IF EXISTS "cases_select_org" ON public.cases;

CREATE POLICY "cases_select_org" ON public.cases
FOR SELECT
USING (
  (
    organization_id = current_user_organization_id()
    AND (
      current_user_system_role() = 'admin_general'
      OR
      current_user_system_role() IN ('case_leader', 'lawyer_executive')
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
    current_user_system_role() = 'client'
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

DROP POLICY IF EXISTS "cases_update_org" ON public.cases;

CREATE POLICY "cases_update_org" ON public.cases
FOR UPDATE
USING (
  organization_id = current_user_organization_id()
  AND (
    current_user_system_role() = 'admin_general'
    OR
    id IN (
      SELECT case_id
      FROM public.case_assignments
      WHERE user_id = auth.uid()
      AND case_role = 'leader'
    )
  )
);

COMMIT;
