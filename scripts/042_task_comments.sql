-- Migration 042: task comments for collaboration on tasks
-- Adds comments tied to tasks, with basic RLS access for participants/admins.

CREATE TABLE IF NOT EXISTS public.task_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (length(trim(content)) > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_comments_task_id ON public.task_comments(task_id);
CREATE INDEX IF NOT EXISTS idx_task_comments_created_by ON public.task_comments(created_by);
CREATE INDEX IF NOT EXISTS idx_task_comments_created_at ON public.task_comments(created_at DESC);

ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "task_comments_select_access" ON public.task_comments;
CREATE POLICY "task_comments_select_access"
  ON public.task_comments FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.tasks t
      WHERE t.id = task_comments.task_id
        AND (
          t.created_by = auth.uid()
          OR t.assigned_to = auth.uid()
          OR public.is_admin()
        )
    )
  );

DROP POLICY IF EXISTS "task_comments_insert_access" ON public.task_comments;
CREATE POLICY "task_comments_insert_access"
  ON public.task_comments FOR INSERT
  WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.tasks t
      WHERE t.id = task_comments.task_id
        AND (
          t.created_by = auth.uid()
          OR t.assigned_to = auth.uid()
          OR public.is_admin()
        )
    )
  );

DROP POLICY IF EXISTS "task_comments_update_own" ON public.task_comments;
CREATE POLICY "task_comments_update_own"
  ON public.task_comments FOR UPDATE
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "task_comments_delete_own_or_admin" ON public.task_comments;
CREATE POLICY "task_comments_delete_own_or_admin"
  ON public.task_comments FOR DELETE
  USING (created_by = auth.uid() OR public.is_admin());

DROP TRIGGER IF EXISTS update_task_comments_updated_at ON public.task_comments;
CREATE TRIGGER update_task_comments_updated_at
  BEFORE UPDATE ON public.task_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.task_comments IS 'Discussion comments attached to tasks';
COMMENT ON COLUMN public.task_comments.content IS 'Free-text comment content for the task thread';
