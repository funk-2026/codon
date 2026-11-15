-- 0009 - tests as exam simulations: style, kind, live schedule, result release, series, registrations,
-- official attempts and leave-app counters. Idempotent: safe on a database AutoMigrate already brought up to date.

ALTER TABLE tests ADD COLUMN IF NOT EXISTS exam_style          text NOT NULL DEFAULT 'school';
ALTER TABLE tests ADD COLUMN IF NOT EXISTS kind                text NOT NULL DEFAULT 'chapter';
ALTER TABLE tests ADD COLUMN IF NOT EXISTS delivery            text NOT NULL DEFAULT 'anytime';
ALTER TABLE tests ADD COLUMN IF NOT EXISTS opens_at            timestamptz;
ALTER TABLE tests ADD COLUMN IF NOT EXISTS late_entry_minutes  integer NOT NULL DEFAULT 15;
ALTER TABLE tests ADD COLUMN IF NOT EXISTS extra_minutes       integer NOT NULL DEFAULT 0;
ALTER TABLE tests ADD COLUMN IF NOT EXISTS results_at          timestamptz;
ALTER TABLE tests ADD COLUMN IF NOT EXISTS rank_visibility     text NOT NULL DEFAULT 'everyone';
ALTER TABLE tests ADD COLUMN IF NOT EXISTS series_id           uuid;
ALTER TABLE tests ADD COLUMN IF NOT EXISTS exam_year           integer;
ALTER TABLE tests ADD COLUMN IF NOT EXISTS reminders_sent      integer NOT NULL DEFAULT 0;
ALTER TABLE tests ADD COLUMN IF NOT EXISTS results_notified_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_tests_opens_at  ON tests (opens_at);
CREATE INDEX IF NOT EXISTS idx_tests_series_id ON tests (series_id);

ALTER TABLE student_attempts ADD COLUMN IF NOT EXISTS official      boolean NOT NULL DEFAULT false;
ALTER TABLE student_attempts ADD COLUMN IF NOT EXISTS source        text    NOT NULL DEFAULT 'anytime';
ALTER TABLE student_attempts ADD COLUMN IF NOT EXISTS leave_count   integer NOT NULL DEFAULT 0;
ALTER TABLE student_attempts ADD COLUMN IF NOT EXISTS leave_seconds integer NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_student_attempts_official ON student_attempts (official);

ALTER TABLE users ADD COLUMN IF NOT EXISTS leaderboard_opt_out boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS test_series (
    id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    course_id   uuid NOT NULL,
    title       text NOT NULL,
    description text,
    created_by  uuid NOT NULL,
    created_at  timestamptz,
    updated_at  timestamptz
);
CREATE INDEX IF NOT EXISTS idx_test_series_course_id ON test_series (course_id);

CREATE TABLE IF NOT EXISTS test_registrations (
    test_id    uuid NOT NULL,
    user_id    uuid NOT NULL,
    created_at timestamptz,
    PRIMARY KEY (test_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_test_registrations_user_id ON test_registrations (user_id);

-- Existing Test Series tests were full-length mocks in the NEET style; the first submitted attempt of each student counts.
UPDATE tests SET exam_style = 'neet', kind = 'full' WHERE module_type = 'test_series' AND kind = 'chapter' AND exam_style = 'school';
UPDATE student_attempts a SET official = true
 FROM (SELECT DISTINCT ON (sa.user_id, sa.test_id) sa.id FROM student_attempts sa JOIN tests t ON t.id = sa.test_id
        WHERE t.module_type = 'test_series' AND sa.status = 'submitted' ORDER BY sa.user_id, sa.test_id, sa.submitted_at ASC) f
 WHERE a.id = f.id AND a.official = false;
