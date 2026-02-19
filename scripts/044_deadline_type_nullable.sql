-- =============================================================================
-- Migration 044: Make deadline_type optional (unify eventos/vencimientos)
-- =============================================================================
-- Allows NULL for generic events; non-null values = vencimiento/audiencia/etc.
-- Run after 043_google_calendar_event_preparation.sql.
-- =============================================================================

ALTER TABLE public.deadlines
  ALTER COLUMN deadline_type DROP NOT NULL;

COMMENT ON COLUMN public.deadlines.deadline_type IS 'Optional: legal, judicial, hearing, etc. NULL = generic event';
