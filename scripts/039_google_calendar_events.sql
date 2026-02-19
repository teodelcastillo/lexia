-- =============================================================================
-- Google Calendar Events & Sync State - Bidirectional sync support
-- =============================================================================
-- Stores events imported from Google Calendar and sync tokens for incremental
-- updates. Run after 038_google_connections.sql.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- GOOGLE_CALENDAR_SYNC_STATE
-- Per-user, per-calendar sync token for incremental Google Calendar sync
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.google_calendar_sync_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  calendar_id TEXT NOT NULL DEFAULT 'primary',

  -- Incremental sync
  sync_token TEXT,
  last_synced_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(user_id, calendar_id)
);

CREATE INDEX idx_google_calendar_sync_state_user ON public.google_calendar_sync_state(user_id);

ALTER TABLE public.google_calendar_sync_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "google_calendar_sync_state_select_own"
  ON public.google_calendar_sync_state FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "google_calendar_sync_state_insert_own"
  ON public.google_calendar_sync_state FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "google_calendar_sync_state_update_own"
  ON public.google_calendar_sync_state FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- GOOGLE_CALENDAR_EVENTS
-- Events imported from Google Calendar (overlay editable in Lexia)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.google_calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  calendar_id TEXT NOT NULL DEFAULT 'primary',
  google_event_id TEXT NOT NULL,

  -- For conflict detection
  etag TEXT,
  google_updated_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'confirmed',  -- confirmed, cancelled, tentative

  -- Event data
  summary TEXT,
  description TEXT,
  location TEXT,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  all_day BOOLEAN NOT NULL DEFAULT false,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(user_id, calendar_id, google_event_id)
);

CREATE INDEX idx_google_calendar_events_user ON public.google_calendar_events(user_id);
CREATE INDEX idx_google_calendar_events_dates ON public.google_calendar_events(start_at, end_at);
CREATE INDEX idx_google_calendar_events_status ON public.google_calendar_events(status) WHERE status != 'cancelled';

ALTER TABLE public.google_calendar_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "google_calendar_events_select_own"
  ON public.google_calendar_events FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "google_calendar_events_insert_own"
  ON public.google_calendar_events FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "google_calendar_events_update_own"
  ON public.google_calendar_events FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "google_calendar_events_delete_own"
  ON public.google_calendar_events FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_google_calendar_sync_state_updated_at ON public.google_calendar_sync_state;
CREATE TRIGGER update_google_calendar_sync_state_updated_at
  BEFORE UPDATE ON public.google_calendar_sync_state
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_google_calendar_events_updated_at ON public.google_calendar_events;
CREATE TRIGGER update_google_calendar_events_updated_at
  BEFORE UPDATE ON public.google_calendar_events
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE public.google_calendar_events IS 'Events imported from Google Calendar, editable from Lexia';
COMMENT ON TABLE public.google_calendar_sync_state IS 'Sync token per user/calendar for incremental Google Calendar sync';
