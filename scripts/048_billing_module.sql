-- =============================================================================
-- Migration 048: Billing, Accounts & Financial Module
-- =============================================================================
-- Creates the complete billing infrastructure:
--   - Fee agreements (contracts with clients)
--   - Billing items (chargeable concepts)
--   - Invoices (grouped billing)
--   - Client accounts & movements (current account ledger)
--   - Payments (cash receipts)
--   - Case participations (lawyer stakes)
--   - Lawyer compensations (monthly payroll)
--   - Organization billing settings
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. ENUM TYPES
-- =============================================================================

CREATE TYPE fee_agreement_type AS ENUM (
  'monthly_retainer',
  'retainer_plus_task',
  'custom_quote',
  'per_consultation',
  'hourly',
  'judicial_regulation',
  'hybrid'
);

CREATE TYPE fee_agreement_status AS ENUM (
  'active',
  'suspended',
  'closed'
);

CREATE TYPE billing_item_type AS ENUM (
  'monthly_fee',
  'task_fee',
  'consultation',
  'hours',
  'judicial_regulation',
  'expense_reimbursement',
  'other'
);

CREATE TYPE billing_item_status AS ENUM (
  'draft',
  'approved',
  'invoiced',
  'void'
);

CREATE TYPE invoice_status AS ENUM (
  'draft',
  'issued',
  'paid',
  'partially_paid',
  'overdue',
  'cancelled'
);

CREATE TYPE account_movement_type AS ENUM (
  'invoice',
  'payment',
  'credit_note',
  'adjustment'
);

CREATE TYPE participation_type AS ENUM (
  'studio_assigned',
  'lawyer_recruited'
);

CREATE TYPE compensation_status AS ENUM (
  'draft',
  'approved',
  'paid'
);

-- =============================================================================
-- 2. TABLES
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 2.1 Organization Billing Settings
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.organization_billing_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,

  default_currency TEXT NOT NULL DEFAULT 'ARS',
  invoice_prefix TEXT NOT NULL DEFAULT 'FAC',
  default_tax_rate DECIMAL(5,2) NOT NULL DEFAULT 21.00,
  default_payment_terms_days INTEGER NOT NULL DEFAULT 30,

  -- Participation defaults (percentages)
  default_participation_studio_assigned DECIMAL(5,2) NOT NULL DEFAULT 30.00,
  default_participation_lawyer_recruited DECIMAL(5,2) NOT NULL DEFAULT 20.00,

  -- JUS configuration
  current_jus_value DECIMAL(15,2),
  jus_currency TEXT DEFAULT 'ARS',

  -- Flexible settings overflow
  settings JSONB DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT unique_org_billing_settings UNIQUE (organization_id)
);

CREATE INDEX idx_org_billing_settings_org ON public.organization_billing_settings(organization_id);

COMMENT ON TABLE public.organization_billing_settings IS 'Per-organization billing defaults: currency, tax, JUS value, participation percentages';

-- -----------------------------------------------------------------------------
-- 2.2 Fee Agreements
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.fee_agreements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  client_id UUID REFERENCES public.people(id) ON DELETE RESTRICT,
  company_id UUID REFERENCES public.companies(id) ON DELETE RESTRICT,
  case_id UUID REFERENCES public.cases(id) ON DELETE SET NULL,

  type fee_agreement_type NOT NULL,
  status fee_agreement_status NOT NULL DEFAULT 'active',
  currency TEXT NOT NULL DEFAULT 'ARS',

  valid_from DATE NOT NULL DEFAULT CURRENT_DATE,
  valid_until DATE,

  terms JSONB NOT NULL DEFAULT '{}'::jsonb,
  notes TEXT,

  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE RESTRICT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT fee_agreement_has_client CHECK (
    client_id IS NOT NULL OR company_id IS NOT NULL
  )
);

CREATE INDEX idx_fee_agreements_client ON public.fee_agreements(client_id) WHERE client_id IS NOT NULL;
CREATE INDEX idx_fee_agreements_company ON public.fee_agreements(company_id) WHERE company_id IS NOT NULL;
CREATE INDEX idx_fee_agreements_case ON public.fee_agreements(case_id) WHERE case_id IS NOT NULL;
CREATE INDEX idx_fee_agreements_status ON public.fee_agreements(status);
CREATE INDEX idx_fee_agreements_type ON public.fee_agreements(type);
CREATE INDEX idx_fee_agreements_org ON public.fee_agreements(organization_id);

