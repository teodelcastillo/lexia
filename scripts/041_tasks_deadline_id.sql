-- Migration 041: Add deadline_id to tasks for deadline-task association
-- Allows tasks to be linked to a specific deadline (e.g. "Preparar documento" for "Presentación")

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS deadline_id UUID REFERENCES public.deadlines(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_deadline_id ON public.tasks(deadline_id) WHERE deadline_id IS NOT NULL;

COMMENT ON COLUMN public.tasks.deadline_id IS 'Optional link to a deadline this task supports';
