-- Migration: Fix Missing Columns
-- Description: Adds missing columns that the application expects
-- 1. Add computed 'name' column to clients table
-- 2. Add 'assigned_to' and 'status' columns to deadlines table

-- ============================================
-- 1. FIX CLIENTS TABLE - ADD NAME COLUMN
-- ============================================

-- Add a generated column that combines first_name + last_name for individuals
-- or uses company_name for companies
ALTER TABLE public.clients
ADD COLUMN IF NOT EXISTS name TEXT GENERATED ALWAYS AS (
  CASE 
    WHEN client_type = 'individual' THEN 
      TRIM(COALESCE(first_name, '') || ' ' || COALESCE(last_name, ''))
    WHEN client_type = 'company' THEN 
      COALESCE(company_name, '')
    ELSE ''
  END
) STORED;

-- Add index on the generated name column for better search performance
CREATE INDEX IF NOT EXISTS idx_clients_name ON public.clients(name);

COMMENT ON COLUMN public.clients.name IS 'Computed full name: first_name + last_name for individuals, company_name for companies';


-- ============================================
-- 2. FIX DEADLINES TABLE - ADD MISSING COLUMNS
-- ============================================

-- Add assigned_to column (who is responsible for this deadline)
ALTER TABLE public.deadlines
ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Add status column for deadline tracking
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'deadline_status') THEN
    CREATE TYPE deadline_status AS ENUM ('pending', 'completed', 'missed', 'cancelled');
  END IF;
END $$;

ALTER TABLE public.deadlines
ADD COLUMN IF NOT EXISTS status deadline_status DEFAULT 'pending' NOT NULL;

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_deadlines_assigned_to ON public.deadlines(assigned_to);
CREATE INDEX IF NOT EXISTS idx_deadlines_status ON public.deadlines(status);
CREATE INDEX IF NOT EXISTS idx_deadlines_due_date_status ON public.deadlines(due_date, status);

COMMENT ON COLUMN public.deadlines.assigned_to IS 'User responsible for this deadline';
COMMENT ON COLUMN public.deadlines.status IS 'Current status of the deadline';


-- ============================================
-- 3. UPDATE RLS POLICIES FOR NEW COLUMNS
-- ============================================

-- Deadlines policies should allow users to see deadlines assigned to them
DROP POLICY IF EXISTS "deadlines_select" ON public.deadlines;

CREATE POLICY "deadlines_select" ON public.deadlines
FOR SELECT
USING (
  -- Admins can see all deadlines
  (auth.jwt() ->> 'system_role' = 'admin_general')
  OR
  -- Internal users can see deadlines for cases they're assigned to
  (
    case_id IN (
      SELECT case_id 
      FROM public.case_assignments 
      WHERE user_id = auth.uid()
    )
  )
  OR
  -- Users can see deadlines assigned to them
  assigned_to = auth.uid()
);


-- ============================================
-- 4. CREATE TRIGGER TO AUTO-UPDATE DEADLINE STATUS
-- ============================================

-- Function to automatically mark deadlines as 'missed' when due date passes
CREATE OR REPLACE FUNCTION public.update_deadline_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- If deadline is past due and still pending, mark as missed
  IF NEW.due_date < CURRENT_DATE AND NEW.status = 'pending' THEN
    NEW.status := 'missed';
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_deadline_status ON public.deadlines;

CREATE TRIGGER trigger_update_deadline_status
BEFORE UPDATE ON public.deadlines
FOR EACH ROW
EXECUTE FUNCTION public.update_deadline_status();

COMMENT ON FUNCTION public.update_deadline_status() IS 'Automatically updates deadline status to missed when due date passes';