COMMENT ON TABLE public.fee_agreements IS 'Financial contracts between the firm and clients. Multiple agreements per client allowed.';
COMMENT ON COLUMN public.fee_agreements.terms IS 'Variable JSON structure depending on agreement type (monthly amounts, task rates, hourly rates, etc.)';

-- -----------------------------------------------------------------------------
-- 2.3 Invoices (defined before billing_items so FK can reference it)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  client_id UUID REFERENCES public.people(id) ON DELETE RESTRICT,
  company_id UUID REFERENCES public.companies(id) ON DELETE RESTRICT,

  invoice_number TEXT NOT NULL,
  status invoice_status NOT NULL DEFAULT 'draft',

  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,

  subtotal DECIMAL(15,2) NOT NULL DEFAULT 0,
  tax_rate DECIMAL(5,2) NOT NULL DEFAULT 21.00,
  tax_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  total DECIMAL(15,2) NOT NULL DEFAULT 0,

  currency TEXT NOT NULL DEFAULT 'ARS',
  period TEXT,
  notes TEXT,

  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE RESTRICT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT invoice_has_client CHECK (
    client_id IS NOT NULL OR company_id IS NOT NULL
  )
);

CREATE UNIQUE INDEX idx_invoices_number_org ON public.invoices(organization_id, invoice_number);
CREATE INDEX idx_invoices_client ON public.invoices(client_id) WHERE client_id IS NOT NULL;
CREATE INDEX idx_invoices_company ON public.invoices(company_id) WHERE company_id IS NOT NULL;
CREATE INDEX idx_invoices_status ON public.invoices(status);
CREATE INDEX idx_invoices_period ON public.invoices(period) WHERE period IS NOT NULL;
CREATE INDEX idx_invoices_issue_date ON public.invoices(issue_date);
CREATE INDEX idx_invoices_org ON public.invoices(organization_id);

COMMENT ON TABLE public.invoices IS 'Invoices grouping billing items for a client. Drives account movements.';

-- -----------------------------------------------------------------------------
-- 2.4 Billing Items
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.billing_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  client_id UUID NOT NULL REFERENCES public.people(id) ON DELETE RESTRICT,
  company_id UUID REFERENCES public.companies(id) ON DELETE RESTRICT,
  case_id UUID REFERENCES public.cases(id) ON DELETE SET NULL,
  fee_agreement_id UUID REFERENCES public.fee_agreements(id) ON DELETE SET NULL,
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,

  type billing_item_type NOT NULL,
  description TEXT NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  quantity DECIMAL(10,2) NOT NULL DEFAULT 1,
  line_total DECIMAL(15,2) GENERATED ALWAYS AS (amount * quantity) STORED,

  currency TEXT NOT NULL DEFAULT 'ARS',
  period TEXT,
  status billing_item_status NOT NULL DEFAULT 'draft',

  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,

  organization_id UUID REFERENCES public.organizations(id) ON DELETE RESTRICT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_billing_items_client ON public.billing_items(client_id);
CREATE INDEX idx_billing_items_company ON public.billing_items(company_id) WHERE company_id IS NOT NULL;
CREATE INDEX idx_billing_items_case ON public.billing_items(case_id) WHERE case_id IS NOT NULL;
CREATE INDEX idx_billing_items_agreement ON public.billing_items(fee_agreement_id) WHERE fee_agreement_id IS NOT NULL;
CREATE INDEX idx_billing_items_invoice ON public.billing_items(invoice_id) WHERE invoice_id IS NOT NULL;
CREATE INDEX idx_billing_items_status ON public.billing_items(status);
CREATE INDEX idx_billing_items_period ON public.billing_items(period) WHERE period IS NOT NULL;
CREATE INDEX idx_billing_items_org ON public.billing_items(organization_id);

COMMENT ON TABLE public.billing_items IS 'Individual chargeable concepts that accumulate before being grouped into invoices.';

-- -----------------------------------------------------------------------------
-- 2.5 Client Accounts (billing configuration)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.client_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  client_id UUID REFERENCES public.people(id) ON DELETE RESTRICT,
  company_id UUID REFERENCES public.companies(id) ON DELETE RESTRICT,

  credit_limit DECIMAL(15,2),
  grace_days INTEGER NOT NULL DEFAULT 30,
  currency TEXT NOT NULL DEFAULT 'ARS',
  notes TEXT,

  organization_id UUID REFERENCES public.organizations(id) ON DELETE RESTRICT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT client_account_has_client CHECK (
    client_id IS NOT NULL OR company_id IS NOT NULL
  )
);

