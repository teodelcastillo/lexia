-- =============================================================================
-- Google Connections - OAuth tokens for Calendar, Drive, Sheets, Docs
-- =============================================================================
-- Stores per-user Google OAuth tokens to integrate Google services.
-- Run this script to enable Google Calendar (and future Sheets/Docs) integration.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- GOOGLE_CONNECTIONS TABLE
-- One row per user per service (calendar, drive, sheets, docs)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.google_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  -- Service type: calendar, drive, sheets, docs
  service TEXT NOT NULL CHECK (service IN ('calendar', 'drive', 'sheets', 'docs')),
  
  -- OAuth tokens (encrypted at rest by Supabase)
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  
  -- Google user info (for display)
  google_email TEXT,
  google_name TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- One connection per user per service
  UNIQUE(user_id, service)
);

-- Indexes
CREATE INDEX idx_google_connections_user ON public.google_connections(user_id);
CREATE INDEX idx_google_connections_service ON public.google_connections(service);

-- Enable RLS
ALTER TABLE public.google_connections ENABLE ROW LEVEL SECURITY;

-- RLS: Users can only access their own connections
CREATE POLICY "google_connections_select_own"
  ON public.google_connections FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "google_connections_insert_own"
  ON public.google_connections FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "google_connections_update_own"
  ON public.google_connections FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "google_connections_delete_own"
  ON public.google_connections FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger for updated_at (uses generic function from 001_create_schema)
DROP TRIGGER IF EXISTS update_google_connections_updated_at ON public.google_connections;
CREATE TRIGGER update_google_connections_updated_at
  BEFORE UPDATE ON public.google_connections
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE public.google_connections IS 'OAuth tokens for Google services (Calendar, Drive, Sheets, Docs) per user';
