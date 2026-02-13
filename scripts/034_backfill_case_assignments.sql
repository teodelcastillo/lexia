-- =============================================================================
-- Migration 034: Backfill case_assignments for cases without any assignments
-- =============================================================================
-- Assigns the first admin_general of each case's organization as leader for
-- cases that have no rows in case_assignments. This fixes cases created before
-- the CreateCaseForm was updated to auto-assign the creator.
-- =============================================================================

BEGIN;

INSERT INTO public.case_assignments (case_id, user_id, case_role, assigned_by)
SELECT DISTINCT ON (c.id) c.id, p.id, 'leader', p.id
FROM public.cases c
JOIN public.profiles p ON p.organization_id = c.organization_id
  AND p.system_role = 'admin_general'
  AND p.is_active = true
WHERE c.organization_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.case_assignments ca WHERE ca.case_id = c.id
  )
ORDER BY c.id, p.created_at
ON CONFLICT (case_id, user_id) DO NOTHING;

-- For cases with NULL organization_id, try to assign first admin from any org
-- (fallback for legacy data - may need manual review)
INSERT INTO public.case_assignments (case_id, user_id, case_role, assigned_by)
SELECT c.id, p.id, 'leader', p.id
FROM public.cases c
CROSS JOIN LATERAL (
  SELECT id FROM public.profiles
  WHERE system_role = 'admin_general' AND is_active = true
  ORDER BY created_at
  LIMIT 1
) p
WHERE c.organization_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.case_assignments ca WHERE ca.case_id = c.id
  )
ON CONFLICT (case_id, user_id) DO NOTHING;

COMMIT;
