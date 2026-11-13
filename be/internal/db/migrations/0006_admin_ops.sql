-- 0006 — admin operations: suspending accounts and triaging user feedback.
-- Idempotent: safe on a database AutoMigrate already brought up to date.

ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended_at     timestamptz;
ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended_reason text;

ALTER TABLE user_feedbacks ADD COLUMN IF NOT EXISTS status      text NOT NULL DEFAULT 'new';
ALTER TABLE user_feedbacks ADD COLUMN IF NOT EXISTS admin_note  text;
ALTER TABLE user_feedbacks ADD COLUMN IF NOT EXISTS resolved_at timestamptz;
ALTER TABLE user_feedbacks ADD COLUMN IF NOT EXISTS resolved_by uuid;

CREATE INDEX IF NOT EXISTS idx_user_feedbacks_status_created ON user_feedbacks (status, created_at DESC);
