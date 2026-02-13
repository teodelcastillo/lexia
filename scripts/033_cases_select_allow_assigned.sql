-- =============================================================================
-- Migration 033: Allow users to see cases they are assigned to even when
--                profile.organization_id is NULL (fixes 404 on /casos/[id])
-- =============================================================================
-- When current_user_organization_id() is NULL, the previous policy never
-- matched, so getCaseById always returned null and the app showed 404.
-- This adds an OR branch: if the user has a row in case_assignments for
-- this case, they can SELECT it regardless of organization_id match.
-- =============================================================================

BEGIN;

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