CREATE UNIQUE INDEX idx_client_accounts_client ON public.client_accounts(organization_id, client_id) WHERE client_id IS NOT NULL;
CREATE UNIQUE INDEX idx_client_accounts_company ON public.client_accounts(organization_id, company_id) WHERE company_id IS NOT NULL;
CREATE INDEX idx_client_accounts_org ON public.client_accounts(organization_id);

COMMENT ON TABLE public.client_accounts IS 'Per-client billing configuration: credit limits, grace periods.';

-- -----------------------------------------------------------------------------
-- 2.6 Account Movements (ledger)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.account_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  client_id UUID REFERENCES public.people(id) ON DELETE RESTRICT,
  company_id UUID REFERENCES public.companies(id) ON DELETE RESTRICT,

  type account_movement_type NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'ARS',

  movement_date DATE NOT NULL DEFAULT CURRENT_DATE,
  reference_id UUID,
  reference_type TEXT,
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,

  notes TEXT,

  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE RESTRICT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT movement_has_client CHECK (
    client_id IS NOT NULL OR company_id IS NOT NULL
  )
);

CREATE INDEX idx_account_movements_client ON public.account_movements(client_id) WHERE client_id IS NOT NULL;
CREATE INDEX idx_account_movements_company ON public.account_movements(company_id) WHERE company_id IS NOT NULL;
CREATE INDEX idx_account_movements_type ON public.account_movements(type);
CREATE INDEX idx_account_movements_date ON public.account_movements(movement_date);
CREATE INDEX idx_account_movements_invoice ON public.account_movements(invoice_id) WHERE invoice_id IS NOT NULL;
CREATE INDEX idx_account_movements_org ON public.account_movements(organization_id);

COMMENT ON TABLE public.account_movements IS 'Ledger entries for client current accounts. Source of truth for balance computation.';

-- -----------------------------------------------------------------------------
-- 2.7 Payments
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  client_id UUID REFERENCES public.people(id) ON DELETE RESTRICT,
  company_id UUID REFERENCES public.companies(id) ON DELETE RESTRICT,

  amount DECIMAL(15,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'ARS',
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method TEXT NOT NULL DEFAULT 'transferencia',
  reference_number TEXT,

  invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
  notes TEXT,

  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE RESTRICT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT payment_has_client CHECK (
    client_id IS NOT NULL OR company_id IS NOT NULL
  )
);

CREATE INDEX idx_payments_client ON public.payments(client_id) WHERE client_id IS NOT NULL;
CREATE INDEX idx_payments_company ON public.payments(company_id) WHERE company_id IS NOT NULL;
CREATE INDEX idx_payments_invoice ON public.payments(invoice_id) WHERE invoice_id IS NOT NULL;
CREATE INDEX idx_payments_date ON public.payments(payment_date);
CREATE INDEX idx_payments_org ON public.payments(organization_id);

COMMENT ON TABLE public.payments IS 'Cash receipts from clients. Each payment also generates an account_movement.';

-- -----------------------------------------------------------------------------
-- 2.8 Case Participations
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.case_participations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  lawyer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,

  participation_type participation_type NOT NULL,
  percentage DECIMAL(5,2) NOT NULL,
  base_amount DECIMAL(15,2),
  calculated_amount DECIMAL(15,2),

  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'paid')),

  notes TEXT,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE RESTRICT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT unique_case_lawyer_participation UNIQUE (case_id, lawyer_id)
);

CREATE INDEX idx_case_participations_case ON public.case_participations(case_id);
CREATE INDEX idx_case_participations_lawyer ON public.case_participations(lawyer_id);
CREATE INDEX idx_case_participations_status ON public.case_participations(status);
CREATE INDEX idx_case_participations_org ON public.case_participations(organization_id);

COMMENT ON TABLE public.case_participations IS 'Lawyer financial participation in cases. Drives variable compensation.';

-- -----------------------------------------------------------------------------
-- 2.9 Lawyer Compensations
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lawyer_compensations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  lawyer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  period TEXT NOT NULL,

  base_salary_jus DECIMAL(10,2),
  jus_value_at_period DECIMAL(15,2),
  base_amount_ars DECIMAL(15,2),

  participations_total DECIMAL(15,2) NOT NULL DEFAULT 0,
  deductions DECIMAL(15,2) NOT NULL DEFAULT 0,
  total_gross DECIMAL(15,2) NOT NULL DEFAULT 0,

  status compensation_status NOT NULL DEFAULT 'draft',
  payment_date DATE,

  notes TEXT,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE RESTRICT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT unique_lawyer_period UNIQUE (lawyer_id, period, organization_id)
);

