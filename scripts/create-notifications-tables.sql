-- Notifications System Migration
-- Creates table for internal notifications with role-based filtering

-- Drop existing notifications table if exists (keep activity_log as it exists)
DROP TABLE IF EXISTS notifications CASCADE;
DROP TYPE IF EXISTS notification_type CASCADE;
DROP TYPE IF EXISTS notification_category CASCADE;

-- Create notification categories enum
CREATE TYPE notification_category AS ENUM ('activity', 'work');

-- Create notification types enum  
CREATE TYPE notification_type AS ENUM (
  -- Activity notifications (logs)
  'user_login',
  'user_created', 
  'case_created',
  'case_updated',
  'case_status_changed',
  'document_uploaded',
  'document_deleted',
  'comment_added',
  'person_created',
  'company_created',
  -- Work notifications (actionable)
  'task_assigned',
  'task_completed',
  'task_overdue',
  'deadline_approaching',
  'deadline_overdue',
  'deadline_created',
  'case_assigned',
  'mention'
);

-- Main notifications table
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Target user who should see this notification
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- Notification metadata
  category notification_category NOT NULL DEFAULT 'activity',
  type notification_type NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  
  -- Optional references to related entities
  case_id UUID REFERENCES cases(id) ON DELETE SET NULL,
  task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  deadline_id UUID REFERENCES deadlines(id) ON DELETE SET NULL,
  document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
  
  -- Actor who triggered this notification (null for system notifications)
  triggered_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  
  -- State tracking
  is_read BOOLEAN NOT NULL DEFAULT false,
  read_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Extra data as JSON for flexibility
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Create indexes for efficient querying
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_user_unread ON notifications(user_id, is_read) WHERE is_read = false;
CREATE INDEX idx_notifications_category ON notifications(category);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX idx_notifications_case_id ON notifications(case_id) WHERE case_id IS NOT NULL;

-- Enable RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies for notifications
-- Users can only see their own notifications
CREATE POLICY "Users can view own notifications" ON notifications
  FOR SELECT USING (auth.uid() = user_id);

-- Users can update their own notifications (mark as read)
CREATE POLICY "Users can update own notifications" ON notifications
  FOR UPDATE USING (auth.uid() = user_id);

-- Authenticated users can insert notifications (will be controlled by server)
CREATE POLICY "Authenticated can insert notifications" ON notifications
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Function to create notification for multiple users
CREATE OR REPLACE FUNCTION create_notification(
  p_user_ids UUID[],
  p_category notification_category,
  p_type notification_type,
  p_title TEXT,
  p_message TEXT,
  p_case_id UUID DEFAULT NULL,
  p_task_id UUID DEFAULT NULL,
  p_deadline_id UUID DEFAULT NULL,
  p_document_id UUID DEFAULT NULL,
  p_triggered_by UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS void AS $$
BEGIN
  INSERT INTO notifications (user_id, category, type, title, message, case_id, task_id, deadline_id, document_id, triggered_by, metadata)
  SELECT 
    unnest(p_user_ids),
    p_category,
    p_type,
    p_title,
    p_message,
    p_case_id,
    p_task_id,
    p_deadline_id,
    p_document_id,
    p_triggered_by,
    p_metadata;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
