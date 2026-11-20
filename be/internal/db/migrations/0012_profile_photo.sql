-- 0012 - profile picture. Idempotent.
ALTER TABLE users ADD COLUMN IF NOT EXISTS photo_media_id uuid;
