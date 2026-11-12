-- 0004 — owned child rows are tied to their parents by real foreign keys with
-- ON DELETE CASCADE, so the database (not three hand-written delete lists)
-- guarantees no orphans. Polymorphic tables (bookmarks, ratings,
-- content_reports, media_refs) cannot have FKs and stay cleaned by items.Cleanup.
--
-- For each (child table, column, parent table): remove orphans, drop whatever
-- FK GORM created on that column (it had no ON DELETE), add the cascading one.
DO $$
DECLARE
  r   record;
  con text;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('questions',               'test_id',     'tests'),
    ('test_questions',          'test_id',     'tests'),
    ('test_questions',          'question_id', 'questions'),
    ('question_tags',           'question_id', 'questions'),
    ('question_notes',          'question_id', 'questions'),
    ('question_stats',          'question_id', 'questions'),
    ('question_revisions',      'question_id', 'questions'),
    ('student_question_states', 'question_id', 'questions'),
    ('attempt_answers',         'attempt_id',  'student_attempts'),
    ('attempt_answers',         'question_id', 'questions'),
    ('student_attempts',        'test_id',     'tests'),
    ('flashcards',              'deck_id',     'flashcard_decks'),
    ('flashcard_states',        'card_id',     'flashcards'),
    ('csv_import_row_errors',   'batch_id',    'csv_import_batches'),
    ('csv_import_batches',      'test_id',     'tests'),
    ('video_notes',             'content_item_id', 'content_items'),
    ('user_watch_histories',    'content_item_id', 'content_items')
  ) AS t(tbl, col, ref)
  LOOP
    EXECUTE format('DELETE FROM %I c WHERE NOT EXISTS (SELECT 1 FROM %I p WHERE p.id = c.%I)', r.tbl, r.ref, r.col);

    FOR con IN
      SELECT c.conname FROM pg_constraint c
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
      WHERE c.contype = 'f' AND c.conrelid = r.tbl::regclass AND a.attname = r.col
    LOOP
      EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', r.tbl, con);
    END LOOP;

    EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES %I(id) ON DELETE CASCADE',
                   r.tbl, 'fk_' || r.tbl || '_' || r.col, r.col, r.ref);
  END LOOP;
END $$;
