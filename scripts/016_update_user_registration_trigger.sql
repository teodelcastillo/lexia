-- =============================================================================
-- Migration 016: Update User Registration Trigger for Organizations
-- =============================================================================
-- Updates handle_new_user() trigger to automatically create organizations
-- when a new admin_general user registers, and assign organization_id to
-- all new users based on context.
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. Update handle_new_user() function
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
  user_meta := COALESCE(NEW.raw_user_meta_data, NEW.user_metadata, '{}'::jsonb);

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

    -- Create organization
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
  -- Get the organization_id from the admin who created them
  IF profile_role != 'admin_general' OR org_id IS NULL THEN
    -- Try to get organization_id from the admin who created this user
    -- This works when an admin creates team members via admin panel
    -- We'll need to pass organization_id in metadata or get it from the creating admin's session
    
    -- For now, if no org_id found, we'll leave it NULL and let the application
    -- code handle it (create-team-member action should set it)
    -- OR we can try to get it from a system context if available
    
    -- Check if there's an organization_id in metadata (set by admin when creating user)
    IF user_meta->>'organization_id' IS NOT NULL THEN
      org_id := (user_meta->>'organization_id')::UUID;
    END IF;
  END IF;

  -- Insert profile for new user
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
    org_id,  -- Will be NULL if not set, application code should handle it
    true
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    first_name = COALESCE(NULLIF(profiles.first_name, ''), EXCLUDED.first_name),
    last_name = COALESCE(NULLIF(profiles.last_name, ''), EXCLUDED.last_name),
    system_role = EXCLUDED.system_role,
    organization_id = COALESCE(profiles.organization_id, EXCLUDED.organization_id);

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_new_user() IS 'Creates profile and organization (for admin_general) when new user registers';

COMMIT;
