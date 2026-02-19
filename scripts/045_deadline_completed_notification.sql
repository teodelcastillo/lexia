-- =============================================================================
-- Add notification types for activity feed
-- =============================================================================

ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'task_created';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'deadline_completed';
