-- 0008 — teacher features: review notes and scheduling, test instructions, question sections,
-- text document lessons. Idempotent: safe on a database AutoMigrate already brought up to date.

ALTER TABLE tests            ADD COLUMN IF NOT EXISTS submitted_at timestamptz;
ALTER TABLE tests            ADD COLUMN IF NOT EXISTS submit_note  text;
ALTER TABLE tests            ADD COLUMN IF NOT EXISTS publish_at   timestamptz;
ALTER TABLE tests            ADD COLUMN IF NOT EXISTS instructions text;
ALTER TABLE content_items    ADD COLUMN IF NOT EXISTS submitted_at timestamptz;
ALTER TABLE content_items    ADD COLUMN IF NOT EXISTS submit_note  text;
ALTER TABLE content_items    ADD COLUMN IF NOT EXISTS publish_at   timestamptz;
ALTER TABLE content_items    ADD COLUMN IF NOT EXISTS body_text    text;
ALTER TABLE brain_hacks      ADD COLUMN IF NOT EXISTS submitted_at timestamptz;
ALTER TABLE brain_hacks      ADD COLUMN IF NOT EXISTS submit_note  text;
ALTER TABLE brain_hacks      ADD COLUMN IF NOT EXISTS publish_at   timestamptz;
ALTER TABLE flashcard_decks  ADD COLUMN IF NOT EXISTS submitted_at timestamptz;
ALTER TABLE flashcard_decks  ADD COLUMN IF NOT EXISTS submit_note  text;
ALTER TABLE flashcard_decks  ADD COLUMN IF NOT EXISTS publish_at   timestamptz;
ALTER TABLE questions        ADD COLUMN IF NOT EXISTS section      text;

CREATE INDEX IF NOT EXISTS idx_tests_publish_at           ON tests (publish_at);
CREATE INDEX IF NOT EXISTS idx_content_items_publish_at   ON content_items (publish_at);
CREATE INDEX IF NOT EXISTS idx_brain_hacks_publish_at     ON brain_hacks (publish_at);
CREATE INDEX IF NOT EXISTS idx_flashcard_decks_publish_at ON flashcard_decks (publish_at);
