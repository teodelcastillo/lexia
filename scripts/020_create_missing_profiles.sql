-- =============================================================================
-- Migration 020: Create Missing Profiles for Existing Users
-- =============================================================================
-- Creates profiles for users that exist in auth.users but don't have a profile
-- This fixes the issue where the trigger didn't create profiles during signup
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. Create profiles for users missing from profiles table
-- =============================================================================
-- Get users from auth.users that don't have a profile
INSERT INTO public.profiles (
  id,
  email,
  first_name,
  last_name,
  system_role,
  organization_id,
  is_active
)
SELECT 
  au.id,
  au.email,
  COALESCE(
    (au.raw_user_meta_data->>'first_name'),
    SPLIT_PART(au.email, '@', 1)
  ) as first_name,
  COALESCE(
    (au.raw_user_meta_data->>'last_name'),
    ''
  ) as last_name,
  COALESCE(
    (au.raw_user_meta_data->>'system_role')::user_role,
    'lawyer_executive'::user_role
  ) as system_role,
  -- Try to get organization_id from metadata
  CASE 
    WHEN (au.raw_user_meta_data->>'organization_id') IS NOT NULL THEN
      (au.raw_user_meta_data->>'organization_id')::UUID
    -- If admin_general with firm_name, try to find their organization
    WHEN (au.raw_user_meta_data->>'system_role') = 'admin_general' 
    AND (au.raw_user_meta_data->>'firm_name') IS NOT NULL THEN
      (
        SELECT id 
        FROM public.organizations 
        WHERE created_by = au.id 
        LIMIT 1
      )
    -- Otherwise, assign to default organization
    ELSE
      (SELECT id FROM public.organizations WHERE slug = 'default' LIMIT 1)
  END as organization_id,
  true as is_active
FROM auth.users au
LEFT JOIN public.profiles p ON p.id = au.id
WHERE p.id IS NULL
  AND au.email IS NOT NULL
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- 2. Update profiles that have NULL organization_id
-- =============================================================================
-- Assign default organization to profiles without organization_id
UPDATE public.profiles
SET organization_id = (
  SELECT id FROM public.organizations WHERE slug = 'default' LIMIT 1
)
WHERE organization_id IS NULL
  AND EXISTS (SELECT 1 FROM public.organizations WHERE slug = 'default');

-- =============================================================================
-- 3. For admin_general users, try to assign their own organization
-- =============================================================================
UPDATE public.profiles p
SET organization_id = (
  SELECT id 
  FROM public.organizations o 
  WHERE o.created_by = p.id 
  LIMIT 1
)
WHERE p.system_role = 'admin_general'
  AND p.organization_id IS NULL
  AND EXISTS (
    SELECT 1 
    FROM public.organizations o 
    WHERE o.created_by = p.id
  );

COMMIT;

-- =============================================================================
-- Verification Query (run separately to check results)
-- =============================================================================
-- Check for users without profiles:
-- SELECT au.id, au.email, au.created_at 
-- FROM auth.users au
-- LEFT JOIN public.profiles p ON p.id = au.id
-- WHERE p.id IS NULL;

-- Check for profiles without organization_id:
-- SELECT id, email, system_role, organization_id 
-- FROM public.profiles 
-- WHERE organization_id IS NULL;
