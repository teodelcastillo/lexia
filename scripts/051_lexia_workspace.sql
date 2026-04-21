-- =============================================================================
-- Migration 051: Lexia Workspace (Document + Versions + Edit Operations)
-- =============================================================================
-- Introduces the new editor-first Lexia experience. Documents are stored as
-- Tiptap JSON (not plain text) with explicit version history, and every AI
-- edit produces an auditable record of the operation that the lawyer accepted
-- or rejected. Replaces (eventually) lexia_drafts which keeps working for now.
--
-- Tables:
--   lexia_documents           : current state of each legal document
--   lexia_document_versions   : immutable snapshots (undo/redo, audit)
--   lexia_document_edits      : audit of each AI edit + accept/reject
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. lexia_documents
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.lexia_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  case_id UUID REFERENCES public.cases(id) ON DELETE SET NULL,

  document_type TEXT NOT NULL,  -- 'demanda' | 'contestacion' | ...
  title TEXT NOT NULL DEFAULT 'Documento sin título',

  -- Tiptap JSON document (ProseMirror doc)
  content JSONB NOT NULL DEFAULT '{"type":"doc","content":[]}'::jsonb,

  -- Plain-text projection for full-text search & prompt context
  content_text TEXT NOT NULL DEFAULT '',

  -- Client role within the case (actor | demandado | recurrente | ...)
  client_role TEXT,

  -- Arbitrary metadata (template id used, party data snapshot, etc.)
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Ephemeral context the user picked for AI operations (doc ids, persona ids)
  -- Not enforced with FKs to allow flexibility; validated in code.
  active_context JSONB NOT NULL DEFAULT '{"documentIds":[],"personIds":[]}'::jsonb,

  version INTEGER NOT NULL DEFAULT 1,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lexia_documents_user ON public.lexia_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_lexia_documents_case ON public.lexia_documents(case_id) WHERE case_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_lexia_documents_org ON public.lexia_documents(organization_id) WHERE organization_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_lexia_documents_updated ON public.lexia_documents(updated_at DESC);

COMMENT ON TABLE public.lexia_documents IS 'Legal documents authored in the Lexia Workspace editor (Tiptap JSON).';
COMMENT ON COLUMN public.lexia_documents.content IS 'Tiptap/ProseMirror JSON document';
COMMENT ON COLUMN public.lexia_documents.content_text IS 'Flat text projection for search and prompt context';
COMMENT ON COLUMN public.lexia_documents.active_context IS 'User-selected context (doc/person ids) sent with each AI edit';

CREATE TRIGGER update_lexia_documents_updated_at
  BEFORE UPDATE ON public.lexia_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- 2. lexia_document_versions (immutable history for undo / audit)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.lexia_document_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.lexia_documents(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  version INTEGER NOT NULL,
  content JSONB NOT NULL,
  content_text TEXT NOT NULL DEFAULT '',

  -- How this version was produced: 'manual' | 'ai_edit' | 'ai_agent' | 'template'
  source TEXT NOT NULL DEFAULT 'manual',

  -- If this version was produced by an AI edit, link it.
  edit_id UUID,

  -- Human readable summary ("Reformuló el párrafo de prescripción")
  summary TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (document_id, version)
);

CREATE INDEX IF NOT EXISTS idx_lexia_doc_versions_doc ON public.lexia_document_versions(document_id, version DESC);
CREATE INDEX IF NOT EXISTS idx_lexia_doc_versions_user ON public.lexia_document_versions(user_id);

COMMENT ON TABLE public.lexia_document_versions IS 'Immutable snapshots of document content per version.';

