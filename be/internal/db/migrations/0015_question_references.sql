-- 0015 - a question can name the book, edition and pages that explain it. Idempotent.
ALTER TABLE questions ADD COLUMN IF NOT EXISTS ref_book    text;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS ref_edition text;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS ref_pages   text;
