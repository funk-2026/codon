-- 0005 — shared rate-limit table, and the reference data the app needs to
-- function (previously inserted by Go seed code on every API boot).
-- All inserts are idempotent: re-running changes nothing, and rows an admin has
-- edited are never overwritten.

CREATE TABLE IF NOT EXISTS rate_events (
    id  bigserial PRIMARY KEY,
    key text        NOT NULL,
    at  timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rate_key_at ON rate_events (key, at);

-- ── Courses ──────────────────────────────────────────────────────────────────
INSERT INTO courses (id, name, slug, is_active, default_requires_subscription, created_at, updated_at) VALUES
    (gen_random_uuid(), 'NEET UG',       'neet-ug',       true, true,  now(), now()),
    (gen_random_uuid(), '9th Standard',  '9th-standard',  true, false, now(), now()),
    (gen_random_uuid(), '10th Standard', '10th-standard', true, false, now(), now())
ON CONFLICT (slug) DO NOTHING;

-- ── Platform settings ────────────────────────────────────────────────────────
INSERT INTO platform_settings (key, value, updated_at) VALUES ('kyc_required', 'false', now())
ON CONFLICT (key) DO NOTHING;

-- ── System bookmark collections (labels are admin-editable at runtime) ──────
INSERT INTO bookmark_collections (id, key, label, order_index, owner_id, is_active, created_at)
SELECT gen_random_uuid(), d.key, d.label, d.ord, NULL, true, now()
FROM (VALUES ('revise_later', 'Revise later', 1), ('doubts', 'Doubts', 2), ('important', 'Important', 3)) AS d(key, label, ord)
WHERE NOT EXISTS (SELECT 1 FROM bookmark_collections b WHERE b.key = d.key AND b.owner_id IS NULL);

-- ── Default custom-test presets per course (keyed by course + title) ────────
INSERT INTO custom_test_presets (id, course_id, title, description, blueprint, order_index, is_active, created_at, updated_at)
SELECT gen_random_uuid(), c.id, p.title, p.descr,
       p.bp || jsonb_build_object('schema_version', 1, 'course_id', c.id::text),
       p.ord, true, now(), now()
FROM courses c
JOIN (VALUES
    ('Daily 20',       '20 fresh questions, no timer — a quick daily habit.',
        '{"count":20,"strategy":"unseen_first","timing":{"timed":false}}'::jsonb, 1, NULL),
    ('Weak areas',     '15 questions from the chapters you''re weakest in.',
        '{"count":15,"strategy":"weak_first","timing":{"timed":false}}'::jsonb, 2, NULL),
    ('Revision due',   '20 questions that are due for spaced revision, then fresh ones.',
        '{"count":20,"strategy":"spaced","timing":{"timed":false}}'::jsonb, 6, NULL),
    ('Chapter sprint', '10 questions in 10 minutes, in syllabus order.',
        '{"count":10,"order":"syllabus","timing":{"timed":true,"duration_minutes":10}}'::jsonb, 3, NULL),
    ('PYQ only',       '20 previous-year questions.',
        '{"count":20,"filters":{"source_types":["pyq"]},"timing":{"timed":false}}'::jsonb, 4, NULL),
    ('NEET 45 min',    '45 questions, 45 minutes, NEET marking (+4 / −1).',
        '{"count":45,"timing":{"timed":true,"duration_minutes":45},"marking":{"preset":"neet"}}'::jsonb, 5, 'neet-ug')
) AS p(title, descr, bp, ord, only_slug) ON (p.only_slug IS NULL OR p.only_slug = c.slug)
WHERE NOT EXISTS (SELECT 1 FROM custom_test_presets x WHERE x.course_id = c.id AND x.title = p.title);
