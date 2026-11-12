-- 0003 — integrity rules that used to live only in handler code, plus the
-- columns the hardened job queue and review workflow need.
-- Idempotent and safe on a database AutoMigrate has already updated.

-- ── Job queue: lock timestamp for the stuck-job reaper ───────────────────────
ALTER TABLE background_jobs ADD COLUMN IF NOT EXISTS locked_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_jobs_due ON background_jobs (run_after, created_at) WHERE status = 'pending';

-- ── Courses: which course content is paid by default (replaces slug checks) ──
ALTER TABLE courses ADD COLUMN IF NOT EXISTS default_requires_subscription boolean NOT NULL DEFAULT false;
UPDATE courses SET default_requires_subscription = true WHERE slug = 'neet-ug';

-- ── Flashcard decks: same reviewer columns as every other reviewable item ───
ALTER TABLE flashcard_decks ADD COLUMN IF NOT EXISTS reviewed_by uuid;
ALTER TABLE flashcard_decks ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;

-- ── One watch-history row per (user, content) ────────────────────────────────
DELETE FROM user_watch_histories w USING (
    SELECT id, row_number() OVER (PARTITION BY user_id, content_item_id ORDER BY last_watched_at DESC, id) AS rn
    FROM user_watch_histories) d
WHERE w.id = d.id AND d.rn > 1;
CREATE UNIQUE INDEX IF NOT EXISTS uq_watch_user_content ON user_watch_histories (user_id, content_item_id);

-- ── One pending correction per question ──────────────────────────────────────
UPDATE question_revisions r SET status = 'rejected', reject_reason = 'superseded (duplicate pending)'
FROM (SELECT id, row_number() OVER (PARTITION BY question_id ORDER BY created_at DESC, id) AS rn
      FROM question_revisions WHERE status = 'pending') d
WHERE r.id = d.id AND d.rn > 1;
CREATE UNIQUE INDEX IF NOT EXISTS uq_revision_pending ON question_revisions (question_id) WHERE status = 'pending';

-- ── A Razorpay payment id can settle only one order ──────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_rzp_payment
    ON payment_records (razorpay_payment_id) WHERE razorpay_payment_id IS NOT NULL;

-- ── At most one pending/approved KYC record per user ────────────────────────
UPDATE kyc_records k SET status = 'rejected', rejection_reason = COALESCE(rejection_reason, 'superseded (duplicate)')
FROM (SELECT id, row_number() OVER (PARTITION BY user_id ORDER BY (status = 'approved') DESC, submitted_at DESC, id) AS rn
      FROM kyc_records WHERE status IN ('pending', 'approved')) d
WHERE k.id = d.id AND d.rn > 1;
CREATE UNIQUE INDEX IF NOT EXISTS uq_kyc_active ON kyc_records (user_id) WHERE status IN ('pending', 'approved');

-- ── Deterministic question order inside a test ──────────────────────────────
UPDATE test_questions tq SET position = r.rn
FROM (SELECT test_id, question_id, row_number() OVER (PARTITION BY test_id ORDER BY position, question_id) AS rn
      FROM test_questions) r
WHERE tq.test_id = r.test_id AND tq.question_id = r.question_id AND tq.position <> r.rn
  AND tq.test_id IN (SELECT test_id FROM test_questions GROUP BY test_id, position HAVING count(*) > 1);
CREATE UNIQUE INDEX IF NOT EXISTS uq_test_question_position ON test_questions (test_id, position);

-- ── Push dispatch scans only unsent notifications ───────────────────────────
CREATE INDEX IF NOT EXISTS idx_notifications_unpushed ON notifications (created_at) WHERE pushed_at IS NULL;

-- ── Value rules (NOT VALID: enforced for new/changed rows, existing rows untouched) ─
DO $$
DECLARE c record;
BEGIN
  FOR c IN SELECT * FROM (VALUES
    ('subscription_plans', 'chk_plan_price',          'price_paise >= 0'),
    ('subscription_plans', 'chk_plan_duration',       'duration_days > 0'),
    ('users',              'chk_user_role',           $r$role IN ('student','teacher','admin')$r$),
    ('tests',              'chk_test_status',         $r$status IN ('draft','pending_review','approved','rejected','published')$r$),
    ('content_items',      'chk_content_status',      $r$status IN ('draft','pending_review','approved','rejected','published')$r$),
    ('student_attempts',   'chk_attempt_status',      $r$status IN ('in_progress','submitted')$r$),
    ('payment_records',    'chk_payment_status',      $r$status IN ('created','captured','failed','refunded')$r$),
    ('subscriptions',      'chk_subscription_status', $r$status IN ('pending_payment','active','expired','cancelled')$r$),
    ('questions',          'chk_question_correct',    $r$correct_option IN ('A','B','C','D')$r$),
    ('attempt_answers',    'chk_answer_selected',     $r$selected_option IN ('A','B','C','D')$r$)
  ) AS t(tbl, name, expr)
  LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = c.name) THEN
      EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I CHECK (%s) NOT VALID', c.tbl, c.name, c.expr);
    END IF;
  END LOOP;
END $$;
