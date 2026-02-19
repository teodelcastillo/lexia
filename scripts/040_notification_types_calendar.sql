-- =============================================================================
-- Add notification types for calendar reminders (tasks, Google events)
-- =============================================================================
-- Extends notification_type enum for task_approaching and calendar_event_approaching.
-- Run after create-notifications-tables.sql and 039_google_calendar_events.sql.
-- =============================================================================

-- Add new notification types (safe - does not affect existing values)
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'task_approaching';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'calendar_event_approaching';

COMMENT ON TYPE notification_type IS 'Includes task_approaching (tasks with due_date), calendar_event_approaching (Google Calendar events)';