CREATE INDEX idx_lawyer_compensations_lawyer ON public.lawyer_compensations(lawyer_id);
CREATE INDEX idx_lawyer_compensations_period ON public.lawyer_compensations(period);
CREATE INDEX idx_lawyer_compensations_status ON public.lawyer_compensations(status);
CREATE INDEX idx_lawyer_compensations_org ON public.lawyer_compensations(organization_id);

COMMENT ON TABLE public.lawyer_compensations IS 'Monthly compensation records for lawyers: base salary in JUS + variable participations.';
COMMENT ON COLUMN public.lawyer_compensations.jus_value_at_period IS 'Snapshot of JUS value at liquidation time for historical accuracy.';

-- =============================================================================
-- 3. UPDATED_AT TRIGGERS
-- =============================================================================

CREATE TRIGGER update_org_billing_settings_updated_at
  BEFORE UPDATE ON public.organization_billing_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_fee_agreements_updated_at
  BEFORE UPDATE ON public.fee_agreements
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_invoices_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_billing_items_updated_at
  BEFORE UPDATE ON public.billing_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_client_accounts_updated_at
  BEFORE UPDATE ON public.client_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payments_updated_at
  BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_case_participations_updated_at
  BEFORE UPDATE ON public.case_participations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_lawyer_compensations_updated_at
  BEFORE UPDATE ON public.lawyer_compensations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- 4. AUTO-ASSIGN ORGANIZATION_ID TRIGGER (update existing function)
-- =============================================================================

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

    -- Billing module tables
    WHEN 'organization_billing_settings' THEN
      v_org_id := NEW.organization_id;
    WHEN 'fee_agreements' THEN
      IF NEW.case_id IS NOT NULL THEN
        SELECT organization_id INTO v_org_id FROM public.cases WHERE id = NEW.case_id;
      ELSIF NEW.company_id IS NOT NULL THEN
        SELECT organization_id INTO v_org_id FROM public.companies WHERE id = NEW.company_id;
      END IF;
      IF v_org_id IS NULL THEN
        SELECT organization_id INTO v_org_id FROM public.profiles WHERE id = NEW.created_by;
      END IF;
    WHEN 'billing_items' THEN
      IF NEW.case_id IS NOT NULL THEN
        SELECT organization_id INTO v_org_id FROM public.cases WHERE id = NEW.case_id;
      END IF;
      IF v_org_id IS NULL THEN
        SELECT organization_id INTO v_org_id FROM public.profiles WHERE id = NEW.created_by;
      END IF;
    WHEN 'invoices' THEN
      SELECT organization_id INTO v_org_id FROM public.profiles WHERE id = NEW.created_by;
    WHEN 'client_accounts' THEN
      SELECT organization_id INTO v_org_id FROM public.profiles WHERE id = auth.uid();
    WHEN 'account_movements' THEN
      SELECT organization_id INTO v_org_id FROM public.profiles WHERE id = NEW.created_by;
    WHEN 'payments' THEN
      SELECT organization_id INTO v_org_id FROM public.profiles WHERE id = NEW.created_by;
    WHEN 'case_participations' THEN
      SELECT organization_id INTO v_org_id FROM public.cases WHERE id = NEW.case_id;
    WHEN 'lawyer_compensations' THEN
      SELECT organization_id INTO v_org_id FROM public.profiles WHERE id = NEW.lawyer_id;

    ELSE
      SELECT organization_id INTO v_org_id FROM public.profiles WHERE id = auth.uid();
  END CASE;

  IF NEW.organization_id IS NULL THEN
    NEW.organization_id = v_org_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for new billing tables
DROP TRIGGER IF EXISTS auto_assign_org_org_billing_settings ON public.organization_billing_settings;
CREATE TRIGGER auto_assign_org_org_billing_settings
  BEFORE INSERT ON public.organization_billing_settings
  FOR EACH ROW
  WHEN (NEW.organization_id IS NULL)
  EXECUTE FUNCTION auto_assign_organization_id();

DROP TRIGGER IF EXISTS auto_assign_org_fee_agreements ON public.fee_agreements;
CREATE TRIGGER auto_assign_org_fee_agreements
  BEFORE INSERT ON public.fee_agreements
  FOR EACH ROW
  WHEN (NEW.organization_id IS NULL)
  EXECUTE FUNCTION auto_assign_organization_id();

