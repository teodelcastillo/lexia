-- =============================================================================
-- Google Calendar Event Preparation Override (Optional)
-- =============================================================================
-- Adds optional manual override for event kind and preparation state.
-- Precedence: preparation_override > calculation from tasks > no_aplica
-- Run after 042_task_comments.sql.
--
-- NOTE: The app expects these columns. Run this migration before deploying
-- the event status feature, or the event detail page will fail when selecting
-- event_kind/preparation_override.
-- =============================================================================

ALTER TABLE public.google_calendar_events
  ADD COLUMN IF NOT EXISTS event_kind TEXT,
  ADD COLUMN IF NOT EXISTS preparation_override TEXT,
  ADD COLUMN IF NOT EXISTS prepared_at TIMESTAMPTZ;

-- Valid values for preparation_override (matches PreparationState)
ALTER TABLE public.google_calendar_events
  DROP CONSTRAINT IF EXISTS google_calendar_events_preparation_override_check;
ALTER TABLE public.google_calendar_events
  ADD CONSTRAINT google_calendar_events_preparation_override_check
  CHECK (preparation_override IS NULL OR preparation_override IN ('sin_iniciar', 'en_curso', 'listo', 'no_aplica'));

-- Valid values for event_kind (matches EventKind)
ALTER TABLE public.google_calendar_events
  DROP CONSTRAINT IF EXISTS google_calendar_events_event_kind_check;
ALTER TABLE public.google_calendar_events
  ADD CONSTRAINT google_calendar_events_event_kind_check
  CHECK (event_kind IS NULL OR event_kind IN ('deliverable', 'meeting', 'hearing', 'other'));

COMMENT ON COLUMN public.google_calendar_events.event_kind IS 'Manual classification: deliverable, meeting, hearing, other. Overrides inference from summary/description.';
COMMENT ON COLUMN public.google_calendar_events.preparation_override IS 'Manual preparation state. Overrides calculation from tasks. Values: sin_iniciar, en_curso, listo, no_aplica.';
COMMENT ON COLUMN public.google_calendar_events.prepared_at IS 'Timestamp when event was marked as prepared (manual or when tasks completed).';
