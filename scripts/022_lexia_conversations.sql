-- =============================================================================
-- Migration 022: Lexia Conversations and Messages (with organization_id)
-- =============================================================================
-- Creates lexia_conversations and lexia_messages tables (if not exist),
-- adds organization_id, triggers for auto-assignment, and RLS policies.
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. Table lexia_conversations
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.lexia_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  case_id UUID REFERENCES public.cases(id) ON DELETE SET NULL,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE RESTRICT,
  title TEXT NOT NULL DEFAULT 'Nueva conversación',
  summary TEXT,
  intent TEXT,
  model_used TEXT,
  message_count INT NOT NULL DEFAULT 0,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  last_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lexia_conversations_user_id ON public.lexia_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_lexia_conversations_case_id ON public.lexia_conversations(case_id);
CREATE INDEX IF NOT EXISTS idx_lexia_conversations_last_message ON public.lexia_conversations(last_message_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_lexia_conversations_organization_id ON public.lexia_conversations(organization_id);

COMMENT ON TABLE public.lexia_conversations IS 'Lexia AI chat conversations per user, optionally linked to a case';

-- Add organization_id if table existed without it
ALTER TABLE public.lexia_conversations
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE RESTRICT;

-- =============================================================================
-- 2. Table lexia_messages
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.lexia_messages (
  id TEXT NOT NULL,
  conversation_id UUID NOT NULL REFERENCES public.lexia_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
  content JSONB NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  tokens_used INT DEFAULT 0,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (conversation_id, id)
);

CREATE INDEX IF NOT EXISTS idx_lexia_messages_conversation_id ON public.lexia_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_lexia_messages_created_at ON public.lexia_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_lexia_messages_organization_id ON public.lexia_messages(organization_id);

COMMENT ON TABLE public.lexia_messages IS 'Lexia chat messages; content stores full UIMessage structure (id, role, parts, metadata)';
COMMENT ON COLUMN public.lexia_messages.content IS 'Full UIMessage JSON (id, role, parts, metadata) for reconstructing with validateUIMessages';

-- Add organization_id if table existed without it
ALTER TABLE public.lexia_messages
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE RESTRICT;

-- =============================================================================
-- 3. Update auto_assign_organization_id for lexia_conversations and lexia_messages
-- =============================================================================
CREATE OR REPLACE FUNCTION auto_assign_organization_id()
RETURNS TRIGGER AS $$
DECLARE
  v_org_id UUID;
BEGIN
  -- Get organization_id based on table and context
  CASE TG_TABLE_NAME
    -- Lexia conversations: get from user's profile
    WHEN 'lexia_conversations' THEN
      SELECT organization_id INTO v_org_id
      FROM public.profiles
      WHERE id = NEW.user_id;

    -- Lexia messages: get from parent conversation
    WHEN 'lexia_messages' THEN
      SELECT organization_id INTO v_org_id
      FROM public.lexia_conversations
      WHERE id = NEW.conversation_id;

    -- People: get from creator's profile
    WHEN 'people' THEN
      SELECT organization_id INTO v_org_id
      FROM public.profiles
      WHERE id = auth.uid();

    WHEN 'companies' THEN
      SELECT organization_id INTO v_org_id
      FROM public.profiles
      WHERE id = auth.uid();

    WHEN 'cases' THEN
      IF NEW.company_id IS NOT NULL THEN
        SELECT organization_id INTO v_org_id
        FROM public.companies
        WHERE id = NEW.company_id;
      END IF;
      IF v_org_id IS NULL THEN
        SELECT organization_id INTO v_org_id
        FROM public.profiles
        WHERE id = auth.uid();
      END IF;

    WHEN 'case_assignments' THEN
      SELECT organization_id INTO v_org_id
      FROM public.cases
      WHERE id = NEW.case_id;

    WHEN 'case_participants' THEN
      SELECT organization_id INTO v_org_id
      FROM public.cases
      WHERE id = NEW.case_id;

    WHEN 'tasks' THEN
      SELECT organization_id INTO v_org_id
      FROM public.cases
      WHERE id = NEW.case_id;

    WHEN 'documents' THEN
      SELECT organization_id INTO v_org_id
      FROM public.cases
      WHERE id = NEW.case_id;

    WHEN 'deadlines' THEN
      SELECT organization_id INTO v_org_id
      FROM public.cases
      WHERE id = NEW.case_id;

    WHEN 'case_notes' THEN
      SELECT organization_id INTO v_org_id
      FROM public.cases
      WHERE id = NEW.case_id;

    WHEN 'activity_log' THEN
      IF NEW.case_id IS NOT NULL THEN
        SELECT organization_id INTO v_org_id
        FROM public.cases
        WHERE id = NEW.case_id;
      END IF;
      IF v_org_id IS NULL THEN
        SELECT organization_id INTO v_org_id
        FROM public.profiles
        WHERE id = auth.uid();
      END IF;

    WHEN 'notifications' THEN
      SELECT organization_id INTO v_org_id
      FROM public.profiles
      WHERE id = NEW.user_id;

    WHEN 'lexia_usage_periods' THEN
      SELECT organization_id INTO v_org_id
      FROM public.profiles
      WHERE id = NEW.user_id;

    WHEN 'lexia_usage_log' THEN
      SELECT organization_id INTO v_org_id
      FROM public.profiles
      WHERE id = NEW.user_id;

    ELSE
      SELECT organization_id INTO v_org_id
      FROM public.profiles
      WHERE id = auth.uid();
  END CASE;

  IF NEW.organization_id IS NULL THEN
    NEW.organization_id = v_org_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 4. Triggers for lexia_conversations and lexia_messages
-- =============================================================================
DROP TRIGGER IF EXISTS auto_assign_org_lexia_conversations ON public.lexia_conversations;
CREATE TRIGGER auto_assign_org_lexia_conversations
  BEFORE INSERT ON public.lexia_conversations
  FOR EACH ROW
  WHEN (NEW.organization_id IS NULL)
  EXECUTE FUNCTION auto_assign_organization_id();

DROP TRIGGER IF EXISTS auto_assign_org_lexia_messages ON public.lexia_messages;
CREATE TRIGGER auto_assign_org_lexia_messages
  BEFORE INSERT ON public.lexia_messages
  FOR EACH ROW
  WHEN (NEW.organization_id IS NULL)
  EXECUTE FUNCTION auto_assign_organization_id();

-- =============================================================================
-- 5. RLS policies
-- =============================================================================
ALTER TABLE public.lexia_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lexia_messages ENABLE ROW LEVEL SECURITY;

-- lexia_conversations: user can only access own conversations, scoped by organization
DROP POLICY IF EXISTS "lexia_conversations_select_org" ON public.lexia_conversations;
CREATE POLICY "lexia_conversations_select_org" ON public.lexia_conversations
  FOR SELECT
  USING (
    user_id = auth.uid()
    AND (organization_id = current_user_organization_id() OR is_admin())
  );

DROP POLICY IF EXISTS "lexia_conversations_insert_own" ON public.lexia_conversations;
CREATE POLICY "lexia_conversations_insert_own" ON public.lexia_conversations
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND (organization_id = current_user_organization_id() OR organization_id IS NULL)
  );