DROP TRIGGER IF EXISTS auto_assign_org_billing_items ON public.billing_items;
CREATE TRIGGER auto_assign_org_billing_items
  BEFORE INSERT ON public.billing_items
  FOR EACH ROW
  WHEN (NEW.organization_id IS NULL)
  EXECUTE FUNCTION auto_assign_organization_id();

DROP TRIGGER IF EXISTS auto_assign_org_invoices ON public.invoices;
CREATE TRIGGER auto_assign_org_invoices
  BEFORE INSERT ON public.invoices
  FOR EACH ROW
  WHEN (NEW.organization_id IS NULL)
  EXECUTE FUNCTION auto_assign_organization_id();

DROP TRIGGER IF EXISTS auto_assign_org_client_accounts ON public.client_accounts;
CREATE TRIGGER auto_assign_org_client_accounts
  BEFORE INSERT ON public.client_accounts
  FOR EACH ROW
  WHEN (NEW.organization_id IS NULL)
  EXECUTE FUNCTION auto_assign_organization_id();

DROP TRIGGER IF EXISTS auto_assign_org_account_movements ON public.account_movements;
CREATE TRIGGER auto_assign_org_account_movements
  BEFORE INSERT ON public.account_movements
  FOR EACH ROW
  WHEN (NEW.organization_id IS NULL)
  EXECUTE FUNCTION auto_assign_organization_id();

DROP TRIGGER IF EXISTS auto_assign_org_payments ON public.payments;
CREATE TRIGGER auto_assign_org_payments
  BEFORE INSERT ON public.payments
  FOR EACH ROW
  WHEN (NEW.organization_id IS NULL)
  EXECUTE FUNCTION auto_assign_organization_id();

DROP TRIGGER IF EXISTS auto_assign_org_case_participations ON public.case_participations;
CREATE TRIGGER auto_assign_org_case_participations
  BEFORE INSERT ON public.case_participations
  FOR EACH ROW
  WHEN (NEW.organization_id IS NULL)
  EXECUTE FUNCTION auto_assign_organization_id();

DROP TRIGGER IF EXISTS auto_assign_org_lawyer_compensations ON public.lawyer_compensations;
CREATE TRIGGER auto_assign_org_lawyer_compensations
  BEFORE INSERT ON public.lawyer_compensations
  FOR EACH ROW
  WHEN (NEW.organization_id IS NULL)
  EXECUTE FUNCTION auto_assign_organization_id();

-- =============================================================================
-- 5. ENABLE RLS
-- =============================================================================

ALTER TABLE public.organization_billing_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_agreements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_participations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lawyer_compensations ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- 6. RLS POLICIES
-- =============================================================================

-- ---------- organization_billing_settings ----------
CREATE POLICY "org_billing_settings_select_org" ON public.organization_billing_settings
FOR SELECT USING (
  organization_id = current_user_organization_id()
  AND (
    is_admin()
    OR (auth.jwt() ->> 'system_role') IN ('case_leader', 'lawyer_executive')
  )
);

CREATE POLICY "org_billing_settings_insert_admin" ON public.organization_billing_settings
FOR INSERT WITH CHECK (
  organization_id = current_user_organization_id()
  AND is_admin()
);

CREATE POLICY "org_billing_settings_update_admin" ON public.organization_billing_settings
FOR UPDATE USING (
  organization_id = current_user_organization_id()
  AND is_admin()
);

CREATE POLICY "org_billing_settings_delete_admin" ON public.organization_billing_settings
FOR DELETE USING (
  organization_id = current_user_organization_id()
  AND is_admin()
);

-- ---------- fee_agreements ----------
CREATE POLICY "fee_agreements_select_org" ON public.fee_agreements
FOR SELECT USING (
  organization_id = current_user_organization_id()
  AND (
    is_admin()
    OR (auth.jwt() ->> 'system_role') IN ('case_leader', 'lawyer_executive')
  )
);

CREATE POLICY "fee_agreements_insert_org" ON public.fee_agreements
FOR INSERT WITH CHECK (
  organization_id = current_user_organization_id()
  AND (
    is_admin()
    OR (auth.jwt() ->> 'system_role') = 'case_leader'
  )
);

CREATE POLICY "fee_agreements_update_org" ON public.fee_agreements
FOR UPDATE USING (
  organization_id = current_user_organization_id()
  AND (
    is_admin()
    OR (auth.jwt() ->> 'system_role') = 'case_leader'
  )
);

CREATE POLICY "fee_agreements_delete_org" ON public.fee_agreements
FOR DELETE USING (
  organization_id = current_user_organization_id()
  AND is_admin()
);