-- =============================================================================
-- 3. lexia_document_edits (AI edit audit)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.lexia_document_edits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.lexia_documents(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- Input
  instruction TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'selection',  -- 'selection' | 'insert' | 'agent'
  selection_from INTEGER,
  selection_to INTEGER,
  selection_text TEXT,

  context JSONB NOT NULL DEFAULT '{}'::jsonb,  -- documentIds, personIds snapshot

  -- Output (from streamObject)
  reasoning TEXT,
  replacement TEXT,
  alternatives JSONB DEFAULT '[]'::jsonb,
  citations JSONB DEFAULT '[]'::jsonb,

  -- Lifecycle
  status TEXT NOT NULL DEFAULT 'pending',   -- pending | accepted | rejected | edited
  accepted_text TEXT,                        -- what the user actually inserted

  -- Model + cost
  model_used TEXT,
  tokens_used INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_lexia_doc_edits_doc ON public.lexia_document_edits(document_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lexia_doc_edits_user ON public.lexia_document_edits(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lexia_doc_edits_status ON public.lexia_document_edits(status);

COMMENT ON TABLE public.lexia_document_edits IS 'Audit of each AI edit proposal, with user acceptance decision.';

-- FK from versions.edit_id to edits (added after edits table exists)
DO $$ BEGIN
  ALTER TABLE public.lexia_document_versions
    ADD CONSTRAINT fk_lexia_doc_versions_edit
    FOREIGN KEY (edit_id) REFERENCES public.lexia_document_edits(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =============================================================================
-- 4. Extend auto_assign_organization_id for new tables
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
    WHEN 'lexia_documents' THEN
      IF NEW.case_id IS NOT NULL THEN
        SELECT organization_id INTO v_org_id FROM public.cases WHERE id = NEW.case_id;
      END IF;
      IF v_org_id IS NULL THEN
        SELECT organization_id INTO v_org_id FROM public.profiles WHERE id = auth.uid();
      END IF;
    WHEN 'lexia_document_versions' THEN
      SELECT organization_id INTO v_org_id FROM public.lexia_documents WHERE id = NEW.document_id;
    WHEN 'lexia_document_edits' THEN
      SELECT organization_id INTO v_org_id FROM public.lexia_documents WHERE id = NEW.document_id;
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
      SELECT organization_id INTO v_org_id FROM public.cases WHERE id = NEW.case_id;
    WHEN 'documents' THEN
      SELECT organization_id INTO v_org_id FROM public.cases WHERE id = NEW.case_id;
    WHEN 'deadlines' THEN
      SELECT organization_id INTO v_org_id FROM public.cases WHERE id = NEW.case_id;
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
    ELSE
      SELECT organization_id INTO v_org_id FROM public.profiles WHERE id = auth.uid();
  END CASE;

  IF NEW.organization_id IS NULL THEN
    NEW.organization_id = v_org_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS auto_assign_org_lexia_documents ON public.lexia_documents;
CREATE TRIGGER auto_assign_org_lexia_documents
  BEFORE INSERT ON public.lexia_documents
  FOR EACH ROW
  WHEN (NEW.organization_id IS NULL)
  EXECUTE FUNCTION auto_assign_organization_id();

DROP TRIGGER IF EXISTS auto_assign_org_lexia_doc_versions ON public.lexia_document_versions;
CREATE TRIGGER auto_assign_org_lexia_doc_versions
  BEFORE INSERT ON public.lexia_document_versions
  FOR EACH ROW
  WHEN (NEW.organization_id IS NULL)
  EXECUTE FUNCTION auto_assign_organization_id();

DROP TRIGGER IF EXISTS auto_assign_org_lexia_doc_edits ON public.lexia_document_edits;
CREATE TRIGGER auto_assign_org_lexia_doc_edits
  BEFORE INSERT ON public.lexia_document_edits
  FOR EACH ROW
  WHEN (NEW.organization_id IS NULL)
  EXECUTE FUNCTION auto_assign_organization_id();

-- =============================================================================
-- 5. RLS Policies
-- =============================================================================
ALTER TABLE public.lexia_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lexia_document_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lexia_document_edits ENABLE ROW LEVEL SECURITY;

-- Documents: owner sees; org members see if case is in org scope.
-- Mutations: only owner.
DROP POLICY IF EXISTS "lexia_documents_select" ON public.lexia_documents;
CREATE POLICY "lexia_documents_select" ON public.lexia_documents
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR organization_id = current_user_organization_id()
  );

DROP POLICY IF EXISTS "lexia_documents_insert" ON public.lexia_documents;
CREATE POLICY "lexia_documents_insert" ON public.lexia_documents
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "lexia_documents_update" ON public.lexia_documents;
CREATE POLICY "lexia_documents_update" ON public.lexia_documents
  FOR UPDATE
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "lexia_documents_delete" ON public.lexia_documents;
CREATE POLICY "lexia_documents_delete" ON public.lexia_documents
  FOR DELETE
  USING (user_id = auth.uid());

-- Versions: visible to owner of parent document; inserts restricted via server.
DROP POLICY IF EXISTS "lexia_doc_versions_select" ON public.lexia_document_versions;
CREATE POLICY "lexia_doc_versions_select" ON public.lexia_document_versions
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR organization_id = current_user_organization_id()
  );

DROP POLICY IF EXISTS "lexia_doc_versions_insert" ON public.lexia_document_versions;
CREATE POLICY "lexia_doc_versions_insert" ON public.lexia_document_versions
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Edits: same pattern.
DROP POLICY IF EXISTS "lexia_doc_edits_select" ON public.lexia_document_edits;
CREATE POLICY "lexia_doc_edits_select" ON public.lexia_document_edits
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR organization_id = current_user_organization_id()
  );

DROP POLICY IF EXISTS "lexia_doc_edits_insert" ON public.lexia_document_edits;
CREATE POLICY "lexia_doc_edits_insert" ON public.lexia_document_edits
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "lexia_doc_edits_update" ON public.lexia_document_edits;
CREATE POLICY "lexia_doc_edits_update" ON public.lexia_document_edits
  FOR UPDATE
  USING (user_id = auth.uid());

-- =============================================================================
-- 6. Grants
-- =============================================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lexia_documents TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.lexia_document_versions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.lexia_document_edits TO authenticated;

COMMIT;
