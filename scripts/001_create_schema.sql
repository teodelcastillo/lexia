-- =============================================================================
-- Legal Practice Management System - Database Schema
-- =============================================================================
-- This script creates the complete database structure for a law firm
-- management system with role-based access control (RBAC).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- ENUM TYPES
-- Define enumeration types for consistent data across the application
-- -----------------------------------------------------------------------------

-- User roles within the organization
CREATE TYPE user_role AS ENUM (
  'admin_general',      -- Full access to all modules and settings
  'case_leader',        -- Full access only to assigned cases
  'lawyer_executive',   -- Access to assigned cases and tasks only
  'client'              -- Read-only access to own case status
);

-- Status tracking for cases
CREATE TYPE case_status AS ENUM (
  'active',             -- Case is currently being worked on
  'pending',            -- Awaiting action or response
  'on_hold',            -- Temporarily paused
  'closed',             -- Case completed
  'archived'            -- Historical record, no longer active
);

-- Priority levels for tasks
CREATE TYPE task_priority AS ENUM (
  'urgent',             -- Immediate attention required
  'high',               -- Important, needs attention soon
  'medium',             -- Standard priority
  'low'                 -- Can be addressed when time permits
);

-- Task completion status
CREATE TYPE task_status AS ENUM (
  'pending',            -- Not yet started
  'in_progress',        -- Currently being worked on
  'under_review',       -- Completed, awaiting review
  'completed',          -- Finished and approved
  'cancelled'           -- No longer needed
);

-- Document categories for organization
CREATE TYPE document_category AS ENUM (
  'contract',           -- Legal contracts and agreements
  'court_filing',       -- Court submissions and filings
  'correspondence',     -- Letters and communications
  'evidence',           -- Supporting evidence and exhibits
  'internal_memo',      -- Internal notes and memos
  'client_document',    -- Documents provided by client
  'other'               -- Miscellaneous documents
);

-- -----------------------------------------------------------------------------
-- PROFILES TABLE
-- Extends auth.users with application-specific user data
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  -- Primary key references Supabase auth.users
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Personal information
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  
  -- Professional information
  role user_role NOT NULL DEFAULT 'lawyer_executive',
  title TEXT,                    -- Job title (e.g., "Senior Partner")
  bar_number TEXT,               -- Professional license number
  
  -- Status and metadata
  is_active BOOLEAN NOT NULL DEFAULT true,
  avatar_url TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for faster role-based queries
CREATE INDEX idx_profiles_role ON public.profiles(role);
CREATE INDEX idx_profiles_email ON public.profiles(email);
CREATE INDEX idx_profiles_active ON public.profiles(is_active) WHERE is_active = true;

-- -----------------------------------------------------------------------------
-- CLIENTS TABLE
-- Stores information about the law firm's clients
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Client identification
  client_type TEXT NOT NULL CHECK (client_type IN ('individual', 'company')),
  
  -- For individuals
  first_name TEXT,
  last_name TEXT,
  dni TEXT,                      -- Argentine national ID (DNI)
  
  -- For companies
  company_name TEXT,
  cuit TEXT,                     -- Argentine tax ID (CUIT)
  legal_representative TEXT,
  
  -- Contact information
  email TEXT NOT NULL,
  phone TEXT,
  secondary_phone TEXT,
  address TEXT,
  city TEXT DEFAULT 'Córdoba',
  province TEXT DEFAULT 'Córdoba',
  postal_code TEXT,
  
  -- Portal access (links to profiles for client portal)
  portal_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  
  -- Notes and metadata
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Ensure either individual or company fields are populated
  CONSTRAINT valid_client_data CHECK (
    (client_type = 'individual' AND first_name IS NOT NULL AND last_name IS NOT NULL) OR
    (client_type = 'company' AND company_name IS NOT NULL)
  )
);

