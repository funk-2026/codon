-- 0019 - custom module share codes and the modules a student opened by code. Idempotent.
ALTER TABLE tests ADD COLUMN IF NOT EXISTS share_code text;
CREATE UNIQUE INDEX IF NOT EXISTS idx_tests_share_code ON tests (share_code) WHERE share_code IS NOT NULL;
CREATE TABLE IF NOT EXISTS custom_module_opens (
    user_id   uuid NOT NULL,
    test_id   uuid NOT NULL,
    opened_at timestamptz,
    PRIMARY KEY (user_id, test_id)
);
ALTER TABLE custom_test_templates ADD COLUMN IF NOT EXISTS ask jsonb;
