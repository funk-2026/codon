-- 0002 — attempt runtime guarantees.

-- At most ONE in-progress attempt per (user, test). Concurrent "start" calls
-- used to be able to create duplicates; the service now relies on this index.
-- (Keep the newest in-progress attempt if legacy duplicates exist.)
UPDATE student_attempts SET status = 'submitted', submitted_at = COALESCE(submitted_at, now()),
       auto_submitted = true
WHERE status = 'in_progress' AND id IN (
    SELECT id FROM (
        SELECT id, row_number() OVER (PARTITION BY user_id, test_id ORDER BY started_at DESC) AS rn
        FROM student_attempts WHERE status = 'in_progress'
    ) d WHERE d.rn > 1
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_attempt_in_progress
    ON student_attempts (user_id, test_id)
    WHERE status = 'in_progress';

-- Expired-attempt sweeper scans by deadline.
CREATE INDEX IF NOT EXISTS idx_attempts_expiry
    ON student_attempts (expires_at)
    WHERE status = 'in_progress' AND expires_at IS NOT NULL;
