-- 0011 - student state, and self-service resets of study data. Idempotent.
ALTER TABLE users ADD COLUMN IF NOT EXISTS state text;

CREATE TABLE IF NOT EXISTS user_resets (
    user_id  uuid NOT NULL,
    scope    text NOT NULL,
    reset_at timestamptz NOT NULL,
    PRIMARY KEY (user_id, scope)
);

CREATE TABLE IF NOT EXISTS reset_archives (
    id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id    uuid NOT NULL,
    scope      text NOT NULL,
    rows       jsonb NOT NULL,
    created_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_reset_archives_user ON reset_archives (user_id);
