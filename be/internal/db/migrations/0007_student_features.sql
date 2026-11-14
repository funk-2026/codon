-- 0007 — student features: a target exam date, and product-analytics events.
-- Idempotent: safe on a database AutoMigrate already brought up to date.

ALTER TABLE users ADD COLUMN IF NOT EXISTS exam_date date;

CREATE TABLE IF NOT EXISTS analytics_events (
    id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id     uuid,
    name        text NOT NULL,
    props       jsonb,
    app_version text,
    platform    text,
    at          timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_analytics_events_user_id ON analytics_events (user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_name    ON analytics_events (name);
CREATE INDEX IF NOT EXISTS idx_analytics_events_at      ON analytics_events (at);
