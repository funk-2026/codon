-- 0013 - uploaded reference PDFs (how-to guides, board papers, schema) and the faculty roster. Idempotent.
CREATE TABLE IF NOT EXISTS reference_docs (
    id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    kind       text NOT NULL,
    title      text NOT NULL,
    class      text NOT NULL DEFAULT '',
    board      text NOT NULL DEFAULT '',
    subject    text NOT NULL DEFAULT '',
    year       integer,
    slug       text NOT NULL DEFAULT '',
    language   text NOT NULL DEFAULT '',
    file_key   text NOT NULL,
    file_name  text NOT NULL DEFAULT '',
    size_bytes bigint NOT NULL DEFAULT 0,
    is_active  boolean NOT NULL DEFAULT true,
    created_at timestamptz,
    updated_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_reference_docs_kind ON reference_docs (kind);

CREATE TABLE IF NOT EXISTS faculty_members (
    id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name        text NOT NULL,
    title       text NOT NULL DEFAULT '',
    summary     text NOT NULL DEFAULT '',
    about       text NOT NULL DEFAULT '',
    media_id    uuid,
    order_index integer NOT NULL DEFAULT 0,
    is_active   boolean NOT NULL DEFAULT true,
    created_at  timestamptz,
    updated_at  timestamptz
);
