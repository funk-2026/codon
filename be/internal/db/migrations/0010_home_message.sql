-- 0010 - the "A message from ..." card on Home. One row. Idempotent.
CREATE TABLE IF NOT EXISTS home_messages (
    slot       text PRIMARY KEY,
    name       text NOT NULL,
    quote      text NOT NULL,
    media_id   uuid,
    is_active  boolean NOT NULL DEFAULT true,
    updated_at timestamptz
);
