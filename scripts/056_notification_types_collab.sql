-- =============================================================================
-- Migration 056: Notification types for Workspace collaboration
-- =============================================================================
-- Extends notification_type with:
--   - review_requested    : someone asks you to review a document
--   - review_decided      : a reviewer decided (approved / rejected)
--   - document_comment    : new comment on a document you author / review
-- =============================================================================

ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'review_requested';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'review_decided';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'document_comment';

COMMENT ON TYPE notification_type IS
  'Includes Lexia Workspace collaboration: review_requested, review_decided, document_comment';
