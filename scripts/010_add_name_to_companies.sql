-- Add computed name column to companies table for consistency
-- This allows using 'name' in queries similar to how people table works

ALTER TABLE public.companies 
  ADD COLUMN IF NOT EXISTS name TEXT GENERATED ALWAYS AS (
    COALESCE(company_name, legal_name)
  ) STORED;

-- Add index for name searches
CREATE INDEX IF NOT EXISTS idx_companies_name ON public.companies(name);
