-- =============================================================================
-- Migration 035: Allow admin_general to see all cases regardless of org
-- =============================================================================
-- When admin's profile.organization_id is NULL or doesn't match the case's
-- organization_id, the previous policy blocked the read. This adds a branch
-- so admin_general can always SELECT cases (fixes /casos/[id] for admins).
-- =============================================================================

BEGIN;

DROP POLICY IF EXISTS "cases_select_org" ON public.cases;

CREATE POLICY "cases_select_org" ON public.cases
FOR SELECT
USING (
  -- Admin can see all cases
  current_user_system_role() = 'admin_general'
  OR
  (
    organization_id = current_user_organization_id()
    AND (
      current_user_system_role() IN ('case_leader', 'lawyer_executive')
      OR
      id IN (
        SELECT case_id
        FROM public.case_assignments
        WHERE user_id = auth.uid()
      )
    )
  )
  OR
  -- Usuarios asignados pueden ver el caso aunque profile.organization_id sea NULL
  id IN (
    SELECT case_id
    FROM public.case_assignments
    WHERE user_id = auth.uid()
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

COMMIT;
