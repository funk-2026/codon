-- 0017 - Schema topics, student status, and Pulse items. Idempotent.
CREATE TABLE IF NOT EXISTS schema_topics (
    id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    course_id   uuid NOT NULL,
    subject_id  uuid NOT NULL,
    chapter_id  uuid NOT NULL,
    name        text NOT NULL,
    order_index integer NOT NULL DEFAULT 0,
    created_at  timestamptz
);
CREATE INDEX IF NOT EXISTS idx_schema_topics_course ON schema_topics (course_id);
CREATE INDEX IF NOT EXISTS idx_schema_topics_subject ON schema_topics (subject_id);
CREATE INDEX IF NOT EXISTS idx_schema_topics_chapter ON schema_topics (chapter_id);

CREATE TABLE IF NOT EXISTS schema_years (
    id        uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    topic_id  uuid NOT NULL,
    year      integer NOT NULL,
    re_exam   boolean NOT NULL DEFAULT false,
    subtopic  text NOT NULL DEFAULT '',
    questions integer NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_schema_years_topic ON schema_years (topic_id);

CREATE TABLE IF NOT EXISTS schema_statuses (
    user_id      uuid NOT NULL,
    topic_id     uuid NOT NULL,
    status       text NOT NULL,
    confident_at timestamptz,
    updated_at   timestamptz,
    PRIMARY KEY (user_id, topic_id)
);

CREATE TABLE IF NOT EXISTS pulse_items (
    id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    course_id   uuid NOT NULL,
    subject_id  uuid NOT NULL,
    chapter_id  uuid NOT NULL,
    title       text NOT NULL,
    body        text NOT NULL DEFAULT '',
    author_id   uuid,
    order_index integer NOT NULL DEFAULT 0,
    is_active   boolean NOT NULL DEFAULT true,
    created_at  timestamptz,
    updated_at  timestamptz
);
CREATE INDEX IF NOT EXISTS idx_pulse_items_course ON pulse_items (course_id);
CREATE INDEX IF NOT EXISTS idx_pulse_items_chapter ON pulse_items (chapter_id);

CREATE TABLE IF NOT EXISTS pulse_reads (
    user_id uuid NOT NULL,
    item_id uuid NOT NULL,
    read_at timestamptz,
    PRIMARY KEY (user_id, item_id)
);
