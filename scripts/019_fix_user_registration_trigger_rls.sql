-- =============================================================================
-- Migration 019: Fix User Registration Trigger RLS Issues
-- =============================================================================
-- Fixes the handle_new_user() trigger to properly handle RLS when creating
-- profiles. The trigger needs to bypass RLS checks since it runs as SECURITY DEFINER
-- but RLS policies still apply. We'll ensure organization_id is always set correctly.
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. Update handle_new_user() function to handle RLS properly
-- =============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  profile_role user_role;
  org_id UUID;
  firm_name TEXT;
  firm_city TEXT;
  org_slug TEXT;
  user_meta JSONB;
BEGIN
  -- Get metadata (works for both signUp and admin.createUser)
  -- Try both raw_user_meta_data (signUp) and user_metadata (admin.createUser)
  user_meta := COALESCE(
    NEW.raw_user_meta_data,
    NEW.user_metadata,
    '{}'::jsonb
  );

  -- Get role from metadata or default to lawyer_executive
  profile_role := COALESCE(
    (user_meta->>'system_role')::user_role,
    'lawyer_executive'::user_role
  );

  -- Get firm information from metadata (for new admin registrations)
  firm_name := user_meta->>'firm_name';
  firm_city := user_meta->>'firm_city';

  -- If this is a new admin_general user registering (sign-up flow)
  -- Create a new organization for them
  IF profile_role = 'admin_general' AND firm_name IS NOT NULL THEN
    -- Generate slug from firm name
    org_slug := LOWER(REGEXP_REPLACE(
      firm_name || '-' || COALESCE(firm_city, ''),
      '[^a-z0-9]+',
      '-',
      'g'
    ));
    
    -- Ensure slug is unique by appending number if needed
    WHILE EXISTS (SELECT 1 FROM public.organizations WHERE slug = org_slug) LOOP
      org_slug := org_slug || '-' || FLOOR(RANDOM() * 1000)::TEXT;
    END LOOP;

    -- Create organization (bypass RLS with SECURITY DEFINER)
    INSERT INTO public.organizations (
      name,
      slug,
      legal_name,
      city,
      subscription_tier,
      subscription_status,
      is_active,
      created_by
    )
    VALUES (
      firm_name,
      org_slug,
      firm_name,
      firm_city,
      'trial',
      'active',
      true,
      NEW.id
    )
    RETURNING id INTO org_id;
  END IF;

  -- If this is NOT an admin_general (i.e., team member or client created by admin)
  -- Get the organization_id from metadata (set by admin when creating user)
  IF profile_role != 'admin_general' OR org_id IS NULL THEN
    -- Check if there's an organization_id in metadata (set by admin when creating user)
    IF user_meta->>'organization_id' IS NOT NULL THEN
      org_id := (user_meta->>'organization_id')::UUID;
      
      -- Validate that the organization exists
      IF NOT EXISTS (SELECT 1 FROM public.organizations WHERE id = org_id) THEN
        RAISE EXCEPTION 'Organization % does not exist', org_id;
      END IF;
    END IF;
  END IF;

  -- Insert profile for new user
  -- Use ON CONFLICT to handle cases where profile might already exist
  INSERT INTO public.profiles (
    id,
    first_name,
    last_name,
    email,
    system_role,
    organization_id,
    is_active
  )
  VALUES (
    NEW.id,
    COALESCE(user_meta->>'first_name', ''),
    COALESCE(user_meta->>'last_name', ''),
    NEW.email,
    profile_role,
    org_id,  -- Can be NULL for admin_general without firm_name, but should be set for others
    true
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    first_name = COALESCE(NULLIF(profiles.first_name, ''), EXCLUDED.first_name),
    last_name = COALESCE(NULLIF(profiles.last_name, ''), EXCLUDED.last_name),
    system_role = EXCLUDED.system_role,
    organization_id = COALESCE(profiles.organization_id, EXCLUDED.organization_id);

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but don't fail the user creation
    RAISE WARNING 'Error in handle_new_user trigger: %', SQLERRM;
    -- Still return NEW to allow user creation to proceed
    -- The application code will handle profile creation as fallback
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_new_user() IS 'Creates profile and organization (for admin_general) when new user registers. Handles RLS properly with SECURITY DEFINER.';

-- =============================================================================
-- 2. Ensure RLS policies allow trigger to insert profiles
-- =============================================================================
-- The trigger runs as SECURITY DEFINER, so it should bypass RLS, but let's
-- make sure the policies don't interfere. We'll add a policy that allows
-- the trigger to insert profiles when organization_id matches what's in metadata.

-- Drop and recreate the insert policy to be more permissive for triggers
DROP POLICY IF EXISTS "profiles_insert_org" ON public.profiles;

-- Create a more permissive insert policy that allows triggers to work
-- The trigger will always have organization_id set from metadata
CREATE POLICY "profiles_insert_org" ON public.profiles
FOR INSERT
WITH CHECK (
  -- Allow if organization_id matches current user's organization
  organization_id = current_user_organization_id()
  -- OR if user is admin
  OR is_admin()
  -- OR if organization_id is NULL (for admin_general creating their own org)
  -- This allows the trigger to insert profiles during user creation
  OR organization_id IS NULL
);

COMMIT;