-- ---------- billing_items ----------
CREATE POLICY "billing_items_select_org" ON public.billing_items
FOR SELECT USING (
  organization_id = current_user_organization_id()
  AND (
    is_admin()
    OR (auth.jwt() ->> 'system_role') IN ('case_leader', 'lawyer_executive')
  )
);

CREATE POLICY "billing_items_insert_org" ON public.billing_items
FOR INSERT WITH CHECK (
  organization_id = current_user_organization_id()
  AND (
    is_admin()
    OR (auth.jwt() ->> 'system_role') IN ('case_leader', 'lawyer_executive')
  )
);

CREATE POLICY "billing_items_update_org" ON public.billing_items
FOR UPDATE USING (
  organization_id = current_user_organization_id()
  AND (
    is_admin()
    OR (auth.jwt() ->> 'system_role') = 'case_leader'
    OR created_by = auth.uid()
  )
);

CREATE POLICY "billing_items_delete_org" ON public.billing_items
FOR DELETE USING (
  organization_id = current_user_organization_id()
  AND (
    is_admin()
    OR (created_by = auth.uid() AND status = 'draft')
  )
);

-- ---------- invoices ----------
CREATE POLICY "invoices_select_org" ON public.invoices
FOR SELECT USING (
  organization_id = current_user_organization_id()
  AND (
    is_admin()
    OR (auth.jwt() ->> 'system_role') IN ('case_leader', 'lawyer_executive')
  )
);

CREATE POLICY "invoices_insert_org" ON public.invoices
FOR INSERT WITH CHECK (
  organization_id = current_user_organization_id()
  AND (
    is_admin()
    OR (auth.jwt() ->> 'system_role') = 'case_leader'
  )
);

CREATE POLICY "invoices_update_org" ON public.invoices
FOR UPDATE USING (
  organization_id = current_user_organization_id()
  AND (
    is_admin()
    OR (auth.jwt() ->> 'system_role') = 'case_leader'
  )
);

CREATE POLICY "invoices_delete_org" ON public.invoices
FOR DELETE USING (
  organization_id = current_user_organization_id()
  AND is_admin()
);

-- ---------- client_accounts ----------
CREATE POLICY "client_accounts_select_org" ON public.client_accounts
FOR SELECT USING (
  organization_id = current_user_organization_id()
  AND (
    is_admin()
    OR (auth.jwt() ->> 'system_role') IN ('case_leader', 'lawyer_executive')
  )
);

CREATE POLICY "client_accounts_insert_org" ON public.client_accounts
FOR INSERT WITH CHECK (
  organization_id = current_user_organization_id()
  AND (
    is_admin()
    OR (auth.jwt() ->> 'system_role') = 'case_leader'
  )
);

CREATE POLICY "client_accounts_update_org" ON public.client_accounts
FOR UPDATE USING (
  organization_id = current_user_organization_id()
  AND (
    is_admin()
    OR (auth.jwt() ->> 'system_role') = 'case_leader'
  )
);

CREATE POLICY "client_accounts_delete_org" ON public.client_accounts
FOR DELETE USING (
  organization_id = current_user_organization_id()
  AND is_admin()
);

-- ---------- account_movements ----------
CREATE POLICY "account_movements_select_org" ON public.account_movements
FOR SELECT USING (
  organization_id = current_user_organization_id()
  AND (
    is_admin()
    OR (auth.jwt() ->> 'system_role') IN ('case_leader', 'lawyer_executive')
  )
);

CREATE POLICY "account_movements_insert_org" ON public.account_movements
FOR INSERT WITH CHECK (
  organization_id = current_user_organization_id()
  AND (
    is_admin()
    OR (auth.jwt() ->> 'system_role') = 'case_leader'
  )
);

-- Movements are append-only: no update or delete for audit trail
CREATE POLICY "account_movements_delete_admin" ON public.account_movements
FOR DELETE USING (
  organization_id = current_user_organization_id()
  AND is_admin()
);

-- ---------- payments ----------
CREATE POLICY "payments_select_org" ON public.payments
FOR SELECT USING (
  organization_id = current_user_organization_id()
  AND (
    is_admin()
    OR (auth.jwt() ->> 'system_role') IN ('case_leader', 'lawyer_executive')
  )
);

CREATE POLICY "payments_insert_org" ON public.payments
FOR INSERT WITH CHECK (
  organization_id = current_user_organization_id()
  AND (
    is_admin()
    OR (auth.jwt() ->> 'system_role') = 'case_leader'
  )
);