-- Indexes for common queries
CREATE INDEX idx_clients_email ON public.clients(email);
CREATE INDEX idx_clients_type ON public.clients(client_type);
CREATE INDEX idx_clients_portal_user ON public.clients(portal_user_id) WHERE portal_user_id IS NOT NULL;
CREATE INDEX idx_clients_active ON public.clients(is_active) WHERE is_active = true;

-- -----------------------------------------------------------------------------
-- CASES TABLE
-- Core table for legal cases/matters
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Case identification
  case_number TEXT NOT NULL UNIQUE,    -- Internal reference number
  court_number TEXT,                    -- Official court case number
  title TEXT NOT NULL,                  -- Descriptive case title
  
  -- Case details
  description TEXT,
  case_type TEXT NOT NULL,              -- e.g., "Civil", "Criminal", "Labor"
  jurisdiction TEXT,                     -- Court/jurisdiction handling the case
  court_name TEXT,
  
  -- Relationships
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  opposing_party TEXT,
  opposing_counsel TEXT,
  
  -- Status tracking
  status case_status NOT NULL DEFAULT 'active',
  
  -- Important dates
  filing_date DATE,
  next_hearing_date TIMESTAMPTZ,
  statute_of_limitations DATE,
  
  -- Financial
  estimated_value DECIMAL(15, 2),
  fee_arrangement TEXT,                 -- e.g., "Hourly", "Contingency", "Fixed"
  
  -- Metadata
  is_visible_to_client BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX idx_cases_client ON public.cases(client_id);
CREATE INDEX idx_cases_status ON public.cases(status);
CREATE INDEX idx_cases_number ON public.cases(case_number);
CREATE INDEX idx_cases_next_hearing ON public.cases(next_hearing_date) WHERE next_hearing_date IS NOT NULL;

-- -----------------------------------------------------------------------------
-- CASE_ASSIGNMENTS TABLE
-- Maps users to cases with specific roles (contextual permissions)
-- A user can be a leader in one case and an executive in another
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.case_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Assignment relationship
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  -- Role within this specific case
  assignment_role TEXT NOT NULL CHECK (assignment_role IN ('leader', 'executive')),
  
  -- Additional context
  assigned_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  notes TEXT,
  
  -- Timestamps
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Ensure unique user-case combination
  CONSTRAINT unique_case_user UNIQUE (case_id, user_id)
);

-- Indexes for faster lookups
CREATE INDEX idx_case_assignments_case ON public.case_assignments(case_id);
CREATE INDEX idx_case_assignments_user ON public.case_assignments(user_id);
CREATE INDEX idx_case_assignments_role ON public.case_assignments(assignment_role);

-- -----------------------------------------------------------------------------
-- TASKS TABLE
-- Task management for cases
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Task details
  title TEXT NOT NULL,
  description TEXT,
  
  -- Relationships
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  
  -- Status and priority
  status task_status NOT NULL DEFAULT 'pending',
  priority task_priority NOT NULL DEFAULT 'medium',
  
  -- Scheduling
  due_date TIMESTAMPTZ,
  reminder_date TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  -- Google Calendar integration
  google_calendar_event_id TEXT,
  
  -- Metadata
  estimated_hours DECIMAL(5, 2),
  actual_hours DECIMAL(5, 2),
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX idx_tasks_case ON public.tasks(case_id);
CREATE INDEX idx_tasks_assigned ON public.tasks(assigned_to);
CREATE INDEX idx_tasks_status ON public.tasks(status);
CREATE INDEX idx_tasks_due_date ON public.tasks(due_date) WHERE due_date IS NOT NULL;
CREATE INDEX idx_tasks_priority ON public.tasks(priority);

-- -----------------------------------------------------------------------------
-- DOCUMENTS TABLE
-- Document metadata (actual files stored in Supabase Storage or Google Drive)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Document details
  name TEXT NOT NULL,
  description TEXT,
  category document_category NOT NULL DEFAULT 'other',
  
  -- File information
  file_path TEXT,                        -- Supabase Storage path
  file_size INTEGER,                     -- Size in bytes
  mime_type TEXT,
  
  -- External storage (Google Drive integration)
  google_drive_id TEXT,
  google_drive_url TEXT,
  
  -- Relationships
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  
  -- Access control
  is_visible_to_client BOOLEAN NOT NULL DEFAULT false,
  
  -- Version control
  version INTEGER NOT NULL DEFAULT 1,
  parent_document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX idx_documents_case ON public.documents(case_id);
