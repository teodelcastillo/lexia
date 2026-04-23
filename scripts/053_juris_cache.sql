-- =============================================================================
-- Migration 053: Jurisprudence Cache (SAIJ connector)
-- =============================================================================
-- Persistent cache of jurisprudence / normativa fetched from SAIJ and other
-- authoritative public sources. The cache is shared across organizations
-- (legal content is public domain) and powers:
--   1) Real jurisprudence search in Lexia Estratega and the Workspace.
--   2) Anti-hallucination verification of citations produced by the AI.
--
-- Two tables:
--   juris_cache       : canonical documents (fallos, sumarios, dictamenes).
--   juris_case_links  : per-case bookmarks with user notes (org-scoped).
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. juris_cache
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.juris_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Source & identity
  source TEXT NOT NULL CHECK (source IN ('saij', 'infoleg', 'csjn', 'manual')),
  external_id TEXT NOT NULL,         -- id-infojus (e.g. FA01130001) or URL slug
  kind TEXT NOT NULL CHECK (kind IN ('fallo', 'sumario', 'dictamen', 'doctrina', 'norma')),

  -- Content
  title TEXT NOT NULL,
  court TEXT,
  jurisdiction TEXT,                 -- 'Nacional' | 'Cordoba' | ...
  decision_date DATE,
  summary TEXT,
  full_text TEXT,
  url TEXT NOT NULL,                 -- Canonical SAIJ / InfoLEG URL

  -- Search helpers
  key_terms TEXT[] NOT NULL DEFAULT '{}',

  -- Raw payload from SAIJ (for future re-parsing)
  raw JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Freshness control
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ttl_days INTEGER NOT NULL DEFAULT 90,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable pg_trgm before creating trigram indexes (idempotent).
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE UNIQUE INDEX IF NOT EXISTS uq_juris_cache_source_ext
  ON public.juris_cache(source, external_id);

CREATE INDEX IF NOT EXISTS idx_juris_cache_title_trgm
  ON public.juris_cache USING gin (title gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_juris_cache_court
  ON public.juris_cache(court);

CREATE INDEX IF NOT EXISTS idx_juris_cache_decision_date
  ON public.juris_cache(decision_date DESC);

CREATE INDEX IF NOT EXISTS idx_juris_cache_key_terms
  ON public.juris_cache USING gin (key_terms);

CREATE INDEX IF NOT EXISTS idx_juris_cache_full_text_trgm
  ON public.juris_cache USING gin (full_text gin_trgm_ops);

COMMENT ON TABLE public.juris_cache IS 'Cache of public jurisprudence and normativa fetched from SAIJ / InfoLEG';
COMMENT ON COLUMN public.juris_cache.external_id IS 'Source-specific id (id-infojus for SAIJ, internal ref for others)';
COMMENT ON COLUMN public.juris_cache.ttl_days IS 'How many days before the row should be considered stale and refetched';

CREATE TRIGGER update_juris_cache_updated_at
  BEFORE UPDATE ON public.juris_cache
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- 2. juris_case_links
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.juris_case_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,

  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  juris_id UUID NOT NULL REFERENCES public.juris_cache(id) ON DELETE CASCADE,

  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  notes TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_juris_case_links_case_juris
  ON public.juris_case_links(case_id, juris_id);

CREATE INDEX IF NOT EXISTS idx_juris_case_links_case
  ON public.juris_case_links(case_id);

CREATE INDEX IF NOT EXISTS idx_juris_case_links_org
  ON public.juris_case_links(organization_id) WHERE organization_id IS NOT NULL;

COMMENT ON TABLE public.juris_case_links IS 'Per-case bookmarks of jurisprudence relevant to a specific case';

-- Auto-assign organization_id from case
CREATE OR REPLACE FUNCTION auto_assign_org_juris_case_links()
RETURNS TRIGGER AS $$
DECLARE
  v_org_id UUID;
BEGIN
  IF NEW.organization_id IS NULL THEN
    SELECT organization_id INTO v_org_id FROM public.cases WHERE id = NEW.case_id;
    NEW.organization_id = v_org_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_assign_org_juris_case_links ON public.juris_case_links;
CREATE TRIGGER trg_auto_assign_org_juris_case_links
  BEFORE INSERT ON public.juris_case_links
  FOR EACH ROW
  EXECUTE FUNCTION auto_assign_org_juris_case_links();

-- =============================================================================
-- 3. RLS
-- =============================================================================

-- juris_cache: readable by any authenticated user (public legal data).
-- Writes are server-only (service role / grants below).
ALTER TABLE public.juris_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "juris_cache_select_authenticated" ON public.juris_cache;
CREATE POLICY "juris_cache_select_authenticated" ON public.juris_cache
  FOR SELECT
  TO authenticated
  USING (true);

-- juris_case_links: org-scoped.
ALTER TABLE public.juris_case_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "juris_case_links_select" ON public.juris_case_links;
CREATE POLICY "juris_case_links_select" ON public.juris_case_links
  FOR SELECT
  USING (
    organization_id = current_user_organization_id()
    OR is_admin()
  );

DROP POLICY IF EXISTS "juris_case_links_insert" ON public.juris_case_links;
CREATE POLICY "juris_case_links_insert" ON public.juris_case_links
  FOR INSERT
  WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "juris_case_links_delete" ON public.juris_case_links;
CREATE POLICY "juris_case_links_delete" ON public.juris_case_links
  FOR DELETE
  USING (created_by = auth.uid() OR is_admin());

-- =============================================================================
-- 4. Grants
-- =============================================================================
GRANT SELECT ON public.juris_cache TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.juris_case_links TO authenticated;

-- The server uses service role for writes to juris_cache, so no grant to
-- authenticated for INSERT/UPDATE on that table (prevents users polluting it).

COMMIT;
