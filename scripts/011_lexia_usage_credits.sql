-- =============================================================================
-- Migration 011: Lexia usage and credits (plans, periods, log)
-- =============================================================================
-- Adds tables and function for token/credit-based usage tracking per user and
-- monthly period. Idempotent where possible.
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. Table lexia_plans
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.lexia_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  credits_per_month INT NOT NULL,
  tokens_estimate_min INT,
  tokens_estimate_max INT,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lexia_plans_slug ON public.lexia_plans(slug);
COMMENT ON TABLE public.lexia_plans IS 'Catalog of Lexia plans (Individual, Professional, Estudio) with credit limits';

-- Seed plans (idempotent: insert only if slug missing)
INSERT INTO public.lexia_plans (slug, name, credits_per_month, tokens_estimate_min, tokens_estimate_max, description)
VALUES
  ('individual', 'Individual', 300, 250000, 300000, 'Abogado independiente – uso profesional mensual'),
  ('professional', 'Professional', 600, 450000, 600000, 'Abogado + colaborador – más contexto y herramientas'),
  ('estudio', 'Estudio', 1000, 800000, 1000000, 'Estudio jurídico 2–5 personas – consumo compartido')
ON CONFLICT (slug) DO NOTHING;

-- =============================================================================
-- 2. Column profiles.lexia_plan_id
-- =============================================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS lexia_plan_id UUID REFERENCES public.lexia_plans(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_lexia_plan_id ON public.profiles(lexia_plan_id)
  WHERE lexia_plan_id IS NOT NULL;

COMMENT ON COLUMN public.profiles.lexia_plan_id IS 'Lexia plan for this user; null defaults to individual in app';

-- =============================================================================
-- 3. Table lexia_usage_periods
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.lexia_usage_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  credits_used NUMERIC(12,2) NOT NULL DEFAULT 0,
  tokens_used INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, period_start)
);

CREATE INDEX IF NOT EXISTS idx_lexia_usage_periods_user_id ON public.lexia_usage_periods(user_id);
CREATE INDEX IF NOT EXISTS idx_lexia_usage_periods_user_period ON public.lexia_usage_periods(user_id, period_start);
COMMENT ON TABLE public.lexia_usage_periods IS 'Aggregated Lexia usage per user per calendar month';

-- =============================================================================
-- 4. Table lexia_usage_log
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.lexia_usage_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  trace_id TEXT NOT NULL UNIQUE,
  intent TEXT NOT NULL,
  credits_charged NUMERIC(12,2) NOT NULL,
  tokens_used INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lexia_usage_log_user_id ON public.lexia_usage_log(user_id);
CREATE INDEX IF NOT EXISTS idx_lexia_usage_log_created_at ON public.lexia_usage_log(created_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_lexia_usage_log_trace_id ON public.lexia_usage_log(trace_id);
COMMENT ON TABLE public.lexia_usage_log IS 'Per-request Lexia usage for audit and idempotency (trace_id unique)';

-- =============================================================================
-- 5. Function record_lexia_usage (SECURITY DEFINER, idempotent by trace_id)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.record_lexia_usage(
  p_trace_id TEXT,
  p_intent TEXT,
  p_credits_charged NUMERIC,
  p_tokens_used INT DEFAULT 0
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_period_start DATE;
  v_period_end DATE;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'record_lexia_usage: not authenticated';
  END IF;

  v_period_start := date_trunc('month', current_date)::date;
  v_period_end := (v_period_start + interval '1 month' - interval '1 day')::date;

  -- Idempotency: skip if this trace_id was already logged
  IF EXISTS (SELECT 1 FROM public.lexia_usage_log WHERE trace_id = p_trace_id) THEN
    RETURN;
  END IF;

  INSERT INTO public.lexia_usage_log (user_id, trace_id, intent, credits_charged, tokens_used)
  VALUES (v_user_id, p_trace_id, p_intent, p_credits_charged, p_tokens_used);

  INSERT INTO public.lexia_usage_periods (user_id, period_start, period_end, credits_used, tokens_used)
  VALUES (v_user_id, v_period_start, v_period_end, p_credits_charged, p_tokens_used)
  ON CONFLICT (user_id, period_start)
  DO UPDATE SET
    credits_used = lexia_usage_periods.credits_used + EXCLUDED.credits_used,
    tokens_used = lexia_usage_periods.tokens_used + EXCLUDED.tokens_used,
    updated_at = NOW();
END;
$$;

COMMENT ON FUNCTION public.record_lexia_usage IS 'Records one Lexia request usage; uses auth.uid(). Idempotent: duplicate trace_id is ignored.';

-- =============================================================================
-- 6. RLS
-- =============================================================================
ALTER TABLE public.lexia_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lexia_usage_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lexia_usage_log ENABLE ROW LEVEL SECURITY;

-- lexia_plans: read for authenticated (to show plans in app)
DROP POLICY IF EXISTS "lexia_plans_select_authenticated" ON public.lexia_plans;
CREATE POLICY "lexia_plans_select_authenticated" ON public.lexia_plans
  FOR SELECT TO authenticated USING (true);

-- lexia_usage_periods: user can only read own rows
DROP POLICY IF EXISTS "lexia_usage_periods_select_own" ON public.lexia_usage_periods;
CREATE POLICY "lexia_usage_periods_select_own" ON public.lexia_usage_periods
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- lexia_usage_log: user can only read own rows
DROP POLICY IF EXISTS "lexia_usage_log_select_own" ON public.lexia_usage_log;
CREATE POLICY "lexia_usage_log_select_own" ON public.lexia_usage_log
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- No direct INSERT/UPDATE on periods or log for users; only via record_lexia_usage

-- =============================================================================
-- 7. Grants
-- =============================================================================
GRANT SELECT ON public.lexia_plans TO authenticated;
GRANT SELECT ON public.lexia_usage_periods TO authenticated;
GRANT SELECT ON public.lexia_usage_log TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_lexia_usage(TEXT, TEXT, NUMERIC, INT) TO authenticated;

COMMIT;
