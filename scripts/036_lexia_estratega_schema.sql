-- ============================================================
-- Lexia Estratega: Strategic Analysis Module
-- ============================================================

-- Main analysis table
CREATE TABLE IF NOT EXISTS public.lexia_strategic_analyses (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    case_id     UUID REFERENCES public.cases(id) ON DELETE SET NULL,
    analysis    JSONB NOT NULL DEFAULT '{}',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS lexia_strategic_analyses_user_id_idx
    ON public.lexia_strategic_analyses(user_id);
CREATE INDEX IF NOT EXISTS lexia_strategic_analyses_case_id_idx
    ON public.lexia_strategic_analyses(case_id);
CREATE INDEX IF NOT EXISTS lexia_strategic_analyses_created_at_idx
    ON public.lexia_strategic_analyses(created_at DESC);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_lexia_strategic_analyses_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lexia_strategic_analyses_updated_at
    ON public.lexia_strategic_analyses;

CREATE TRIGGER trg_lexia_strategic_analyses_updated_at
    BEFORE UPDATE ON public.lexia_strategic_analyses
    FOR EACH ROW EXECUTE FUNCTION public.update_lexia_strategic_analyses_updated_at();

-- ============================================================
-- Row Level Security
-- ============================================================

ALTER TABLE public.lexia_strategic_analyses ENABLE ROW LEVEL SECURITY;

-- Users see their own analyses
DROP POLICY IF EXISTS "Users can view own strategic analyses"
    ON public.lexia_strategic_analyses;
CREATE POLICY "Users can view own strategic analyses"
    ON public.lexia_strategic_analyses
    FOR SELECT USING (auth.uid() = user_id);

-- Admins see all
DROP POLICY IF EXISTS "Admins can view all strategic analyses"
    ON public.lexia_strategic_analyses;
CREATE POLICY "Admins can view all strategic analyses"
    ON public.lexia_strategic_analyses
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
              AND system_role = 'admin_general'
        )
    );

-- Users can insert their own
DROP POLICY IF EXISTS "Users can insert own strategic analyses"
    ON public.lexia_strategic_analyses;
CREATE POLICY "Users can insert own strategic analyses"
    ON public.lexia_strategic_analyses
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own
DROP POLICY IF EXISTS "Users can update own strategic analyses"
    ON public.lexia_strategic_analyses;
CREATE POLICY "Users can update own strategic analyses"
    ON public.lexia_strategic_analyses
    FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own
DROP POLICY IF EXISTS "Users can delete own strategic analyses"
    ON public.lexia_strategic_analyses;
CREATE POLICY "Users can delete own strategic analyses"
    ON public.lexia_strategic_analyses
    FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- Stats view (optional)
-- ============================================================

CREATE OR REPLACE VIEW public.lexia_estratega_stats AS
SELECT
    date_trunc('day', created_at) AS day,
    COUNT(*)                      AS total_analyses,
    COUNT(DISTINCT user_id)       AS unique_users,
    COUNT(DISTINCT case_id)       AS unique_cases,
    AVG((analysis->'metadata'->>'tokensUsed')::numeric) FILTER (
        WHERE analysis->'metadata'->>'tokensUsed' IS NOT NULL
    ) AS avg_tokens,
    AVG((analysis->'metadata'->>'durationMs')::numeric) FILTER (
        WHERE analysis->'metadata'->>'durationMs' IS NOT NULL
    ) AS avg_duration_ms
FROM public.lexia_strategic_analyses
GROUP BY 1
ORDER BY 1 DESC;