CREATE POLICY "payments_update_org" ON public.payments
FOR UPDATE USING (
  organization_id = current_user_organization_id()
  AND (
    is_admin()
    OR (auth.jwt() ->> 'system_role') = 'case_leader'
  )
);

CREATE POLICY "payments_delete_org" ON public.payments
FOR DELETE USING (
  organization_id = current_user_organization_id()
  AND is_admin()
);

-- ---------- case_participations ----------
CREATE POLICY "case_participations_select_org" ON public.case_participations
FOR SELECT USING (
  organization_id = current_user_organization_id()
  AND (
    is_admin()
    OR lawyer_id = auth.uid()
    OR case_id IN (
      SELECT case_id FROM public.case_assignments WHERE user_id = auth.uid()
    )
  )
);

CREATE POLICY "case_participations_insert_org" ON public.case_participations
FOR INSERT WITH CHECK (
  organization_id = current_user_organization_id()
  AND (
    is_admin()
    OR case_id IN (
      SELECT case_id FROM public.case_assignments
      WHERE user_id = auth.uid() AND case_role = 'leader'
    )
  )
);

CREATE POLICY "case_participations_update_org" ON public.case_participations
FOR UPDATE USING (
  organization_id = current_user_organization_id()
  AND (
    is_admin()
    OR case_id IN (
      SELECT case_id FROM public.case_assignments
      WHERE user_id = auth.uid() AND case_role = 'leader'
    )
  )
);

CREATE POLICY "case_participations_delete_org" ON public.case_participations
FOR DELETE USING (
  organization_id = current_user_organization_id()
  AND is_admin()
);

-- ---------- lawyer_compensations ----------
CREATE POLICY "lawyer_compensations_select_org" ON public.lawyer_compensations
FOR SELECT USING (
  organization_id = current_user_organization_id()
  AND (
    is_admin()
    OR lawyer_id = auth.uid()
  )
);

CREATE POLICY "lawyer_compensations_insert_admin" ON public.lawyer_compensations
FOR INSERT WITH CHECK (
  organization_id = current_user_organization_id()
  AND is_admin()
);

CREATE POLICY "lawyer_compensations_update_admin" ON public.lawyer_compensations
FOR UPDATE USING (
  organization_id = current_user_organization_id()
  AND is_admin()
);

CREATE POLICY "lawyer_compensations_delete_admin" ON public.lawyer_compensations
FOR DELETE USING (
  organization_id = current_user_organization_id()
  AND is_admin()
);

-- =============================================================================
-- 7. HELPER FUNCTIONS
-- =============================================================================

