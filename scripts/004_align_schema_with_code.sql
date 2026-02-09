-- =============================================================================
-- Align Database Schema with Application Code
-- =============================================================================
-- This migration ensures the database schema matches the TypeScript types
-- used throughout the application.
-- =============================================================================

-- Step 1: Rename 'role' column to 'system_role' in profiles table
DO $$
BEGIN
  -- Check if the old column exists
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'role'
  ) AND NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'system_role'
  ) THEN
    -- Rename the column
    ALTER TABLE public.profiles RENAME COLUMN role TO system_role;
    
    RAISE NOTICE 'Column role renamed to system_role';
  ELSE
    RAISE NOTICE 'Column already renamed or does not exist';
  END IF;
END$$;

-- Step 2: Update indexes
DROP INDEX IF EXISTS idx_profiles_role;
CREATE INDEX IF NOT EXISTS idx_profiles_system_role ON public.profiles(system_role);

-- Step 3: Update RLS policies to use the new column name
-- Drop old policies if they reference 'role'
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;

-- Recreate policies with correct column name
CREATE POLICY "Users can view own profile"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
  ON public.profiles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND system_role = 'admin_general'
    )
  );

CREATE POLICY "Admins can insert profiles"
  ON public.profiles
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND system_role = 'admin_general'
    )
  );

CREATE POLICY "Admins can update all profiles"
  ON public.profiles
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND system_role = 'admin_general'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND system_role = 'admin_general'
    )
  );

-- Step 4: Update trigger function to use system_role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
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
    -- Use role from metadata or default to lawyer_executive
    COALESCE(
      (NEW.raw_user_meta_data->>'system_role')::user_role,
      'lawyer_executive'::user_role
    ),
    true
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    first_name = COALESCE(NULLIF(profiles.first_name, ''), EXCLUDED.first_name),
    last_name = COALESCE(NULLIF(profiles.last_name, ''), EXCLUDED.last_name);

  RETURN NEW;
END;
$$;

-- Ensure trigger exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Step 5: Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON public.profiles TO authenticated;
GRANT ALL ON public.clients TO authenticated;
GRANT ALL ON public.cases TO authenticated;
GRANT ALL ON public.case_assignments TO authenticated;
GRANT ALL ON public.tasks TO authenticated;
GRANT ALL ON public.documents TO authenticated;
GRANT ALL ON public.deadlines TO authenticated;
GRANT ALL ON public.case_notes TO authenticated;
GRANT ALL ON public.activity_log TO authenticated;
