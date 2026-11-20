-- 0016 - two more lecture PDFs and the lecture length. Idempotent.
ALTER TABLE content_items ADD COLUMN IF NOT EXISTS fourth_book_pdf_key     text;
ALTER TABLE content_items ADD COLUMN IF NOT EXISTS board_questions_pdf_key text;
ALTER TABLE content_items ADD COLUMN IF NOT EXISTS duration_seconds        integer NOT NULL DEFAULT 0;
