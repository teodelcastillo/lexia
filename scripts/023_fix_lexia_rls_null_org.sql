-- =============================================================================
-- Migration 023: Lexia RLS - Solo conversaciones propias
-- =============================================================================
-- Regla única: cada usuario solo accede a sus propias conversaciones.
-- Ningún usuario (ni admin) puede ver conversaciones de otros.
-- organization_id se mantiene en la tabla para futuro sharing por org.
-- =============================================================================

BEGIN;

-- lexia_conversations: solo propias
DROP POLICY IF EXISTS "lexia_conversations_select_org" ON public.lexia_conversations;
CREATE POLICY "lexia_conversations_select_org" ON public.lexia_conversations
  FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "lexia_conversations_insert_own" ON public.lexia_conversations;
CREATE POLICY "lexia_conversations_insert_own" ON public.lexia_conversations
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "lexia_conversations_update_own" ON public.lexia_conversations;
CREATE POLICY "lexia_conversations_update_own" ON public.lexia_conversations
  FOR UPDATE
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "lexia_conversations_delete_own" ON public.lexia_conversations;
CREATE POLICY "lexia_conversations_delete_own" ON public.lexia_conversations
  FOR DELETE
  USING (user_id = auth.uid());

-- lexia_messages: solo si la conversación es propia
DROP POLICY IF EXISTS "lexia_messages_select_via_conv" ON public.lexia_messages;
CREATE POLICY "lexia_messages_select_via_conv" ON public.lexia_messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.lexia_conversations c
      WHERE c.id = lexia_messages.conversation_id AND c.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "lexia_messages_insert_via_conv" ON public.lexia_messages;
CREATE POLICY "lexia_messages_insert_via_conv" ON public.lexia_messages
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.lexia_conversations c
      WHERE c.id = lexia_messages.conversation_id AND c.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "lexia_messages_update_via_conv" ON public.lexia_messages;
CREATE POLICY "lexia_messages_update_via_conv" ON public.lexia_messages
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.lexia_conversations c
      WHERE c.id = lexia_messages.conversation_id AND c.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "lexia_messages_delete_via_conv" ON public.lexia_messages;
CREATE POLICY "lexia_messages_delete_via_conv" ON public.lexia_messages
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.lexia_conversations c
      WHERE c.id = lexia_messages.conversation_id AND c.user_id = auth.uid()
    )
  );

COMMIT;