CREATE OR REPLACE FUNCTION next_invoice_number(p_org_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_prefix TEXT;
  v_next INTEGER;
BEGIN
  SELECT COALESCE(invoice_prefix, 'FAC')
    INTO v_prefix
    FROM public.organization_billing_settings
   WHERE organization_id = p_org_id;

  IF v_prefix IS NULL THEN
    v_prefix := 'FAC';
  END IF;

  SELECT COALESCE(MAX(
    CASE
      WHEN invoice_number ~ ('^' || v_prefix || '-[0-9]+$')
      THEN CAST(SUBSTRING(invoice_number FROM LENGTH(v_prefix) + 2) AS INTEGER)
      ELSE 0
    END
  ), 0) + 1
    INTO v_next
    FROM public.invoices
   WHERE organization_id = p_org_id;

  RETURN v_prefix || '-' || LPAD(v_next::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION next_invoice_number(UUID) IS 'Returns the next sequential invoice number for an organization (e.g., FAC-000042)';


CREATE OR REPLACE FUNCTION calculate_client_balance(
  p_client_id UUID DEFAULT NULL,
  p_company_id UUID DEFAULT NULL
)
RETURNS DECIMAL(15,2) AS $$
DECLARE
  v_balance DECIMAL(15,2);
BEGIN
  SELECT COALESCE(SUM(
    CASE
      WHEN type IN ('invoice', 'adjustment') THEN amount
      WHEN type IN ('payment', 'credit_note') THEN -amount
      ELSE 0
    END
  ), 0)
    INTO v_balance
    FROM public.account_movements
   WHERE (p_client_id IS NULL OR client_id = p_client_id)
     AND (p_company_id IS NULL OR company_id = p_company_id)
     AND (p_client_id IS NOT NULL OR p_company_id IS NOT NULL);

  RETURN v_balance;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION calculate_client_balance(UUID, UUID) IS 'Computes current balance from account movements. Positive = client owes money.';

-- =============================================================================
-- 8. VIEWS
-- =============================================================================

CREATE OR REPLACE VIEW client_account_summary AS
SELECT
  COALESCE(am.client_id, ca.client_id) AS client_id,
  COALESCE(am.company_id, ca.company_id) AS company_id,
  COALESCE(am.organization_id, ca.organization_id) AS organization_id,

  COALESCE(SUM(CASE WHEN am.type IN ('invoice', 'adjustment') THEN am.amount ELSE 0 END), 0) AS total_invoiced,
  COALESCE(SUM(CASE WHEN am.type IN ('payment', 'credit_note') THEN am.amount ELSE 0 END), 0) AS total_paid,
  COALESCE(SUM(
    CASE
      WHEN am.type IN ('invoice', 'adjustment') THEN am.amount
      WHEN am.type IN ('payment', 'credit_note') THEN -am.amount
      ELSE 0
    END
  ), 0) AS balance,

  MAX(CASE WHEN am.type = 'invoice' THEN am.movement_date END) AS last_invoice_date,
  MAX(CASE WHEN am.type = 'payment' THEN am.movement_date END) AS last_payment_date,

  ca.credit_limit,
  ca.grace_days

FROM public.account_movements am
FULL OUTER JOIN public.client_accounts ca
  ON (ca.client_id = am.client_id OR (ca.client_id IS NULL AND am.client_id IS NULL))
  AND (ca.company_id = am.company_id OR (ca.company_id IS NULL AND am.company_id IS NULL))
  AND ca.organization_id = am.organization_id
GROUP BY
  COALESCE(am.client_id, ca.client_id),
  COALESCE(am.company_id, ca.company_id),
  COALESCE(am.organization_id, ca.organization_id),
  ca.credit_limit,
  ca.grace_days;

COMMENT ON VIEW client_account_summary IS 'Aggregated client balances computed from account_movements, joined with client_accounts config.';


CREATE OR REPLACE VIEW monthly_billing_summary AS
SELECT
  bi.organization_id,
  bi.client_id,
  bi.company_id,
  bi.period,
  COUNT(*) FILTER (WHERE bi.status = 'draft') AS items_draft,
  COUNT(*) FILTER (WHERE bi.status = 'approved') AS items_approved,
  COUNT(*) FILTER (WHERE bi.status = 'invoiced') AS items_invoiced,
  COALESCE(SUM(bi.line_total) FILTER (WHERE bi.status = 'draft'), 0) AS total_draft,
  COALESCE(SUM(bi.line_total) FILTER (WHERE bi.status = 'approved'), 0) AS total_approved,
  COALESCE(SUM(bi.line_total) FILTER (WHERE bi.status = 'invoiced'), 0) AS total_invoiced
FROM public.billing_items bi
WHERE bi.period IS NOT NULL
GROUP BY bi.organization_id, bi.client_id, bi.company_id, bi.period;

COMMENT ON VIEW monthly_billing_summary IS 'Per-period, per-client summary of billing items by status.';


CREATE OR REPLACE VIEW case_profitability AS
SELECT
  c.id AS case_id,
  c.title AS case_title,
  c.organization_id,

  COALESCE(SUM(bi.line_total) FILTER (WHERE bi.status = 'invoiced'), 0) AS total_billed,

  COALESCE((
    SELECT SUM(p.amount)
    FROM public.payments p
    JOIN public.invoices inv ON inv.id = p.invoice_id
    JOIN public.billing_items bi2 ON bi2.invoice_id = inv.id
    WHERE bi2.case_id = c.id
  ), 0) AS total_collected,

  COALESCE((
    SELECT SUM(cp.calculated_amount)
    FROM public.case_participations cp
    WHERE cp.case_id = c.id AND cp.status IN ('approved', 'paid')
  ), 0) AS total_participation_cost,

  COALESCE(SUM(bi.line_total) FILTER (WHERE bi.status = 'invoiced'), 0)
  - COALESCE((
    SELECT SUM(cp.calculated_amount)
    FROM public.case_participations cp
    WHERE cp.case_id = c.id AND cp.status IN ('approved', 'paid')
  ), 0) AS net_margin

FROM public.cases c
LEFT JOIN public.billing_items bi ON bi.case_id = c.id
GROUP BY c.id, c.title, c.organization_id;

COMMENT ON VIEW case_profitability IS 'Per-case: total billed, collected, participation costs, and net margin.';

COMMIT;