CREATE INDEX idx_documents_category ON public.documents(category);
CREATE INDEX idx_documents_uploaded_by ON public.documents(uploaded_by);
CREATE INDEX idx_documents_client_visible ON public.documents(is_visible_to_client) WHERE is_visible_to_client = true;

-- -----------------------------------------------------------------------------
-- DEADLINES TABLE
-- Critical dates and deadlines tracking
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.deadlines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Deadline details
  title TEXT NOT NULL,
  description TEXT,
  deadline_type TEXT NOT NULL,           -- e.g., "Court Filing", "Response Due", "Hearing"
  
  -- Scheduling
  due_date TIMESTAMPTZ NOT NULL,
  reminder_days INTEGER[] DEFAULT '{7, 3, 1}',  -- Days before to send reminders
  
  -- Relationships
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  
  -- Status
  is_completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  
  -- Google Calendar integration
  google_calendar_event_id TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX idx_deadlines_case ON public.deadlines(case_id);
CREATE INDEX idx_deadlines_due_date ON public.deadlines(due_date);
CREATE INDEX idx_deadlines_completed ON public.deadlines(is_completed);

-- -----------------------------------------------------------------------------
-- ACTIVITY_LOG TABLE
-- Audit trail for all significant actions
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Actor
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  
  -- Action details
  action_type TEXT NOT NULL,             -- e.g., "created", "updated", "deleted"
  entity_type TEXT NOT NULL,             -- e.g., "case", "task", "document"
  entity_id UUID NOT NULL,
  
  -- Context
  case_id UUID REFERENCES public.cases(id) ON DELETE CASCADE,
  
  -- Change details (JSON for flexibility)
  old_values JSONB,
  new_values JSONB,
  description TEXT,
  
  -- Metadata
  ip_address INET,
  user_agent TEXT,
  
  -- Timestamp
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX idx_activity_log_user ON public.activity_log(user_id);
CREATE INDEX idx_activity_log_entity ON public.activity_log(entity_type, entity_id);
CREATE INDEX idx_activity_log_case ON public.activity_log(case_id);
CREATE INDEX idx_activity_log_created ON public.activity_log(created_at);

-- -----------------------------------------------------------------------------
-- CASE_NOTES TABLE
-- Internal notes and communications about cases
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.case_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Note content
  content TEXT NOT NULL,
  
  -- Relationships
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  
  -- Access control
  is_visible_to_client BOOLEAN NOT NULL DEFAULT false,
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_case_notes_case ON public.case_notes(case_id);
CREATE INDEX idx_case_notes_pinned ON public.case_notes(is_pinned) WHERE is_pinned = true;

-- -----------------------------------------------------------------------------
-- UPDATED_AT TRIGGER FUNCTION
-- Automatically updates the updated_at timestamp
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to all tables with updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_clients_updated_at
  BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cases_updated_at
  BEFORE UPDATE ON public.cases
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_documents_updated_at
  BEFORE UPDATE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_deadlines_updated_at
  BEFORE UPDATE ON public.deadlines
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_case_notes_updated_at
  BEFORE UPDATE ON public.case_notes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------------------------------
-- AUTO-CREATE PROFILE TRIGGER
-- Creates a profile when a new user signs up
-- -----------------------------------------------------------------------------
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
    role
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'first_name', 'Usuario'),
    COALESCE(NEW.raw_user_meta_data ->> 'last_name', 'Nuevo'),
    NEW.email,
    COALESCE((NEW.raw_user_meta_data ->> 'role')::user_role, 'lawyer_executive')
  )
  ON CONFLICT (id) DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- Drop existing trigger if exists and create new one
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
