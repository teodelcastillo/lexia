-- =============================================================================
-- Migration 017: Fix case_number UNIQUE Constraint for Multi-Tenancy
-- =============================================================================
-- Changes case_number from global UNIQUE to unique per organization
-- This allows different organizations to use the same case numbers
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. Check for existing duplicate case_numbers within organizations
-- =============================================================================
-- This query will show if there are any duplicates that need to be resolved
-- before we can create the unique index
DO $$
DECLARE
  duplicate_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO duplicate_count
  FROM (
    SELECT organization_id, case_number, COUNT(*) as cnt
    FROM public.cases
    WHERE organization_id IS NOT NULL
    GROUP BY organization_id, case_number
    HAVING COUNT(*) > 1
  ) duplicates;

  IF duplicate_count > 0 THEN
    RAISE WARNING 'Found % duplicate case_number values within organizations. These must be resolved before applying the unique constraint.', duplicate_count;
    RAISE NOTICE 'Run this query to see duplicates:';
    RAISE NOTICE 'SELECT organization_id, case_number, COUNT(*) FROM public.cases WHERE organization_id IS NOT NULL GROUP BY organization_id, case_number HAVING COUNT(*) > 1;';
  ELSE
    RAISE NOTICE 'No duplicate case_numbers found within organizations. Safe to proceed.';
  END IF;
END $$;

-- =============================================================================
-- 2. Drop the existing UNIQUE constraint on case_number
-- =============================================================================
-- First, try to drop by constraint name (common names)
DO $$
BEGIN
  -- Try common constraint names
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'cases_case_number_key' 
    AND conrelid = 'public.cases'::regclass
  ) THEN
    ALTER TABLE public.cases DROP CONSTRAINT cases_case_number_key;
    RAISE NOTICE 'Dropped constraint cases_case_number_key';
  ELSIF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'cases_case_number_unique' 
    AND conrelid = 'public.cases'::regclass
  ) THEN
    ALTER TABLE public.cases DROP CONSTRAINT cases_case_number_unique;
    RAISE NOTICE 'Dropped constraint cases_case_number_unique';
  ELSE
    -- Try to find and drop any unique constraint on case_number
    DECLARE
      constraint_name TEXT;
    BEGIN
      SELECT conname INTO constraint_name
      FROM pg_constraint
      WHERE conrelid = 'public.cases'::regclass
        AND contype = 'u'
        AND conkey::text LIKE '%case_number%';
      
      IF constraint_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE public.cases DROP CONSTRAINT %I', constraint_name);
        RAISE NOTICE 'Dropped constraint %', constraint_name;
      ELSE
        RAISE NOTICE 'No unique constraint found on case_number column';
      END IF;
    END;
  END IF;
END $$;

-- =============================================================================
-- 3. Create unique index on (organization_id, case_number)
-- =============================================================================
-- This ensures case_number is unique within each organization
-- Note: NULL organization_id values are excluded from the unique constraint
-- (PostgreSQL unique indexes allow multiple NULL values)

-- Drop index if it already exists
DROP INDEX IF EXISTS idx_cases_organization_case_number_unique;

-- Create unique index for non-null organization_id
CREATE UNIQUE INDEX idx_cases_organization_case_number_unique 
ON public.cases(organization_id, case_number)
WHERE organization_id IS NOT NULL;

COMMENT ON INDEX idx_cases_organization_case_number_unique IS 
'Ensures case_number is unique within each organization. Allows different organizations to use the same case numbers.';

-- =============================================================================
-- 4. Add check constraint to ensure organization_id is set for new cases
-- =============================================================================
-- This prevents creating cases without organization_id (except during migration)
-- Note: We use a function-based check that allows NULL for backward compatibility
-- but triggers will auto-assign organization_id

-- Optional: Add a check constraint if you want to enforce organization_id at DB level
-- Uncomment if you want strict enforcement:
/*
ALTER TABLE public.cases
ADD CONSTRAINT cases_organization_id_not_null 
CHECK (organization_id IS NOT NULL);
*/

-- =============================================================================
-- 5. Update the existing index on case_number to be non-unique
-- =============================================================================
-- The existing index idx_cases_number should remain for query performance
-- but it's no longer unique, so we verify it exists and is non-unique

DO $$
BEGIN
  -- Check if idx_cases_number exists and is unique
  IF EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'idx_cases_number' 
    AND schemaname = 'public'
  ) THEN
    -- Check if it's unique
    IF EXISTS (
      SELECT 1 FROM pg_index i
      JOIN pg_class c ON c.oid = i.indexrelid
      WHERE c.relname = 'idx_cases_number'
      AND i.indisunique = true
    ) THEN
      -- Drop and recreate as non-unique
      DROP INDEX IF EXISTS idx_cases_number;
      CREATE INDEX idx_cases_number ON public.cases(case_number);
      RAISE NOTICE 'Recreated idx_cases_number as non-unique index';
    ELSE
      RAISE NOTICE 'idx_cases_number already exists as non-unique index';
    END IF;
  ELSE
    -- Create the index if it doesn't exist
    CREATE INDEX idx_cases_number ON public.cases(case_number);
    RAISE NOTICE 'Created idx_cases_number as non-unique index';
  END IF;
END $$;

COMMIT;

-- =============================================================================
-- Verification Queries
-- =============================================================================
-- Run these after the migration to verify:

-- 1. Check that the unique index exists:
-- SELECT indexname, indexdef 
-- FROM pg_indexes 
-- WHERE tablename = 'cases' 
-- AND indexname = 'idx_cases_organization_case_number_unique';

-- 2. Verify no duplicate case_numbers within organizations:
-- SELECT organization_id, case_number, COUNT(*) 
-- FROM public.cases 
-- WHERE organization_id IS NOT NULL 
-- GROUP BY organization_id, case_number 
-- HAVING COUNT(*) > 1;

-- 3. Test that different organizations can have the same case_number:
-- (This should work after the migration)
-- INSERT INTO public.cases (case_number, title, case_type, company_id, organization_id)
-- VALUES ('TEST-001', 'Test Case 1', 'Civil', '<company_id_org1>', '<org_id_1>');
-- 
-- INSERT INTO public.cases (case_number, title, case_type, company_id, organization_id)
-- VALUES ('TEST-001', 'Test Case 1', 'Civil', '<company_id_org2>', '<org_id_2>');
-- 
-- (Both inserts should succeed)