DROP POLICY IF EXISTS "lexia_conversations_update_own" ON public.lexia_conversations;
CREATE POLICY "lexia_conversations_update_own" ON public.lexia_conversations
  FOR UPDATE
  USING (
    user_id = auth.uid()
    AND (organization_id = current_user_organization_id() OR is_admin())
  );

DROP POLICY IF EXISTS "lexia_conversations_delete_own" ON public.lexia_conversations;
CREATE POLICY "lexia_conversations_delete_own" ON public.lexia_conversations
  FOR DELETE
  USING (
    user_id = auth.uid()
    AND (organization_id = current_user_organization_id() OR is_admin())
  );

-- lexia_messages: via conversation ownership
DROP POLICY IF EXISTS "lexia_messages_select_via_conv" ON public.lexia_messages;
CREATE POLICY "lexia_messages_select_via_conv" ON public.lexia_messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.lexia_conversations c
      WHERE c.id = lexia_messages.conversation_id
        AND c.user_id = auth.uid()
        AND (c.organization_id = current_user_organization_id() OR is_admin())
    )
  );

DROP POLICY IF EXISTS "lexia_messages_insert_via_conv" ON public.lexia_messages;
CREATE POLICY "lexia_messages_insert_via_conv" ON public.lexia_messages
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.lexia_conversations c
      WHERE c.id = lexia_messages.conversation_id
        AND c.user_id = auth.uid()
        AND (c.organization_id = current_user_organization_id() OR is_admin())
    )
  );

DROP POLICY IF EXISTS "lexia_messages_update_via_conv" ON public.lexia_messages;
CREATE POLICY "lexia_messages_update_via_conv" ON public.lexia_messages
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.lexia_conversations c
      WHERE c.id = lexia_messages.conversation_id
        AND c.user_id = auth.uid()
        AND (c.organization_id = current_user_organization_id() OR is_admin())
    )
  );

DROP POLICY IF EXISTS "lexia_messages_delete_via_conv" ON public.lexia_messages;
CREATE POLICY "lexia_messages_delete_via_conv" ON public.lexia_messages
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.lexia_conversations c
      WHERE c.id = lexia_messages.conversation_id
        AND c.user_id = auth.uid()
        AND (c.organization_id = current_user_organization_id() OR is_admin())
    )
  );

-- =============================================================================
-- 6. Grant permissions
-- =============================================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lexia_conversations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lexia_messages TO authenticated;

COMMIT;
