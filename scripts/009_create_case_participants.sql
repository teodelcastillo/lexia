-- =====================================================
-- Migration 009: Create Case Participants Structure
-- =====================================================
-- This migration restructures cases to relate to companies (not individual clients)
-- and creates a case_participants table for all people involved in the case
-- with specific roles (client representative, opposing lawyer, judge, expert, etc.)

BEGIN;

-- =====================================================
-- 1. Create participant_role enum
-- =====================================================
CREATE TYPE participant_role AS ENUM (
  'client_representative',  -- Representante del cliente (empresa)
  'opposing_party',         -- Parte contraria
  'opposing_lawyer',        -- Abogado de la contraparte
  'judge',                  -- Juez
  'prosecutor',             -- Fiscal
  'expert_witness',         -- Perito
  'witness',                -- Testigo
  'mediator',              -- Mediador
  'court_clerk',           -- Secretario judicial
  'other'                  -- Otro participante
);

COMMENT ON TYPE participant_role IS 'Roles that people can have in a legal case';

-- =====================================================
-- 2. Create case_participants table
-- =====================================================
CREATE TABLE IF NOT EXISTS public.case_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  person_id UUID NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  role participant_role NOT NULL,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Prevent duplicate person-role combinations per case
  UNIQUE(case_id, person_id, role)
);

COMMENT ON TABLE public.case_participants IS 'Links people to cases with specific roles (judge, opposing lawyer, expert, etc.)';
COMMENT ON COLUMN public.case_participants.role IS 'The role this person plays in the case';
COMMENT ON COLUMN public.case_participants.notes IS 'Additional notes about this person''s involvement';
COMMENT ON COLUMN public.case_participants.is_active IS 'Whether this person is still active in the case';

-- Create indexes for performance
CREATE INDEX idx_case_participants_case_id ON public.case_participants(case_id);
CREATE INDEX idx_case_participants_person_id ON public.case_participants(person_id);
CREATE INDEX idx_case_participants_role ON public.case_participants(role);
CREATE INDEX idx_case_participants_active ON public.case_participants(is_active) WHERE is_active = true;

-- Add updated_at trigger
CREATE TRIGGER update_case_participants_updated_at
  BEFORE UPDATE ON public.case_participants
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 3. Modify cases table to reference companies
-- =====================================================
-- Add company_id column (nullable for migration)
ALTER TABLE public.cases 
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL;

-- Create index for company_id
CREATE INDEX IF NOT EXISTS idx_cases_company_id ON public.cases(company_id);

COMMENT ON COLUMN public.cases.company_id IS 'The company (client) this case belongs to';

-- Migrate existing client_id data to case_participants as client representatives
-- Only migrate if client_id exists and points to a person marked as 'client'
INSERT INTO public.case_participants (case_id, person_id, role, notes)
SELECT 
  c.id as case_id,
  c.client_id as person_id,
  'client_representative'::participant_role as role,
  'Migrated from original client_id' as notes
FROM public.cases c
WHERE c.client_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.people p 
    WHERE p.id = c.client_id 
    AND p.person_type = 'client'
  )
ON CONFLICT (case_id, person_id, role) DO NOTHING;

-- Drop dependent policies/indexes first, then drop the client_id column
DROP POLICY IF EXISTS "cases_select_client" ON public.cases;
DROP INDEX IF EXISTS idx_cases_client_id;

-- Now we can drop the old client_id column with CASCADE to remove any remaining dependencies
ALTER TABLE public.cases 
  DROP COLUMN IF EXISTS client_id CASCADE;

-- =====================================================
-- 4. Enable RLS on case_participants
-- =====================================================
ALTER TABLE public.case_participants ENABLE ROW LEVEL SECURITY;

-- Admins can see all participants
CREATE POLICY "case_participants_select_admin" ON public.case_participants
FOR SELECT
USING ((auth.jwt() ->> 'system_role') = 'admin_general');

-- Users can see participants for cases they're assigned to
CREATE POLICY "case_participants_select_assigned" ON public.case_participants
FOR SELECT
USING (
  case_id IN (
    SELECT case_id 
    FROM public.case_assignments 
    WHERE user_id = auth.uid()
  )
);

-- Admins and case leaders can insert participants
CREATE POLICY "case_participants_insert" ON public.case_participants
FOR INSERT
WITH CHECK (
  (auth.jwt() ->> 'system_role') = 'admin_general'
  OR
  case_id IN (
    SELECT case_id 
    FROM public.case_assignments 
    WHERE user_id = auth.uid() 
    AND case_role = 'leader'
  )
);

-- Admins and case leaders can update participants
CREATE POLICY "case_participants_update" ON public.case_participants
FOR UPDATE
USING (
  (auth.jwt() ->> 'system_role') = 'admin_general'
  OR
  case_id IN (
    SELECT case_id 
    FROM public.case_assignments 
    WHERE user_id = auth.uid() 
    AND case_role = 'leader'
  )
);

-- Admins and case leaders can delete participants
CREATE POLICY "case_participants_delete" ON public.case_participants
FOR DELETE
USING (
  (auth.jwt() ->> 'system_role') = 'admin_general'
  OR
  case_id IN (
    SELECT case_id 
    FROM public.case_assignments 
    WHERE user_id = auth.uid() 
    AND case_role = 'leader'
  )
);

-- =====================================================
-- 5. Create a view for easy querying of case participants
-- =====================================================
CREATE OR REPLACE VIEW case_participants_detail AS
SELECT 
  cp.id,
  cp.case_id,
  cp.person_id,
  cp.role,
  cp.notes,
  cp.is_active,
  cp.created_at,
  cp.updated_at,
  p.name as person_name,
  p.email as person_email,
  p.phone as person_phone,
  p.person_type,
  c.case_number,
  c.title as case_title,
  c.status as case_status
FROM public.case_participants cp
JOIN public.people p ON cp.person_id = p.id
JOIN public.cases c ON cp.case_id = c.id;

COMMENT ON VIEW case_participants_detail IS 'Detailed view of case participants with person and case information';

-- Grant permissions on the view
GRANT SELECT ON case_participants_detail TO authenticated;

COMMIT;
