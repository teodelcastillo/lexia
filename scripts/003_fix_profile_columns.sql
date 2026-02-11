-- =============================================================================
-- Fix Profile Schema - Align column names with codebase
-- =============================================================================
-- This migration renames 'role' to 'system_role' to match application code

-- Rename the column if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'role'
  ) THEN
    ALTER TABLE public.profiles RENAME COLUMN role TO system_role;
    
    -- Update the index name as well
    DROP INDEX IF EXISTS idx_profiles_role;
    CREATE INDEX idx_profiles_system_role ON public.profiles(system_role);
  END IF;
END$$;

-- Create or replace the trigger function for new user profiles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
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
    -- Default to admin_general for first user, lawyer_executive for others
    CASE 
      WHEN NOT EXISTS (SELECT 1 FROM public.profiles LIMIT 1) 
      THEN 'admin_general'::user_role
      ELSE COALESCE(
        (NEW.raw_user_meta_data->>'system_role')::user_role,
        'lawyer_executive'::user_role
      )
    END,
    true
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger to auto-create profile when user signs up
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
