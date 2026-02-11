-- Migration: Create companies table and rename clients to people
-- This allows people to be linked to companies, and people can represent various roles
-- (clients, judges, opposing lawyers, etc.)

-- Create person_type enum (what role this person plays in the legal context)
CREATE TYPE person_type AS ENUM (
  'client',           -- Cliente del estudio
  'judge',            -- Juez
  'opposing_lawyer',  -- Abogado de la contraparte
  'prosecutor',       -- Fiscal
  'witness',          -- Testigo
  'expert',           -- Perito
  'other'             -- Otro
);

-- Create company_role enum (role within a company)
CREATE TYPE company_role AS ENUM (
  'legal_representative',  -- Representante legal
  'attorney',              -- Apoderado
  'contact',               -- Contacto
  'shareholder',           -- Accionista
  'director',              -- Director
  'other'                  -- Otro
);

-- Create companies table
CREATE TABLE IF NOT EXISTS public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Company details
  company_name TEXT NOT NULL,
  legal_name TEXT,              -- Razón social completa
  cuit TEXT UNIQUE,              -- CUIT para Argentina
  tax_id TEXT,                   -- ID fiscal genérico
  
  -- Contact info
  email TEXT,
  phone TEXT,
  website TEXT,
  
  -- Address
  address TEXT,
  city TEXT,
  province TEXT,
  postal_code TEXT,
  country TEXT DEFAULT 'Argentina',
  
  -- Business info
  industry TEXT,                 -- Rubro/industria
  legal_form TEXT,               -- Forma legal (SA, SRL, etc.)
  
  -- Notes
  notes TEXT,
  
  -- Metadata
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Rename clients table to people
ALTER TABLE public.clients RENAME TO people;

-- Add new columns to people table
ALTER TABLE public.people
  ADD COLUMN IF NOT EXISTS person_type person_type DEFAULT 'client',
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS company_role company_role;

-- Add comment explaining the relationship
COMMENT ON COLUMN public.people.company_id IS 'If this person belongs to a company, reference to that company';
COMMENT ON COLUMN public.people.company_role IS 'Role this person has within the company (if company_id is set)';
COMMENT ON COLUMN public.people.person_type IS 'Type of person in legal context (client, judge, opposing lawyer, etc.)';

-- Update the computed name column to work with renamed table
DROP FUNCTION IF EXISTS get_client_name(UUID) CASCADE;

CREATE OR REPLACE FUNCTION get_person_name(person_id UUID)
RETURNS TEXT AS $$
  SELECT CASE 
    WHEN client_type = 'company' THEN company_name
    ELSE COALESCE(first_name || ' ' || last_name, first_name, last_name)
  END
  FROM public.people
  WHERE id = person_id;
$$ LANGUAGE SQL STABLE;

-- Recreate the generated column with new function name
ALTER TABLE public.people DROP COLUMN IF EXISTS name CASCADE;
ALTER TABLE public.people ADD COLUMN name TEXT GENERATED ALWAYS AS (
  CASE 
    WHEN client_type = 'company' THEN company_name
    ELSE COALESCE(first_name || ' ' || last_name, first_name, last_name)
  END
) STORED;

-- Update foreign key references
-- Cases table references - keep as is but update constraint name
ALTER TABLE public.cases 
  DROP CONSTRAINT IF EXISTS cases_client_id_fkey,
  ADD CONSTRAINT cases_person_id_fkey 
    FOREIGN KEY (client_id) 
    REFERENCES public.people(id) 
    ON DELETE RESTRICT;

-- Add index for company relationships
CREATE INDEX IF NOT EXISTS idx_people_company_id ON public.people(company_id) WHERE company_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_people_person_type ON public.people(person_type);
CREATE INDEX IF NOT EXISTS idx_companies_cuit ON public.companies(cuit) WHERE cuit IS NOT NULL;

-- Enable RLS on companies
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- Companies RLS policies (same as people - admins and internal users can access)
CREATE POLICY "companies_select" ON public.companies
FOR SELECT
USING (
  (auth.jwt() ->> 'system_role' = 'admin_general')
  OR
  (auth.jwt() ->> 'system_role' IN ('case_leader', 'lawyer_executive'))
);

CREATE POLICY "companies_insert" ON public.companies
FOR INSERT
WITH CHECK (
  (auth.jwt() ->> 'system_role' = 'admin_general')
  OR
  (auth.jwt() ->> 'system_role' = 'case_leader')
);

CREATE POLICY "companies_update" ON public.companies
FOR UPDATE
USING (
  (auth.jwt() ->> 'system_role' = 'admin_general')
  OR
  (auth.jwt() ->> 'system_role' = 'case_leader')
);

CREATE POLICY "companies_delete" ON public.companies
FOR DELETE
USING (
  (auth.jwt() ->> 'system_role' = 'admin_general')
);

-- Update RLS policies for people (previously clients)
-- The existing policies should still work, but let's refresh them with the new table name
DROP POLICY IF EXISTS "clients_select" ON public.people;
DROP POLICY IF EXISTS "clients_insert" ON public.people;
DROP POLICY IF EXISTS "clients_update" ON public.people;
DROP POLICY IF EXISTS "clients_delete" ON public.people;

CREATE POLICY "people_select" ON public.people
FOR SELECT
USING (
  (auth.jwt() ->> 'system_role' = 'admin_general')
  OR
  (auth.jwt() ->> 'system_role' IN ('case_leader', 'lawyer_executive'))
);

CREATE POLICY "people_insert" ON public.people
FOR INSERT
WITH CHECK (
  (auth.jwt() ->> 'system_role' = 'admin_general')
  OR
  (auth.jwt() ->> 'system_role' = 'case_leader')
);

CREATE POLICY "people_update" ON public.people
FOR UPDATE
USING (
  (auth.jwt() ->> 'system_role' = 'admin_general')
  OR
  (auth.jwt() ->> 'system_role' = 'case_leader')
);

CREATE POLICY "people_delete" ON public.people
FOR DELETE
USING (
  (auth.jwt() ->> 'system_role' = 'admin_general')
);

-- Add updated_at trigger for companies
CREATE TRIGGER update_companies_updated_at
  BEFORE UPDATE ON public.companies
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Refresh the updated_at trigger for people
DROP TRIGGER IF EXISTS update_clients_updated_at ON public.people;
CREATE TRIGGER update_people_updated_at
  BEFORE UPDATE ON public.people
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create a view to easily get company members
CREATE OR REPLACE VIEW company_members AS
SELECT 
  c.id as company_id,
  c.company_name,
  p.id as person_id,
  p.first_name,
  p.last_name,
  p.email,
  p.phone,
  p.company_role,
  p.person_type
FROM public.companies c
INNER JOIN public.people p ON p.company_id = c.id
WHERE p.is_active = true AND c.is_active = true;

COMMENT ON VIEW company_members IS 'View showing all people associated with companies and their roles';
