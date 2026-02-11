-- ============================================================================
-- Migration 006: Align case_assignments column name with code
-- ============================================================================
-- This migration renames 'assignment_role' back to 'case_role' OR vice versa
-- depending on what the schema currently has vs what the code expects.
--
-- Based on error: column "case_assignments.case_role" does not exist
-- The database has 'assignment_role' but code uses 'case_role'
-- So we rename 'assignment_role' → 'case_role'
-- ============================================================================

-- Actually, let me check: the schema shows assignment_role, code uses case_role
-- So we should keep assignment_role in DB and update all code to use it
-- OR rename assignment_role to case_role in DB

-- Let's do the simpler thing: rename in database to match existing code usage
-- This way we don't have to update 30+ files

-- This statement only works if the column exists
DO $$
BEGIN
  -- Check if assignment_role exists and rename it to case_role
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'case_assignments' 
      AND column_name = 'assignment_role'
  ) THEN
    ALTER TABLE public.case_assignments 
      RENAME COLUMN assignment_role TO case_role;
    
    RAISE NOTICE 'Renamed assignment_role to case_role';
  ELSE
    RAISE NOTICE 'Column assignment_role does not exist, skipping rename';
  END IF;
END $$;

-- Update the check constraint if it exists
DO $$
BEGIN
  -- Drop old constraint if it exists
  IF EXISTS (
    SELECT 1 
    FROM information_schema.table_constraints 
    WHERE constraint_schema = 'public' 
      AND table_name = 'case_assignments' 
      AND constraint_name = 'case_assignments_assignment_role_check'
  ) THEN
    ALTER TABLE public.case_assignments 
      DROP CONSTRAINT case_assignments_assignment_role_check;
    
    RAISE NOTICE 'Dropped old constraint case_assignments_assignment_role_check';
  END IF;
  
  -- Add new constraint with updated column name
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.table_constraints 
    WHERE constraint_schema = 'public' 
      AND table_name = 'case_assignments' 
      AND constraint_name = 'case_assignments_case_role_check'
  ) THEN
    ALTER TABLE public.case_assignments 
      ADD CONSTRAINT case_assignments_case_role_check 
      CHECK (case_role IN ('leader', 'executive'));
    
    RAISE NOTICE 'Added new constraint case_assignments_case_role_check';
  END IF;
END $$;

-- Update index name if needed
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM pg_indexes 
    WHERE schemaname = 'public' 
      AND tablename = 'case_assignments' 
      AND indexname = 'idx_case_assignments_role'
  ) THEN
    DROP INDEX IF EXISTS public.idx_case_assignments_role;
    CREATE INDEX idx_case_assignments_case_role ON public.case_assignments(case_role);
    
    RAISE NOTICE 'Recreated index as idx_case_assignments_case_role';
  END IF;
END $$;
