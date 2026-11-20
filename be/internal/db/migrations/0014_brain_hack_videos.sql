-- 0014 - Brain Hack videos next to articles. Idempotent.
ALTER TABLE brain_hacks ADD COLUMN IF NOT EXISTS kind             text    NOT NULL DEFAULT 'article';
ALTER TABLE brain_hacks ADD COLUMN IF NOT EXISTS video_url        text    NOT NULL DEFAULT '';
ALTER TABLE brain_hacks ADD COLUMN IF NOT EXISTS duration_seconds integer NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_brain_hacks_kind ON brain_hacks (kind);
