-- =============================================================================
-- Migration 049: SAC (Sistema de Administración de Causas) Module
-- =============================================================================
-- Creates infrastructure for monitoring judicial cases in the Poder Judicial
-- de Córdoba's SAC extranet:
--   - Lawyer SAC credentials (password encrypted at application layer via AES-256-GCM)
--   - SAC fields on cases table (expediente link)
--   - SAC movements (scraped judicial activity)
--   - SAC sync log (audit trail for scraping jobs)
--   - Notification type for new movements
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. TABLES
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1.1 Lawyer SAC Credentials (one per lawyer profile)
--     encrypted_password: AES-256-GCM ciphertext (iv:authTag:ciphertext in hex)
--     encrypted_session:  cached session cookies in same format
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lawyer_sac_credentials (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id            UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
  organization_id       UUID NOT NULL REFERENCES public.organizations(id),
  extranet_username     TEXT NOT NULL,
  encrypted_password    TEXT NOT NULL,
  is_active             BOOLEAN DEFAULT true,
  last_successful_login TIMESTAMPTZ,
  last_failed_login     TIMESTAMPTZ,
  consecutive_failures  INTEGER DEFAULT 0,
  encrypted_session     TEXT,
  session_expires_at    TIMESTAMPTZ,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lawyer_sac_credentials_profile
  ON public.lawyer_sac_credentials(profile_id);
CREATE INDEX IF NOT EXISTS idx_lawyer_sac_credentials_org
  ON public.lawyer_sac_credentials(organization_id);

-- -----------------------------------------------------------------------------
-- 1.2 SAC fields on cases
-- -----------------------------------------------------------------------------
ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS sac_expediente_number TEXT;
ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS sac_anio TEXT;
ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS sac_fuero TEXT;
ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS sac_responsible_lawyer_id UUID REFERENCES public.profiles(id);
ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS sac_estado_actual TEXT;
ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS sac_last_sync TIMESTAMPTZ;
ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS sac_caratula TEXT;
ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS sac_juzgado TEXT;
ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS sac_secretaria TEXT;

CREATE INDEX IF NOT EXISTS idx_cases_sac_expediente
  ON public.cases(sac_expediente_number)
  WHERE sac_expediente_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cases_sac_responsible_lawyer
  ON public.cases(sac_responsible_lawyer_id)
  WHERE sac_responsible_lawyer_id IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 1.3 SAC Movements (scraped judicial activity)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sac_movements (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id               UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  organization_id       UUID NOT NULL REFERENCES public.organizations(id),
  fecha                 DATE NOT NULL,
  tipo                  TEXT NOT NULL,
  descripcion           TEXT NOT NULL,
  folio                 TEXT,
  secretaria_mov        TEXT,
  synced_by_lawyer_id   UUID REFERENCES public.profiles(id),
  is_new                BOOLEAN DEFAULT true,
  suggested_deadline_id UUID REFERENCES public.deadlines(id) ON DELETE SET NULL,
  raw_data              JSONB,
  created_at            TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT sac_movements_unique_entry UNIQUE(case_id, fecha, tipo, descripcion)
);

CREATE INDEX IF NOT EXISTS idx_sac_movements_case
  ON public.sac_movements(case_id);
CREATE INDEX IF NOT EXISTS idx_sac_movements_org
  ON public.sac_movements(organization_id);
CREATE INDEX IF NOT EXISTS idx_sac_movements_fecha
  ON public.sac_movements(fecha DESC);
CREATE INDEX IF NOT EXISTS idx_sac_movements_is_new
  ON public.sac_movements(case_id, is_new)
  WHERE is_new = true;

-- -----------------------------------------------------------------------------
-- 1.4 SAC Sync Log (audit trail)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sac_sync_log (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id           UUID REFERENCES public.cases(id) ON DELETE SET NULL,
  organization_id   UUID REFERENCES public.organizations(id),
  lawyer_id         UUID REFERENCES public.profiles(id),
  status            TEXT NOT NULL CHECK (status IN ('success', 'error', 'auth_failed', 'no_changes', 'skipped')),
  movements_found   INTEGER DEFAULT 0,
  error_message     TEXT,
  duration_ms       INTEGER,
  created_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sac_sync_log_case
  ON public.sac_sync_log(case_id);
CREATE INDEX IF NOT EXISTS idx_sac_sync_log_created
  ON public.sac_sync_log(created_at DESC);

-- =============================================================================
-- 2. NOTIFICATION TYPE
-- =============================================================================
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'sac_new_movements';

-- =============================================================================
-- 3. TRIGGERS
-- =============================================================================

-- updated_at trigger for lawyer_sac_credentials
CREATE OR REPLACE FUNCTION update_lawyer_sac_credentials_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at_lawyer_sac_credentials ON public.lawyer_sac_credentials;
CREATE TRIGGER set_updated_at_lawyer_sac_credentials
  BEFORE UPDATE ON public.lawyer_sac_credentials
  FOR EACH ROW
  EXECUTE FUNCTION update_lawyer_sac_credentials_updated_at();

-- Auto-assign organization_id triggers
-- Extend auto_assign_organization_id for new tables
CREATE OR REPLACE FUNCTION auto_assign_organization_id()
RETURNS TRIGGER AS $$
DECLARE
  v_org_id UUID;
BEGIN
  CASE TG_TABLE_NAME
    WHEN 'lexia_conversations' THEN
      SELECT organization_id INTO v_org_id FROM public.profiles WHERE id = NEW.user_id;
    WHEN 'lexia_messages' THEN
      SELECT organization_id INTO v_org_id FROM public.lexia_conversations WHERE id = NEW.conversation_id;
    WHEN 'lexia_drafts' THEN
      IF NEW.case_id IS NOT NULL THEN
        SELECT organization_id INTO v_org_id FROM public.cases WHERE id = NEW.case_id;
      END IF;
      IF v_org_id IS NULL THEN
        SELECT organization_id INTO v_org_id FROM public.profiles WHERE id = auth.uid();
      END IF;
    WHEN 'lexia_contestacion_sessions' THEN
      IF NEW.case_id IS NOT NULL THEN
        SELECT organization_id INTO v_org_id FROM public.cases WHERE id = NEW.case_id;
      END IF;
      IF v_org_id IS NULL THEN
        SELECT organization_id INTO v_org_id FROM public.profiles WHERE id = auth.uid();
      END IF;
    WHEN 'people' THEN
      SELECT organization_id INTO v_org_id FROM public.profiles WHERE id = auth.uid();
    WHEN 'companies' THEN
      SELECT organization_id INTO v_org_id FROM public.profiles WHERE id = auth.uid();
    WHEN 'cases' THEN
      IF NEW.company_id IS NOT NULL THEN
        SELECT organization_id INTO v_org_id FROM public.companies WHERE id = NEW.company_id;
      END IF;
      IF v_org_id IS NULL THEN
        SELECT organization_id INTO v_org_id FROM public.profiles WHERE id = auth.uid();
      END IF;
    WHEN 'case_assignments' THEN
      SELECT organization_id INTO v_org_id FROM public.cases WHERE id = NEW.case_id;
    WHEN 'case_participants' THEN
      SELECT organization_id INTO v_org_id FROM public.cases WHERE id = NEW.case_id;
    WHEN 'tasks' THEN
      IF NEW.case_id IS NOT NULL THEN
        SELECT organization_id INTO v_org_id FROM public.cases WHERE id = NEW.case_id;
      END IF;
      IF v_org_id IS NULL THEN
        SELECT organization_id INTO v_org_id FROM public.profiles WHERE id = NEW.created_by;
      END IF;
    WHEN 'documents' THEN
      SELECT organization_id INTO v_org_id FROM public.cases WHERE id = NEW.case_id;
    WHEN 'deadlines' THEN
      IF NEW.case_id IS NOT NULL THEN
        SELECT organization_id INTO v_org_id FROM public.cases WHERE id = NEW.case_id;
      END IF;
      IF v_org_id IS NULL THEN
        SELECT organization_id INTO v_org_id FROM public.profiles WHERE id = NEW.created_by;
      END IF;
    WHEN 'case_notes' THEN
      SELECT organization_id INTO v_org_id FROM public.cases WHERE id = NEW.case_id;
    WHEN 'activity_log' THEN
      IF NEW.case_id IS NOT NULL THEN
        SELECT organization_id INTO v_org_id FROM public.cases WHERE id = NEW.case_id;
      END IF;
      IF v_org_id IS NULL THEN
        SELECT organization_id INTO v_org_id FROM public.profiles WHERE id = auth.uid();
      END IF;
    WHEN 'notifications' THEN
      SELECT organization_id INTO v_org_id FROM public.profiles WHERE id = NEW.user_id;
    WHEN 'lexia_usage_periods' THEN
      SELECT organization_id INTO v_org_id FROM public.profiles WHERE id = NEW.user_id;
    WHEN 'lexia_usage_log' THEN
      SELECT organization_id INTO v_org_id FROM public.profiles WHERE id = NEW.user_id;
    -- SAC module tables
    WHEN 'lawyer_sac_credentials' THEN
      SELECT organization_id INTO v_org_id FROM public.profiles WHERE id = NEW.profile_id;
    WHEN 'sac_movements' THEN
      SELECT organization_id INTO v_org_id FROM public.cases WHERE id = NEW.case_id;
    WHEN 'sac_sync_log' THEN
      IF NEW.case_id IS NOT NULL THEN
        SELECT organization_id INTO v_org_id FROM public.cases WHERE id = NEW.case_id;
      END IF;
      IF v_org_id IS NULL AND NEW.lawyer_id IS NOT NULL THEN
        SELECT organization_id INTO v_org_id FROM public.profiles WHERE id = NEW.lawyer_id;
      END IF;
    ELSE
      SELECT organization_id INTO v_org_id FROM public.profiles WHERE id = auth.uid();
  END CASE;

  IF NEW.organization_id IS NULL THEN
    NEW.organization_id = v_org_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS auto_assign_org_lawyer_sac_credentials ON public.lawyer_sac_credentials;
CREATE TRIGGER auto_assign_org_lawyer_sac_credentials
  BEFORE INSERT ON public.lawyer_sac_credentials
  FOR EACH ROW
  WHEN (NEW.organization_id IS NULL)
  EXECUTE FUNCTION auto_assign_organization_id();

DROP TRIGGER IF EXISTS auto_assign_org_sac_movements ON public.sac_movements;
CREATE TRIGGER auto_assign_org_sac_movements
  BEFORE INSERT ON public.sac_movements
  FOR EACH ROW
  WHEN (NEW.organization_id IS NULL)
  EXECUTE FUNCTION auto_assign_organization_id();

DROP TRIGGER IF EXISTS auto_assign_org_sac_sync_log ON public.sac_sync_log;
CREATE TRIGGER auto_assign_org_sac_sync_log
  BEFORE INSERT ON public.sac_sync_log
  FOR EACH ROW
  WHEN (NEW.organization_id IS NULL)
  EXECUTE FUNCTION auto_assign_organization_id();

-- =============================================================================
-- 4. ENABLE RLS
-- =============================================================================
ALTER TABLE public.lawyer_sac_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sac_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sac_sync_log ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- 5. RLS POLICIES
-- =============================================================================

-- ---------- lawyer_sac_credentials ----------
-- Each lawyer sees/manages only their own credentials.
-- Admins can see all credentials in their organization.

CREATE POLICY "sac_credentials_select" ON public.lawyer_sac_credentials
FOR SELECT USING (
  profile_id = auth.uid()
  OR (
    organization_id = current_user_organization_id()
    AND is_admin()
  )
);

CREATE POLICY "sac_credentials_insert" ON public.lawyer_sac_credentials
FOR INSERT WITH CHECK (
  profile_id = auth.uid()
  AND current_user_system_role() IN ('case_leader', 'lawyer_executive')
);

CREATE POLICY "sac_credentials_update" ON public.lawyer_sac_credentials
FOR UPDATE USING (
  profile_id = auth.uid()
);

CREATE POLICY "sac_credentials_delete" ON public.lawyer_sac_credentials
FOR DELETE USING (
  profile_id = auth.uid()
  OR (
    organization_id = current_user_organization_id()
    AND is_admin()
  )
);

-- ---------- sac_movements ----------
-- Visible to anyone assigned to the case (same visibility as cases themselves)

CREATE POLICY "sac_movements_select" ON public.sac_movements
FOR SELECT USING (
  organization_id = current_user_organization_id()
  AND (
    is_admin()
    OR case_id IN (
      SELECT case_id FROM public.case_assignments WHERE user_id = auth.uid()
    )
  )
);

CREATE POLICY "sac_movements_insert" ON public.sac_movements
FOR INSERT WITH CHECK (
  organization_id = current_user_organization_id()
  AND (
    is_admin()
    OR current_user_system_role() IN ('case_leader', 'lawyer_executive')
  )
);

CREATE POLICY "sac_movements_update" ON public.sac_movements
FOR UPDATE USING (
  organization_id = current_user_organization_id()
  AND (
    is_admin()
    OR case_id IN (
      SELECT case_id FROM public.case_assignments WHERE user_id = auth.uid()
    )
  )
);

CREATE POLICY "sac_movements_delete" ON public.sac_movements
FOR DELETE USING (
  organization_id = current_user_organization_id()
  AND is_admin()
);

-- ---------- sac_sync_log ----------
-- Only admins can view the sync log

CREATE POLICY "sac_sync_log_select" ON public.sac_sync_log
FOR SELECT USING (
  organization_id = current_user_organization_id()
  AND is_admin()
);

CREATE POLICY "sac_sync_log_insert" ON public.sac_sync_log
FOR INSERT WITH CHECK (
  organization_id = current_user_organization_id()
  AND (
    is_admin()
    OR current_user_system_role() IN ('case_leader', 'lawyer_executive')
  )
);

COMMIT;
