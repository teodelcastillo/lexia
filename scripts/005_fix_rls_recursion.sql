-- =============================================================================
-- Fix RLS Infinite Recursion
-- =============================================================================
-- The previous policies caused infinite recursion because helper functions
-- queried the profiles table, which triggered the same policies again.
-- This script replaces them with direct, non-recursive policies.
-- =============================================================================

-- Drop ALL existing policies and helper functions on profiles
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_internal" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_admin" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;

-- Drop helper functions (we'll recreate them to NOT query profiles directly)
-- CASCADE will also drop all policies that depend on these functions
DROP FUNCTION IF EXISTS is_admin() CASCADE;
DROP FUNCTION IF EXISTS is_internal_user() CASCADE;
DROP FUNCTION IF EXISTS has_case_access(UUID) CASCADE;
DROP FUNCTION IF EXISTS is_case_leader(UUID) CASCADE;
DROP FUNCTION IF EXISTS is_client_for_case(UUID) CASCADE;

-- =============================================================================
-- NEW SIMPLE POLICIES WITHOUT RECURSION
-- =============================================================================

-- Policy 1: Users can ALWAYS view their own profile
CREATE POLICY "profiles_view_own"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Policy 2: Users can ALWAYS update their own profile
CREATE POLICY "profiles_update_own"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Policy 3: Authenticated users can view profiles with role 'admin_general', 'case_leader', or 'lawyer_executive'
-- (This allows internal users to see each other for assignments)
CREATE POLICY "profiles_view_internal"
  ON public.profiles
  FOR SELECT
  USING (
    system_role IN ('admin_general', 'case_leader', 'lawyer_executive')
  );

-- Policy 4: Allow INSERT on profiles (for trigger and signup)
CREATE POLICY "profiles_insert_authenticated"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- =============================================================================
-- RECREATE HELPER FUNCTIONS USING METADATA INSTEAD OF TABLE QUERIES
-- =============================================================================

-- Check if current user is an admin using metadata from auth.users
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN COALESCE(
    (auth.jwt()->>'user_metadata')::jsonb->>'system_role' = 'admin_general',
    false
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Check if current user is an internal user (not a client)
CREATE OR REPLACE FUNCTION is_internal_user()
RETURNS BOOLEAN AS $$
DECLARE
  user_role TEXT;
BEGIN
  user_role := COALESCE((auth.jwt()->>'user_metadata')::jsonb->>'system_role', '');
  RETURN user_role IN ('admin_general', 'case_leader', 'lawyer_executive');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Check if current user has access to a specific case
CREATE OR REPLACE FUNCTION has_case_access(check_case_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  user_role TEXT;
BEGIN
  user_role := COALESCE((auth.jwt()->>'user_metadata')::jsonb->>'system_role', '');
  
  -- Admins have access to all cases
  IF user_role = 'admin_general' THEN
    RETURN true;
  END IF;
  
  -- Check if user is assigned to this case
  RETURN EXISTS (
    SELECT 1 FROM public.case_assignments
    WHERE case_id = check_case_id
    AND user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Check if current user is a leader for a specific case
CREATE OR REPLACE FUNCTION is_case_leader(check_case_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  user_role TEXT;
BEGIN
  user_role := COALESCE((auth.jwt()->>'user_metadata')::jsonb->>'system_role', '');
  
  -- Admins have leader privileges on all cases
  IF user_role = 'admin_general' THEN
    RETURN true;
  END IF;
  
  -- Check if user is assigned as leader to this case
  RETURN EXISTS (
    SELECT 1 FROM public.case_assignments
    WHERE case_id = check_case_id
    AND user_id = auth.uid()
    AND assignment_role = 'leader'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Check if current user is a client with access to a specific case
CREATE OR REPLACE FUNCTION is_client_for_case(check_case_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  user_role TEXT;
BEGIN
  user_role := COALESCE((auth.jwt()->>'user_metadata')::jsonb->>'system_role', '');
  
  -- Only proceed if user is a client
  IF user_role != 'client' THEN
    RETURN false;
  END IF;
  
  RETURN EXISTS (
    SELECT 1 
    FROM public.clients c
    JOIN public.cases ca ON ca.client_id = c.id
    WHERE c.portal_user_id = auth.uid()
    AND ca.id = check_case_id
    AND ca.is_visible_to_client = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- =============================================================================
-- UPDATE TRIGGER TO STORE SYSTEM_ROLE IN USER METADATA
-- =============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  profile_role user_role;
BEGIN
  -- Get role from metadata or default to lawyer_executive
  profile_role := COALESCE(
    (NEW.raw_user_meta_data->>'system_role')::user_role,
    'lawyer_executive'::user_role
  );

  -- Insert profile for new user
  INSERT INTO public.profiles (
    id,
    first_name,
    last_name,
    email,
    system_role,
    is_active
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    NEW.email,
    profile_role,
    true
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    first_name = COALESCE(NULLIF(profiles.first_name, ''), EXCLUDED.first_name),
    last_name = COALESCE(NULLIF(profiles.last_name, ''), EXCLUDED.last_name),
    system_role = EXCLUDED.system_role;

  RETURN NEW;
END;
$$;

-- Ensure trigger exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
