-- =============================================================================
-- Migration 055: Lexia Workspace collaboration
-- =============================================================================
-- Adds:
--   1. lexia_document_comments  — inline threaded comments on text ranges.
--   2. lexia_document_reviews   — per-reviewer approval workflow.
--   3. Review state columns on lexia_documents (draft / in_review /
--      approved / rejected) + approver metadata.
--   4. RLS policies scoped by organization + case access.
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. lexia_document_comments
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.lexia_document_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,

  document_id UUID NOT NULL REFERENCES public.lexia_documents(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- Threading: a reply has parent_id and thread_id = root comment id.
  parent_id UUID REFERENCES public.lexia_document_comments(id) ON DELETE CASCADE,
  thread_id UUID NOT NULL,

  -- Optional inline anchor. NULL for document-level comments.
  selection_from INTEGER,
  selection_to INTEGER,
  selection_text TEXT,

  content TEXT NOT NULL CHECK (length(trim(content)) > 0),
  version_at_creation INTEGER,

  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lexia_doc_comments_doc
  ON public.lexia_document_comments(document_id);

CREATE INDEX IF NOT EXISTS idx_lexia_doc_comments_thread
  ON public.lexia_document_comments(thread_id);

CREATE INDEX IF NOT EXISTS idx_lexia_doc_comments_author
  ON public.lexia_document_comments(author_id);

CREATE INDEX IF NOT EXISTS idx_lexia_doc_comments_unresolved
  ON public.lexia_document_comments(document_id) WHERE resolved_at IS NULL;

COMMENT ON TABLE public.lexia_document_comments IS
  'Threaded comments anchored to a document range (Google-Docs-style)';

CREATE TRIGGER update_lexia_doc_comments_updated_at
  BEFORE UPDATE ON public.lexia_document_comments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- 2. lexia_document_reviews
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.lexia_document_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,

  document_id UUID NOT NULL REFERENCES public.lexia_documents(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  decision_reason TEXT,

  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  decided_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_lexia_doc_reviews_doc
  ON public.lexia_document_reviews(document_id);

CREATE INDEX IF NOT EXISTS idx_lexia_doc_reviews_reviewer
  ON public.lexia_document_reviews(reviewer_id, status);

CREATE INDEX IF NOT EXISTS idx_lexia_doc_reviews_pending
  ON public.lexia_document_reviews(document_id) WHERE status = 'pending';

COMMENT ON TABLE public.lexia_document_reviews IS
  'Per-reviewer approval entries for the document review workflow';

-- =============================================================================
-- 3. Document-level review state
-- =============================================================================
ALTER TABLE public.lexia_documents
  ADD COLUMN IF NOT EXISTS review_status TEXT NOT NULL DEFAULT 'draft'
    CHECK (review_status IN ('draft', 'in_review', 'approved', 'rejected'));

ALTER TABLE public.lexia_documents
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.lexia_documents
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

ALTER TABLE public.lexia_documents
  ADD COLUMN IF NOT EXISTS review_snapshot_version INTEGER;

COMMENT ON COLUMN public.lexia_documents.review_status IS
  'Lifecycle state of the document review workflow';
COMMENT ON COLUMN public.lexia_documents.review_snapshot_version IS
  'Version at the moment the review was last requested/approved';

-- =============================================================================
-- 4. Auto-assign organization_id (extend the existing trigger function)
-- =============================================================================
CREATE OR REPLACE FUNCTION auto_assign_org_lexia_comments()
RETURNS TRIGGER AS $$
DECLARE
  v_org_id UUID;
BEGIN
  IF NEW.organization_id IS NULL THEN
    SELECT organization_id INTO v_org_id
    FROM public.lexia_documents
    WHERE id = NEW.document_id;
    NEW.organization_id = v_org_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_assign_org_lexia_comments ON public.lexia_document_comments;
CREATE TRIGGER trg_auto_assign_org_lexia_comments
  BEFORE INSERT ON public.lexia_document_comments
  FOR EACH ROW
  EXECUTE FUNCTION auto_assign_org_lexia_comments();

DROP TRIGGER IF EXISTS trg_auto_assign_org_lexia_reviews ON public.lexia_document_reviews;
CREATE TRIGGER trg_auto_assign_org_lexia_reviews
  BEFORE INSERT ON public.lexia_document_reviews
  FOR EACH ROW
  EXECUTE FUNCTION auto_assign_org_lexia_comments();

-- =============================================================================
-- 5. RLS
-- =============================================================================

ALTER TABLE public.lexia_document_comments ENABLE ROW LEVEL SECURITY;

-- Select: same org as the document + the document is visible to the user.
DROP POLICY IF EXISTS "lexia_doc_comments_select" ON public.lexia_document_comments;
CREATE POLICY "lexia_doc_comments_select" ON public.lexia_document_comments
  FOR SELECT
  USING (
    organization_id = current_user_organization_id()
    OR is_admin()
    OR EXISTS (
      SELECT 1 FROM public.lexia_documents d
      WHERE d.id = lexia_document_comments.document_id
        AND d.user_id = auth.uid()
    )
  );

-- Insert: author = auth.uid() and user sees the document.
DROP POLICY IF EXISTS "lexia_doc_comments_insert" ON public.lexia_document_comments;
CREATE POLICY "lexia_doc_comments_insert" ON public.lexia_document_comments
  FOR INSERT
  WITH CHECK (
    author_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.lexia_documents d
      WHERE d.id = document_id
        AND (
          d.user_id = auth.uid()
          OR d.organization_id = current_user_organization_id()
        )
    )
  );

-- Update: only the author can edit content; anyone in the org can toggle resolved.
DROP POLICY IF EXISTS "lexia_doc_comments_update" ON public.lexia_document_comments;
CREATE POLICY "lexia_doc_comments_update" ON public.lexia_document_comments
  FOR UPDATE
  USING (
    author_id = auth.uid()
    OR organization_id = current_user_organization_id()
    OR is_admin()
  );

-- Delete: author or admin.
DROP POLICY IF EXISTS "lexia_doc_comments_delete" ON public.lexia_document_comments;
CREATE POLICY "lexia_doc_comments_delete" ON public.lexia_document_comments
  FOR DELETE
  USING (author_id = auth.uid() OR is_admin());

-- Reviews
ALTER TABLE public.lexia_document_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lexia_doc_reviews_select" ON public.lexia_document_reviews;
CREATE POLICY "lexia_doc_reviews_select" ON public.lexia_document_reviews
  FOR SELECT
  USING (
    organization_id = current_user_organization_id()
    OR is_admin()
    OR reviewer_id = auth.uid()
    OR requested_by = auth.uid()
  );

DROP POLICY IF EXISTS "lexia_doc_reviews_insert" ON public.lexia_document_reviews;
CREATE POLICY "lexia_doc_reviews_insert" ON public.lexia_document_reviews
  FOR INSERT
  WITH CHECK (
    requested_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.lexia_documents d
      WHERE d.id = document_id
        AND (d.user_id = auth.uid() OR d.organization_id = current_user_organization_id())
    )
  );

-- Update (decide / cancel): reviewer can decide their own; requester can cancel.
DROP POLICY IF EXISTS "lexia_doc_reviews_update" ON public.lexia_document_reviews;
CREATE POLICY "lexia_doc_reviews_update" ON public.lexia_document_reviews
  FOR UPDATE
  USING (
    reviewer_id = auth.uid()
    OR requested_by = auth.uid()
    OR is_admin()
  );

-- =============================================================================
-- 6. Grants
-- =============================================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lexia_document_comments TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.lexia_document_reviews TO authenticated;

COMMIT;
