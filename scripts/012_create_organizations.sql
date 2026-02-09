-- =============================================================================
-- Migration 012: Multi-Tenancy Support - Organizations Table
-- =============================================================================
-- Creates organizations table and adds organization_id to all relevant tables
-- for SaaS multi-tenant support.
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. Create organizations table
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Organization details
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,  -- URL-friendly identifier (e.g., "estudio-garcia")
  legal_name TEXT,
  tax_id TEXT,
  
  -- Contact info
  email TEXT,
  phone TEXT,
  website TEXT,
  address TEXT,
  city TEXT,
  province TEXT,
  country TEXT DEFAULT 'Argentina',
  
  -- Subscription/billing (for future SaaS)
  subscription_tier TEXT DEFAULT 'trial',  -- trial, basic, professional, enterprise
  subscription_status TEXT DEFAULT 'active', -- active, suspended, cancelled
  subscription_expires_at TIMESTAMPTZ,
  
  -- Settings (JSONB for flexible configuration)
  settings JSONB DEFAULT '{}'::jsonb,
  
  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_organizations_slug ON public.organizations(slug);
CREATE INDEX IF NOT EXISTS idx_organizations_active ON public.organizations(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_organizations_subscription_status ON public.organizations(subscription_status);

COMMENT ON TABLE public.organizations IS 'Organizations/workspaces for multi-tenant SaaS support';
COMMENT ON COLUMN public.organizations.slug IS 'URL-friendly unique identifier for the organization';
COMMENT ON COLUMN public.organizations.subscription_tier IS 'Current subscription plan tier';
COMMENT ON COLUMN public.organizations.settings IS 'Organization-specific settings stored as JSON';

-- Add updated_at trigger
CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- 2. Add organization_id to profiles (users)
-- =============================================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_profiles_organization_id ON public.profiles(organization_id);

-- Make it NOT NULL after we create default org and migrate data
-- (We'll do this in a separate step after creating default organization)

COMMENT ON COLUMN public.profiles.organization_id IS 'Organization this user belongs to';

-- =============================================================================
-- 3. Add organization_id to people
-- =============================================================================
ALTER TABLE public.people
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_people_organization_id ON public.people(organization_id);

COMMENT ON COLUMN public.people.organization_id IS 'Organization this person belongs to';

-- =============================================================================
-- 4. Add organization_id to companies
-- =============================================================================
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_companies_organization_id ON public.companies(organization_id);

COMMENT ON COLUMN public.companies.organization_id IS 'Organization this company belongs to';

-- =============================================================================
-- 5. Add organization_id to cases
-- =============================================================================
ALTER TABLE public.cases
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_cases_organization_id ON public.cases(organization_id);

COMMENT ON COLUMN public.cases.organization_id IS 'Organization this case belongs to';

-- =============================================================================
-- 6. Add organization_id to case_assignments
-- =============================================================================
ALTER TABLE public.case_assignments
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_case_assignments_organization_id ON public.case_assignments(organization_id);

COMMENT ON COLUMN public.case_assignments.organization_id IS 'Organization this assignment belongs to';

-- =============================================================================
-- 7. Add organization_id to case_participants
-- =============================================================================
ALTER TABLE public.case_participants
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_case_participants_organization_id ON public.case_participants(organization_id);

COMMENT ON COLUMN public.case_participants.organization_id IS 'Organization this participant belongs to';

-- =============================================================================
-- 8. Add organization_id to tasks
-- =============================================================================
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_tasks_organization_id ON public.tasks(organization_id);

COMMENT ON COLUMN public.tasks.organization_id IS 'Organization this task belongs to';

-- =============================================================================
-- 9. Add organization_id to documents
-- =============================================================================
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_documents_organization_id ON public.documents(organization_id);

COMMENT ON COLUMN public.documents.organization_id IS 'Organization this document belongs to';

-- =============================================================================
-- 10. Add organization_id to deadlines
-- =============================================================================
ALTER TABLE public.deadlines
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_deadlines_organization_id ON public.deadlines(organization_id);

COMMENT ON COLUMN public.deadlines.organization_id IS 'Organization this deadline belongs to';

-- =============================================================================
-- 11. Add organization_id to case_notes
-- =============================================================================
ALTER TABLE public.case_notes
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_case_notes_organization_id ON public.case_notes(organization_id);

COMMENT ON COLUMN public.case_notes.organization_id IS 'Organization this note belongs to';

-- =============================================================================
-- 12. Add organization_id to activity_log
-- =============================================================================
ALTER TABLE public.activity_log
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_activity_log_organization_id ON public.activity_log(organization_id);

COMMENT ON COLUMN public.activity_log.organization_id IS 'Organization this activity belongs to';

-- =============================================================================
-- 13. Add organization_id to notifications
-- =============================================================================
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_notifications_organization_id ON public.notifications(organization_id);

COMMENT ON COLUMN public.notifications.organization_id IS 'Organization this notification belongs to';

-- =============================================================================
-- 14. Add organization_id to lexia_usage_periods
-- =============================================================================
ALTER TABLE public.lexia_usage_periods
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_lexia_usage_periods_organization_id ON public.lexia_usage_periods(organization_id);

COMMENT ON COLUMN public.lexia_usage_periods.organization_id IS 'Organization this usage period belongs to';

-- =============================================================================
-- 15. Add organization_id to lexia_usage_log
-- =============================================================================
ALTER TABLE public.lexia_usage_log
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_lexia_usage_log_organization_id ON public.lexia_usage_log(organization_id);

COMMENT ON COLUMN public.lexia_usage_log.organization_id IS 'Organization this usage log belongs to';

COMMIT;
