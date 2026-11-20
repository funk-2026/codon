-- 0018 - chapter cover image. Idempotent.
ALTER TABLE chapters ADD COLUMN IF NOT EXISTS cover_media_id uuid;
