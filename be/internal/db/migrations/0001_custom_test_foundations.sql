-- 0001 — custom test module foundations.
-- Everything here is safe to run on a database that AutoMigrate has already
-- brought up to date (structure) and is idempotent.

-- Media dedupe: one ready asset per (owner, content hash).
CREATE UNIQUE INDEX IF NOT EXISTS uq_media_owner_sha
    ON media_assets (owner_id, sha256)
    WHERE sha256 <> '' AND status <> 'rejected';

-- Candidate-pool query used by the generator.
CREATE INDEX IF NOT EXISTS idx_questions_pool
    ON questions (chapter_id, difficulty, custom_eligible, flag_status);

-- Only one OPEN report per (reporter, item).
CREATE UNIQUE INDEX IF NOT EXISTS uq_reports_open
    ON content_reports (reporter_id, item_type, item_id)
    WHERE status = 'open';

-- Open-report lookups for auto-hold and queues.
CREATE INDEX IF NOT EXISTS idx_reports_open_item
    ON content_reports (item_type, item_id)
    WHERE status = 'open';

-- Bookmarks are listed per (user, collection).
CREATE INDEX IF NOT EXISTS idx_bookmarks_user_collection
    ON bookmarks (user_id, collection_id);

-- Generated tests never show up in shared lists; make that filter cheap.
CREATE INDEX IF NOT EXISTS idx_tests_owner_generated
    ON tests (owner_user_id, created_at DESC)
    WHERE origin = 'generated';

-- Tags are matched by prefix for autocomplete.
CREATE INDEX IF NOT EXISTS idx_tags_slug_prefix ON tags (slug text_pattern_ops);

-- ── Backfills (run once) ─────────────────────────────────────────────────────

-- 1. test_questions membership from the legacy questions.test_id link.
INSERT INTO test_questions (test_id, question_id, position)
SELECT q.test_id, q.id, q.order_index FROM questions q
ON CONFLICT DO NOTHING;

-- 2. Question metadata inherited from the parent test.
UPDATE questions q
SET subject_id  = COALESCE(q.subject_id, t.subject_id),
    chapter_id  = COALESCE(q.chapter_id, t.chapter_id),
    source_type = CASE t.module_type
                    WHEN 'test_series' THEN 'test_series'
                    WHEN 'practice'    THEN 'practice'
                    ELSE 'qbank'
                  END
FROM tests t
WHERE q.test_id = t.id;

UPDATE questions q
SET subject_id = c.subject_id
FROM chapters c
WHERE q.chapter_id = c.id AND q.subject_id IS NULL;

-- 3. Answer position from the test's question order.
UPDATE attempt_answers aa
SET position = tq.position
FROM student_attempts sa, test_questions tq
WHERE aa.attempt_id = sa.id
  AND tq.test_id = sa.test_id
  AND tq.question_id = aa.question_id
  AND aa.position = 0;

-- 4. Attempt numbering per (user, test).
UPDATE student_attempts s
SET attempt_no = r.rn
FROM (
    SELECT id, row_number() OVER (PARTITION BY user_id, test_id ORDER BY created_at) AS rn
    FROM student_attempts
) r
WHERE s.id = r.id AND r.rn > 1;

-- 5. Per-student question state from historic submitted attempts.
INSERT INTO student_question_states
    (user_id, question_id, times_seen, times_answered, times_correct, last_result, first_seen_at, last_seen_at, last_answered_at, srs_interval)
SELECT sa.user_id,
       aa.question_id,
       count(*),
       count(*) FILTER (WHERE aa.selected_option IS NOT NULL),
       count(*) FILTER (WHERE aa.is_correct IS TRUE),
       COALESCE((array_agg(
           CASE WHEN aa.is_correct IS TRUE THEN 'correct' ELSE 'incorrect' END
           ORDER BY sa.submitted_at DESC NULLS LAST) FILTER (WHERE aa.selected_option IS NOT NULL))[1], 'unattempted'),
       min(COALESCE(sa.submitted_at, sa.started_at)),
       max(COALESCE(sa.submitted_at, sa.started_at)),
       max(COALESCE(sa.submitted_at, sa.started_at)) FILTER (WHERE aa.selected_option IS NOT NULL),
       0
FROM attempt_answers aa
JOIN student_attempts sa ON sa.id = aa.attempt_id
WHERE sa.status = 'submitted'
GROUP BY sa.user_id, aa.question_id
ON CONFLICT DO NOTHING;
