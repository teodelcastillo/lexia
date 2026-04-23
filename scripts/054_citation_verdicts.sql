-- =============================================================================
-- Migration 054: Anti-hallucination — citation verdicts + strict grounding
-- =============================================================================
-- Adds:
--   1. Citation verification metadata on each AI edit.
--   2. Aggregated grounding_status per edit so the UI can render a banner
--      and optionally block acceptance in strict mode.
--   3. Organization-level `strict_grounding` flag.
--   4. A helper view to find documents with ungrounded citations.
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. Per-edit verdicts
-- =============================================================================
ALTER TABLE public.lexia_document_edits
  ADD COLUMN IF NOT EXISTS citation_verdicts JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.lexia_document_edits
  ADD COLUMN IF NOT EXISTS grounding_status TEXT NOT NULL DEFAULT 'unknown'
    CHECK (grounding_status IN ('unknown', 'grounded', 'partial', 'ungrounded'));

COMMENT ON COLUMN public.lexia_document_edits.citation_verdicts IS
  'Array of verdicts returned by /api/lexia/verify-citation at edit creation time';
COMMENT ON COLUMN public.lexia_document_edits.grounding_status IS
  'Aggregate: grounded = all verified, partial = some warnings, ungrounded = any invalid';

CREATE INDEX IF NOT EXISTS idx_lexia_doc_edits_grounding
  ON public.lexia_document_edits(grounding_status)
  WHERE grounding_status <> 'grounded';

-- =============================================================================
-- 2. Org-level strict grounding flag
-- =============================================================================
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS strict_grounding BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.organizations.strict_grounding IS
  'When true, the server rejects AI edits whose grounding_status is ungrounded';

-- =============================================================================
-- 3. View: documents containing ungrounded edits
-- =============================================================================
CREATE OR REPLACE VIEW public.lexia_documents_ungrounded AS
SELECT
  d.id AS document_id,
  d.organization_id,
  d.user_id,
  d.case_id,
  d.title,
  COUNT(e.id) FILTER (WHERE e.grounding_status = 'ungrounded') AS ungrounded_edits,
  COUNT(e.id) FILTER (WHERE e.grounding_status = 'partial') AS partial_edits,
  COUNT(e.id) FILTER (WHERE e.status = 'accepted') AS accepted_edits
FROM public.lexia_documents d
JOIN public.lexia_document_edits e ON e.document_id = d.id
GROUP BY d.id;

COMMENT ON VIEW public.lexia_documents_ungrounded IS
  'Summary of grounding status for documents with any edit whose citations did not fully verify';

GRANT SELECT ON public.lexia_documents_ungrounded TO authenticated;

COMMIT;
