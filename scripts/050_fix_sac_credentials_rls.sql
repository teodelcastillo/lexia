-- =============================================================================
-- Migration 050: Fix SAC RLS - system_role not in JWT top level
-- =============================================================================
-- The sac_credentials_insert, sac_movements_insert, and sac_sync_log_insert
-- policies use auth.jwt() ->> 'system_role', but system_role lives in profiles
-- (source of truth), not at JWT top level. Use current_user_system_role()
-- instead (same fix as migration 027 for cases).
-- =============================================================================

BEGIN;

-- ---------- lawyer_sac_credentials ----------
DROP POLICY IF EXISTS "sac_credentials_insert" ON public.lawyer_sac_credentials;

CREATE POLICY "sac_credentials_insert" ON public.lawyer_sac_credentials
FOR INSERT WITH CHECK (
  profile_id = auth.uid()
  AND current_user_system_role() IN ('case_leader', 'lawyer_executive')
);

-- ---------- sac_movements ----------
DROP POLICY IF EXISTS "sac_movements_insert" ON public.sac_movements;

CREATE POLICY "sac_movements_insert" ON public.sac_movements
FOR INSERT WITH CHECK (
  organization_id = current_user_organization_id()
  AND (
    is_admin()
    OR current_user_system_role() IN ('case_leader', 'lawyer_executive')
  )
);

-- ---------- sac_sync_log ----------
DROP POLICY IF EXISTS "sac_sync_log_insert" ON public.sac_sync_log;

CREATE POLICY "sac_sync_log_insert" ON public.sac_sync_log
FOR INSERT WITH CHECK (
  organization_id = current_user_organization_id()
  AND (
    is_admin()
    OR current_user_system_role() IN ('case_leader', 'lawyer_executive')
  )
);

COMMIT;
