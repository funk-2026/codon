-- Baseline schema: the structure GORM AutoMigrate produced for the models as of
-- the refactor that retired AutoMigrate in production. It is applied ONLY to a
-- database that has no tables yet (see db.RunMigrations); every later change is
-- a numbered file in db/migrations. Do not edit — add a new migration instead.

CREATE TABLE admin_audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    actor_id uuid NOT NULL,
    action text NOT NULL,
    target text,
    before jsonb,
    after jsonb,
    created_at timestamp with time zone
);

CREATE TABLE attempt_answers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    attempt_id uuid NOT NULL,
    question_id uuid NOT NULL,
    selected_option text,
    is_correct boolean,
    marks_awarded numeric(5,2),
    answered_at timestamp with time zone,
    "position" bigint DEFAULT 0 NOT NULL,
    marked_for_review boolean DEFAULT false NOT NULL,
    time_spent_seconds bigint,
    confidence text,
    revealed_at timestamp with time zone
);

CREATE TABLE background_jobs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    type text NOT NULL,
    payload jsonb NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    attempts bigint DEFAULT 0 NOT NULL,
    run_after timestamp with time zone NOT NULL,
    locked_at timestamp with time zone,
    last_error text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);

CREATE TABLE blueprint_shares (
    code text NOT NULL,
    owner_id uuid NOT NULL,
    blueprint jsonb NOT NULL,
    created_at timestamp with time zone,
    expires_at timestamp with time zone
);

CREATE TABLE bookmark_collections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    key text NOT NULL,
    label text NOT NULL,
    order_index bigint DEFAULT 0 NOT NULL,
    owner_id uuid,
    is_active boolean NOT NULL,
    created_at timestamp with time zone
);

CREATE TABLE bookmarks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    item_type text NOT NULL,
    item_id uuid NOT NULL,
    collection_id uuid NOT NULL,
    note text,
    created_at timestamp with time zone
);

CREATE TABLE brain_hacks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    category text NOT NULL,
    body text NOT NULL,
    content_format text DEFAULT 'rich_v1'::text NOT NULL,
    cover_media_id uuid,
    read_minutes bigint DEFAULT 2 NOT NULL,
    author_id uuid NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    rejection_reason text,
    rating_avg numeric(3,2) DEFAULT 0 NOT NULL,
    rating_count bigint DEFAULT 0 NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);

CREATE TABLE chapters (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    subject_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    order_index bigint DEFAULT 0 NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);

CREATE TABLE content_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    course_id uuid NOT NULL,
    content_type text NOT NULL,
    requires_subscription boolean NOT NULL,
    chapter_id uuid NOT NULL,
    uploaded_by uuid NOT NULL,
    file_key text NOT NULL,
    notes_pdf_key text,
    annotated_pdf_key text,
    video_status text,
    hls_playlist_url text,
    status text DEFAULT 'draft'::text NOT NULL,
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    rejection_reason text,
    rating_avg numeric(3,2) DEFAULT 0 NOT NULL,
    rating_count bigint DEFAULT 0 NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);

CREATE TABLE content_reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    reporter_id uuid NOT NULL,
    item_type text NOT NULL,
    item_id uuid NOT NULL,
    item_version bigint,
    reason text NOT NULL,
    note text,
    context text,
    attempt_id uuid,
    status text DEFAULT 'open'::text NOT NULL,
    assignee_id uuid,
    resolved_by uuid,
    resolved_at timestamp with time zone,
    resolution_note text,
    created_at timestamp with time zone
);

CREATE TABLE courses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    description text,
    is_active boolean NOT NULL,
    default_requires_subscription boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);

CREATE TABLE csv_import_batches (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    teacher_id uuid NOT NULL,
    test_id uuid NOT NULL,
    file_key text NOT NULL,
    total_rows bigint,
    success_rows bigint,
    error_rows bigint,
    status text NOT NULL,
    created_at timestamp with time zone,
    completed_at timestamp with time zone,
    mode text DEFAULT 'commit'::text NOT NULL,
    template_version bigint DEFAULT 1 NOT NULL,
    bundle_key text,
    file_sha256 text,
    warning_rows bigint DEFAULT 0 NOT NULL,
    applied boolean DEFAULT false NOT NULL,
    summary jsonb,
    parent_batch_id uuid,
    allow_content_update boolean DEFAULT false NOT NULL
);

CREATE TABLE csv_import_row_errors (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    batch_id uuid NOT NULL,
    row_number bigint,
    error_message text,
    raw_row_data jsonb,
    code text,
    field text,
    severity text DEFAULT 'error'::text NOT NULL
);

CREATE TABLE custom_test_presets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    course_id uuid NOT NULL,
    title text NOT NULL,
    description text,
    blueprint jsonb NOT NULL,
    order_index bigint DEFAULT 0 NOT NULL,
    is_active boolean NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);

CREATE TABLE custom_test_requests (
    user_id uuid NOT NULL,
    idempotency_key text NOT NULL,
    test_id uuid NOT NULL,
    created_at timestamp with time zone
);

CREATE TABLE custom_test_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    title text NOT NULL,
    blueprint jsonb NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);

CREATE TABLE daily_activities (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    date date NOT NULL,
    created_at timestamp with time zone
);

CREATE TABLE flashcard_decks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    description text,
    course_id uuid NOT NULL,
    subject_id uuid,
    chapter_id uuid,
    author_id uuid NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    requires_subscription boolean NOT NULL,
    rejection_reason text,
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    card_count bigint DEFAULT 0 NOT NULL,
    rating_avg numeric(3,2) DEFAULT 0 NOT NULL,
    rating_count bigint DEFAULT 0 NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);

CREATE TABLE flashcard_states (
    user_id uuid NOT NULL,
    card_id uuid NOT NULL,
    reps bigint DEFAULT 0 NOT NULL,
    interval_days bigint DEFAULT 0 NOT NULL,
    due_at timestamp with time zone,
    last_result text,
    updated_at timestamp with time zone
);

CREATE TABLE flashcards (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    deck_id uuid NOT NULL,
    front text NOT NULL,
    back text NOT NULL,
    content_format text DEFAULT 'rich_v1'::text NOT NULL,
    "position" bigint DEFAULT 0 NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);

CREATE TABLE home_updates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    body text,
    cta_label text,
    cta_route text,
    media_id uuid,
    order_index bigint DEFAULT 0 NOT NULL,
    is_active boolean NOT NULL,
    starts_at timestamp with time zone,
    ends_at timestamp with time zone,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);

CREATE TABLE kyc_records (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    id_type text NOT NULL,
    id_number text NOT NULL,
    document_file_key text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    rejection_reason text,
    submitted_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);

CREATE TABLE media_assets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_id uuid NOT NULL,
    purpose text NOT NULL,
    source text DEFAULT 'upload'::text NOT NULL,
    storage_key text NOT NULL,
    display_key text,
    thumb_key text,
    file_name text,
    mime text,
    declared_mime text,
    declared_bytes bigint,
    bytes bigint,
    width bigint,
    height bigint,
    sha256 text,
    alt_text text,
    status text DEFAULT 'pending'::text NOT NULL,
    reject_reason text,
    created_at timestamp with time zone,
    ready_at timestamp with time zone
);

CREATE TABLE media_refs (
    media_id uuid NOT NULL,
    owner_type text NOT NULL,
    owner_id uuid NOT NULL,
    field text NOT NULL
);

CREATE TABLE notification_prefs (
    user_id uuid NOT NULL,
    push_enabled boolean NOT NULL,
    streak_nudges boolean NOT NULL,
    report_updates boolean NOT NULL,
    updated_at timestamp with time zone
);

CREATE TABLE notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    type text NOT NULL,
    title text NOT NULL,
    body text,
    data jsonb,
    read_at timestamp with time zone,
    pushed_at timestamp with time zone,
    created_at timestamp with time zone
);

CREATE TABLE otp_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    phone_number text NOT NULL,
    otp_code_hash text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    attempts bigint DEFAULT 0 NOT NULL,
    consumed_at timestamp with time zone,
    created_at timestamp with time zone
);

CREATE TABLE payment_records (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    subscription_id uuid,
    razorpay_order_id text NOT NULL,
    razorpay_payment_id text,
    razorpay_signature text,
    amount_paise bigint NOT NULL,
    currency text NOT NULL,
    status text NOT NULL,
    failure_reason text,
    refunded_at timestamp with time zone,
    refund_reason text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);

CREATE TABLE platform_settings (
    key text NOT NULL,
    value text NOT NULL,
    updated_at timestamp with time zone,
    updated_by uuid
);

CREATE TABLE push_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    token text NOT NULL,
    platform text,
    device_id text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);

CREATE TABLE question_notes (
    user_id uuid NOT NULL,
    question_id uuid NOT NULL,
    body text NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);

CREATE TABLE question_revisions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    question_id uuid NOT NULL,
    version_from bigint,
    proposed jsonb,
    snapshot_before jsonb,
    reason text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    rescore boolean DEFAULT false NOT NULL,
    created_by uuid NOT NULL,
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    reject_reason text,
    created_at timestamp with time zone
);

CREATE TABLE question_stats (
    question_id uuid NOT NULL,
    attempts bigint DEFAULT 0 NOT NULL,
    correct bigint DEFAULT 0 NOT NULL,
    total_time_seconds bigint DEFAULT 0 NOT NULL,
    timed_answers bigint DEFAULT 0 NOT NULL,
    report_count bigint DEFAULT 0 NOT NULL,
    empirical_difficulty text,
    updated_at timestamp with time zone
);

CREATE TABLE question_tags (
    question_id uuid NOT NULL,
    tag_id uuid NOT NULL
);

CREATE TABLE questions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    test_id uuid NOT NULL,
    question_text text NOT NULL,
    option_a text NOT NULL,
    option_b text NOT NULL,
    option_c text NOT NULL,
    option_d text NOT NULL,
    correct_option text NOT NULL,
    explanation text,
    order_index bigint NOT NULL,
    content_format text DEFAULT 'plain'::text NOT NULL,
    subject_id uuid,
    chapter_id uuid,
    topic_id uuid,
    difficulty text,
    ncert_class bigint,
    ncert_page bigint,
    source_type text DEFAULT 'qbank'::text NOT NULL,
    source_year bigint,
    source_label text,
    custom_eligible boolean NOT NULL,
    content_hash text,
    question_type text DEFAULT 'mcq_single'::text NOT NULL,
    version bigint DEFAULT 1 NOT NULL,
    lang text DEFAULT 'en'::text NOT NULL,
    flag_status text DEFAULT 'active'::text NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);

CREATE TABLE ratings (
    user_id uuid NOT NULL,
    item_type text NOT NULL,
    item_id uuid NOT NULL,
    value bigint NOT NULL,
    tags text[],
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);

CREATE TABLE sessions (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    device_id text NOT NULL,
    device_info text,
    created_at timestamp with time zone,
    last_used_at timestamp with time zone,
    expires_at timestamp with time zone NOT NULL,
    revoked_at timestamp with time zone
);

CREATE TABLE student_attempts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    test_id uuid NOT NULL,
    status text NOT NULL,
    started_at timestamp with time zone NOT NULL,
    submitted_at timestamp with time zone,
    time_taken_seconds bigint,
    score numeric(6,2),
    total_marks numeric(6,2),
    correct_count bigint,
    wrong_count bigint,
    unattempted_count bigint,
    mode text DEFAULT 'exam'::text NOT NULL,
    expires_at timestamp with time zone,
    config_snapshot jsonb,
    attempt_no bigint DEFAULT 1 NOT NULL,
    auto_submitted boolean DEFAULT false NOT NULL,
    active_session_id uuid,
    created_at timestamp with time zone
);

CREATE TABLE student_question_states (
    user_id uuid NOT NULL,
    question_id uuid NOT NULL,
    times_seen bigint DEFAULT 0 NOT NULL,
    times_answered bigint DEFAULT 0 NOT NULL,
    times_correct bigint DEFAULT 0 NOT NULL,
    last_result text,
    first_seen_at timestamp with time zone,
    last_seen_at timestamp with time zone,
    last_answered_at timestamp with time zone,
    srs_due_at timestamp with time zone,
    srs_interval bigint DEFAULT 0 NOT NULL
);

CREATE TABLE subjects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    course_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    order_index bigint DEFAULT 0 NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);

CREATE TABLE subscription_plans (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    course_id uuid NOT NULL,
    duration_days bigint NOT NULL,
    price_paise bigint NOT NULL,
    currency text DEFAULT 'INR'::text NOT NULL,
    benefits text[],
    is_active boolean NOT NULL,
    created_by uuid NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);

CREATE TABLE subscriptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    plan_id uuid NOT NULL,
    course_id uuid NOT NULL,
    status text NOT NULL,
    start_date timestamp with time zone,
    end_date timestamp with time zone,
    auto_renew boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);

CREATE TABLE tags (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slug text NOT NULL,
    label text NOT NULL,
    alias_of uuid,
    created_at timestamp with time zone
);

CREATE TABLE test_questions (
    test_id uuid NOT NULL,
    question_id uuid NOT NULL,
    "position" bigint NOT NULL
);

CREATE TABLE tests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    description text,
    course_id uuid NOT NULL,
    module_type text NOT NULL,
    requires_subscription boolean NOT NULL,
    subject_id uuid,
    chapter_id uuid,
    created_by uuid NOT NULL,
    total_questions bigint DEFAULT 0 NOT NULL,
    duration_minutes bigint,
    marks_per_correct numeric(5,2) NOT NULL,
    marks_per_wrong numeric(5,2) NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    rejection_reason text,
    origin text DEFAULT 'authored'::text NOT NULL,
    owner_user_id uuid,
    visibility text DEFAULT 'public'::text NOT NULL,
    blueprint jsonb,
    blueprint_schema_version bigint,
    mode text DEFAULT 'exam'::text NOT NULL,
    expires_at timestamp with time zone,
    archived_at timestamp with time zone,
    rating_avg numeric(3,2) DEFAULT 0 NOT NULL,
    rating_count bigint DEFAULT 0 NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);

CREATE TABLE topics (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    chapter_id uuid NOT NULL,
    name text NOT NULL,
    order_index bigint DEFAULT 0 NOT NULL,
    created_at timestamp with time zone
);

CREATE TABLE user_feedbacks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    category text NOT NULL,
    message text NOT NULL,
    app_version text,
    device_os text,
    created_at timestamp with time zone
);

CREATE TABLE user_watch_histories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    content_item_id uuid NOT NULL,
    progress_seconds bigint DEFAULT 0 NOT NULL,
    is_completed boolean DEFAULT false NOT NULL,
    last_watched_at timestamp with time zone NOT NULL
);

CREATE TABLE users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    phone_number text NOT NULL,
    name text,
    role text DEFAULT 'student'::text NOT NULL,
    profile_photo_key text,
    selected_course_id uuid,
    can_manage_all_content boolean DEFAULT false NOT NULL,
    kyc_status text DEFAULT 'not_required'::text NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    last_login_at timestamp with time zone
);

CREATE TABLE video_notes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    content_item_id uuid NOT NULL,
    timestamp_seconds bigint DEFAULT 0 NOT NULL,
    body text NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);

CREATE TABLE wellness_contents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    category text NOT NULL,
    body_text text NOT NULL,
    media_url text,
    content_format text DEFAULT 'plain'::text NOT NULL,
    media_id uuid,
    is_active boolean NOT NULL,
    created_by uuid NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);

ALTER TABLE ONLY admin_audit_logs
    ADD CONSTRAINT admin_audit_logs_pkey PRIMARY KEY (id);

ALTER TABLE ONLY attempt_answers
    ADD CONSTRAINT attempt_answers_pkey PRIMARY KEY (id);

ALTER TABLE ONLY background_jobs
    ADD CONSTRAINT background_jobs_pkey PRIMARY KEY (id);

ALTER TABLE ONLY blueprint_shares
    ADD CONSTRAINT blueprint_shares_pkey PRIMARY KEY (code);

ALTER TABLE ONLY bookmark_collections
    ADD CONSTRAINT bookmark_collections_pkey PRIMARY KEY (id);

ALTER TABLE ONLY bookmarks
    ADD CONSTRAINT bookmarks_pkey PRIMARY KEY (id);

ALTER TABLE ONLY brain_hacks
    ADD CONSTRAINT brain_hacks_pkey PRIMARY KEY (id);

ALTER TABLE ONLY chapters
    ADD CONSTRAINT chapters_pkey PRIMARY KEY (id);

ALTER TABLE ONLY content_items
    ADD CONSTRAINT content_items_pkey PRIMARY KEY (id);

ALTER TABLE ONLY content_reports
    ADD CONSTRAINT content_reports_pkey PRIMARY KEY (id);

ALTER TABLE ONLY courses
    ADD CONSTRAINT courses_pkey PRIMARY KEY (id);

ALTER TABLE ONLY csv_import_batches
    ADD CONSTRAINT csv_import_batches_pkey PRIMARY KEY (id);

ALTER TABLE ONLY csv_import_row_errors
    ADD CONSTRAINT csv_import_row_errors_pkey PRIMARY KEY (id);

ALTER TABLE ONLY custom_test_presets
    ADD CONSTRAINT custom_test_presets_pkey PRIMARY KEY (id);

ALTER TABLE ONLY custom_test_requests
    ADD CONSTRAINT custom_test_requests_pkey PRIMARY KEY (user_id, idempotency_key);

ALTER TABLE ONLY custom_test_templates
    ADD CONSTRAINT custom_test_templates_pkey PRIMARY KEY (id);

ALTER TABLE ONLY daily_activities
    ADD CONSTRAINT daily_activities_pkey PRIMARY KEY (id);

ALTER TABLE ONLY flashcard_decks
    ADD CONSTRAINT flashcard_decks_pkey PRIMARY KEY (id);

ALTER TABLE ONLY flashcard_states
    ADD CONSTRAINT flashcard_states_pkey PRIMARY KEY (user_id, card_id);

ALTER TABLE ONLY flashcards
    ADD CONSTRAINT flashcards_pkey PRIMARY KEY (id);

ALTER TABLE ONLY home_updates
    ADD CONSTRAINT home_updates_pkey PRIMARY KEY (id);

ALTER TABLE ONLY kyc_records
    ADD CONSTRAINT kyc_records_pkey PRIMARY KEY (id);

ALTER TABLE ONLY media_assets
    ADD CONSTRAINT media_assets_pkey PRIMARY KEY (id);

ALTER TABLE ONLY media_refs
    ADD CONSTRAINT media_refs_pkey PRIMARY KEY (media_id, owner_type, owner_id, field);

ALTER TABLE ONLY notification_prefs
    ADD CONSTRAINT notification_prefs_pkey PRIMARY KEY (user_id);

ALTER TABLE ONLY notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);

ALTER TABLE ONLY otp_requests
    ADD CONSTRAINT otp_requests_pkey PRIMARY KEY (id);

ALTER TABLE ONLY payment_records
    ADD CONSTRAINT payment_records_pkey PRIMARY KEY (id);

ALTER TABLE ONLY platform_settings
    ADD CONSTRAINT platform_settings_pkey PRIMARY KEY (key);

ALTER TABLE ONLY push_tokens
    ADD CONSTRAINT push_tokens_pkey PRIMARY KEY (id);

ALTER TABLE ONLY question_notes
    ADD CONSTRAINT question_notes_pkey PRIMARY KEY (user_id, question_id);

ALTER TABLE ONLY question_revisions
    ADD CONSTRAINT question_revisions_pkey PRIMARY KEY (id);

ALTER TABLE ONLY question_stats
    ADD CONSTRAINT question_stats_pkey PRIMARY KEY (question_id);

ALTER TABLE ONLY question_tags
    ADD CONSTRAINT question_tags_pkey PRIMARY KEY (question_id, tag_id);

ALTER TABLE ONLY questions
    ADD CONSTRAINT questions_pkey PRIMARY KEY (id);

ALTER TABLE ONLY ratings
    ADD CONSTRAINT ratings_pkey PRIMARY KEY (user_id, item_type, item_id);

ALTER TABLE ONLY sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);

ALTER TABLE ONLY student_attempts
    ADD CONSTRAINT student_attempts_pkey PRIMARY KEY (id);

ALTER TABLE ONLY student_question_states
    ADD CONSTRAINT student_question_states_pkey PRIMARY KEY (user_id, question_id);

ALTER TABLE ONLY subjects
    ADD CONSTRAINT subjects_pkey PRIMARY KEY (id);

ALTER TABLE ONLY subscription_plans
    ADD CONSTRAINT subscription_plans_pkey PRIMARY KEY (id);

ALTER TABLE ONLY subscriptions
    ADD CONSTRAINT subscriptions_pkey PRIMARY KEY (id);

ALTER TABLE ONLY tags
    ADD CONSTRAINT tags_pkey PRIMARY KEY (id);

ALTER TABLE ONLY test_questions
    ADD CONSTRAINT test_questions_pkey PRIMARY KEY (test_id, question_id);

ALTER TABLE ONLY tests
    ADD CONSTRAINT tests_pkey PRIMARY KEY (id);

ALTER TABLE ONLY topics
    ADD CONSTRAINT topics_pkey PRIMARY KEY (id);

ALTER TABLE ONLY user_feedbacks
    ADD CONSTRAINT user_feedbacks_pkey PRIMARY KEY (id);

ALTER TABLE ONLY user_watch_histories
    ADD CONSTRAINT user_watch_histories_pkey PRIMARY KEY (id);

ALTER TABLE ONLY users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);

ALTER TABLE ONLY video_notes
    ADD CONSTRAINT video_notes_pkey PRIMARY KEY (id);

ALTER TABLE ONLY wellness_contents
    ADD CONSTRAINT wellness_contents_pkey PRIMARY KEY (id);

CREATE INDEX idx_admin_audit_logs_action ON admin_audit_logs USING btree (action);

CREATE INDEX idx_admin_audit_logs_actor_id ON admin_audit_logs USING btree (actor_id);

CREATE UNIQUE INDEX idx_attempt_question ON attempt_answers USING btree (attempt_id, question_id);

CREATE INDEX idx_background_jobs_run_after ON background_jobs USING btree (run_after);

CREATE INDEX idx_background_jobs_status ON background_jobs USING btree (status);

CREATE INDEX idx_background_jobs_type ON background_jobs USING btree (type);

CREATE INDEX idx_blueprint_shares_owner_id ON blueprint_shares USING btree (owner_id);

CREATE INDEX idx_bookmark_collections_key ON bookmark_collections USING btree (key);

CREATE INDEX idx_bookmark_collections_owner_id ON bookmark_collections USING btree (owner_id);

CREATE UNIQUE INDEX idx_bookmark_item ON bookmarks USING btree (user_id, item_type, item_id);

CREATE INDEX idx_bookmarks_collection_id ON bookmarks USING btree (collection_id);

CREATE INDEX idx_brain_hacks_author_id ON brain_hacks USING btree (author_id);

CREATE INDEX idx_brain_hacks_status ON brain_hacks USING btree (status);

CREATE INDEX idx_chapters_subject_id ON chapters USING btree (subject_id);

CREATE INDEX idx_content_items_chapter_id ON content_items USING btree (chapter_id);

CREATE INDEX idx_content_items_course_id ON content_items USING btree (course_id);

CREATE INDEX idx_content_reports_assignee_id ON content_reports USING btree (assignee_id);

CREATE INDEX idx_content_reports_item_id ON content_reports USING btree (item_id);

CREATE INDEX idx_content_reports_reporter_id ON content_reports USING btree (reporter_id);

CREATE INDEX idx_content_reports_status ON content_reports USING btree (status);

CREATE UNIQUE INDEX idx_courses_slug ON courses USING btree (slug);

CREATE INDEX idx_csv_import_row_errors_batch_id ON csv_import_row_errors USING btree (batch_id);

CREATE INDEX idx_custom_test_presets_course_id ON custom_test_presets USING btree (course_id);

CREATE INDEX idx_custom_test_templates_user_id ON custom_test_templates USING btree (user_id);

CREATE INDEX idx_flashcard_decks_chapter_id ON flashcard_decks USING btree (chapter_id);

CREATE INDEX idx_flashcard_decks_course_id ON flashcard_decks USING btree (course_id);

CREATE INDEX idx_flashcard_decks_status ON flashcard_decks USING btree (status);

CREATE INDEX idx_flashcard_states_due_at ON flashcard_states USING btree (due_at);

CREATE INDEX idx_flashcards_deck_id ON flashcards USING btree (deck_id);

CREATE INDEX idx_kyc_records_user_id ON kyc_records USING btree (user_id);

CREATE INDEX idx_media_assets_owner_id ON media_assets USING btree (owner_id);

CREATE INDEX idx_media_assets_sha256 ON media_assets USING btree (sha256);

CREATE INDEX idx_media_assets_status ON media_assets USING btree (status);

CREATE INDEX idx_media_refs_media_id ON media_refs USING btree (media_id);

CREATE INDEX idx_notifications_user_id ON notifications USING btree (user_id);

CREATE INDEX idx_otp_requests_phone_number ON otp_requests USING btree (phone_number);

CREATE UNIQUE INDEX idx_payment_records_razorpay_order_id ON payment_records USING btree (razorpay_order_id);

CREATE INDEX idx_payment_records_user_id ON payment_records USING btree (user_id);

CREATE UNIQUE INDEX idx_push_tokens_token ON push_tokens USING btree (token);

CREATE INDEX idx_push_tokens_user_id ON push_tokens USING btree (user_id);

CREATE INDEX idx_question_revisions_question_id ON question_revisions USING btree (question_id);

CREATE INDEX idx_question_revisions_status ON question_revisions USING btree (status);

CREATE INDEX idx_question_tags_tag_id ON question_tags USING btree (tag_id);

CREATE INDEX idx_questions_chapter_id ON questions USING btree (chapter_id);

CREATE INDEX idx_questions_content_hash ON questions USING btree (content_hash);

CREATE INDEX idx_questions_subject_id ON questions USING btree (subject_id);

CREATE INDEX idx_questions_test_id ON questions USING btree (test_id);

CREATE INDEX idx_ratings_item_id ON ratings USING btree (item_id);

CREATE INDEX idx_sessions_expires_at ON sessions USING btree (expires_at);

CREATE INDEX idx_sessions_user_id ON sessions USING btree (user_id);

CREATE INDEX idx_sqs_user_result ON student_question_states USING btree (user_id, last_result);

CREATE INDEX idx_student_attempts_test_id ON student_attempts USING btree (test_id);

CREATE INDEX idx_student_attempts_user_id ON student_attempts USING btree (user_id);

CREATE INDEX idx_subjects_course_id ON subjects USING btree (course_id);

CREATE INDEX idx_subscriptions_user_id ON subscriptions USING btree (user_id);

CREATE UNIQUE INDEX idx_tags_slug ON tags USING btree (slug);

CREATE INDEX idx_test_questions_question_id ON test_questions USING btree (question_id);

CREATE INDEX idx_tests_archived_at ON tests USING btree (archived_at);

CREATE INDEX idx_tests_chapter_id ON tests USING btree (chapter_id);

CREATE INDEX idx_tests_course_id ON tests USING btree (course_id);

CREATE INDEX idx_tests_origin ON tests USING btree (origin);

CREATE INDEX idx_tests_owner_user_id ON tests USING btree (owner_user_id);

CREATE INDEX idx_tests_subject_id ON tests USING btree (subject_id);

CREATE INDEX idx_topics_chapter_id ON topics USING btree (chapter_id);

CREATE UNIQUE INDEX idx_user_date ON daily_activities USING btree (user_id, date);

CREATE INDEX idx_user_feedbacks_user_id ON user_feedbacks USING btree (user_id);

CREATE INDEX idx_user_watch_histories_content_item_id ON user_watch_histories USING btree (content_item_id);

CREATE INDEX idx_user_watch_histories_user_id ON user_watch_histories USING btree (user_id);

CREATE UNIQUE INDEX idx_users_phone_number ON users USING btree (phone_number);

CREATE INDEX idx_video_notes_content_item_id ON video_notes USING btree (content_item_id);

CREATE INDEX idx_video_notes_user_id ON video_notes USING btree (user_id);

ALTER TABLE ONLY attempt_answers
    ADD CONSTRAINT fk_attempt_answers_attempt FOREIGN KEY (attempt_id) REFERENCES student_attempts(id);

ALTER TABLE ONLY attempt_answers
    ADD CONSTRAINT fk_attempt_answers_question FOREIGN KEY (question_id) REFERENCES questions(id);

ALTER TABLE ONLY chapters
    ADD CONSTRAINT fk_chapters_subject FOREIGN KEY (subject_id) REFERENCES subjects(id);

ALTER TABLE ONLY content_items
    ADD CONSTRAINT fk_content_items_chapter FOREIGN KEY (chapter_id) REFERENCES chapters(id);

ALTER TABLE ONLY content_items
    ADD CONSTRAINT fk_content_items_course FOREIGN KEY (course_id) REFERENCES courses(id);

ALTER TABLE ONLY content_items
    ADD CONSTRAINT fk_content_items_reviewer FOREIGN KEY (reviewed_by) REFERENCES users(id);

ALTER TABLE ONLY content_items
    ADD CONSTRAINT fk_content_items_uploader FOREIGN KEY (uploaded_by) REFERENCES users(id);

ALTER TABLE ONLY csv_import_batches
    ADD CONSTRAINT fk_csv_import_batches_teacher FOREIGN KEY (teacher_id) REFERENCES users(id);

ALTER TABLE ONLY csv_import_batches
    ADD CONSTRAINT fk_csv_import_batches_test FOREIGN KEY (test_id) REFERENCES tests(id);

ALTER TABLE ONLY csv_import_row_errors
    ADD CONSTRAINT fk_csv_import_row_errors_batch FOREIGN KEY (batch_id) REFERENCES csv_import_batches(id);

ALTER TABLE ONLY daily_activities
    ADD CONSTRAINT fk_daily_activities_user FOREIGN KEY (user_id) REFERENCES users(id);

ALTER TABLE ONLY kyc_records
    ADD CONSTRAINT fk_kyc_records_reviewer FOREIGN KEY (reviewed_by) REFERENCES users(id);

ALTER TABLE ONLY kyc_records
    ADD CONSTRAINT fk_kyc_records_user FOREIGN KEY (user_id) REFERENCES users(id);

ALTER TABLE ONLY payment_records
    ADD CONSTRAINT fk_payment_records_subscription FOREIGN KEY (subscription_id) REFERENCES subscriptions(id);

ALTER TABLE ONLY payment_records
    ADD CONSTRAINT fk_payment_records_user FOREIGN KEY (user_id) REFERENCES users(id);

ALTER TABLE ONLY platform_settings
    ADD CONSTRAINT fk_platform_settings_updater FOREIGN KEY (updated_by) REFERENCES users(id);

ALTER TABLE ONLY questions
    ADD CONSTRAINT fk_questions_test FOREIGN KEY (test_id) REFERENCES tests(id);

ALTER TABLE ONLY sessions
    ADD CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users(id);

ALTER TABLE ONLY student_attempts
    ADD CONSTRAINT fk_student_attempts_test FOREIGN KEY (test_id) REFERENCES tests(id);

ALTER TABLE ONLY student_attempts
    ADD CONSTRAINT fk_student_attempts_user FOREIGN KEY (user_id) REFERENCES users(id);

ALTER TABLE ONLY subjects
    ADD CONSTRAINT fk_subjects_course FOREIGN KEY (course_id) REFERENCES courses(id);

ALTER TABLE ONLY subscription_plans
    ADD CONSTRAINT fk_subscription_plans_course FOREIGN KEY (course_id) REFERENCES courses(id);

ALTER TABLE ONLY subscription_plans
    ADD CONSTRAINT fk_subscription_plans_creator FOREIGN KEY (created_by) REFERENCES users(id);

ALTER TABLE ONLY subscriptions
    ADD CONSTRAINT fk_subscriptions_course FOREIGN KEY (course_id) REFERENCES courses(id);

ALTER TABLE ONLY subscriptions
    ADD CONSTRAINT fk_subscriptions_plan FOREIGN KEY (plan_id) REFERENCES subscription_plans(id);

ALTER TABLE ONLY subscriptions
    ADD CONSTRAINT fk_subscriptions_user FOREIGN KEY (user_id) REFERENCES users(id);

ALTER TABLE ONLY tests
    ADD CONSTRAINT fk_tests_chapter FOREIGN KEY (chapter_id) REFERENCES chapters(id);

ALTER TABLE ONLY tests
    ADD CONSTRAINT fk_tests_course FOREIGN KEY (course_id) REFERENCES courses(id);

ALTER TABLE ONLY tests
    ADD CONSTRAINT fk_tests_creator FOREIGN KEY (created_by) REFERENCES users(id);

ALTER TABLE ONLY tests
    ADD CONSTRAINT fk_tests_reviewer FOREIGN KEY (reviewed_by) REFERENCES users(id);

ALTER TABLE ONLY tests
    ADD CONSTRAINT fk_tests_subject FOREIGN KEY (subject_id) REFERENCES subjects(id);

ALTER TABLE ONLY user_feedbacks
    ADD CONSTRAINT fk_user_feedbacks_user FOREIGN KEY (user_id) REFERENCES users(id);

ALTER TABLE ONLY user_watch_histories
    ADD CONSTRAINT fk_user_watch_histories_content_item FOREIGN KEY (content_item_id) REFERENCES content_items(id);

ALTER TABLE ONLY user_watch_histories
    ADD CONSTRAINT fk_user_watch_histories_user FOREIGN KEY (user_id) REFERENCES users(id);

ALTER TABLE ONLY users
    ADD CONSTRAINT fk_users_selected_course FOREIGN KEY (selected_course_id) REFERENCES courses(id);

ALTER TABLE ONLY wellness_contents
    ADD CONSTRAINT fk_wellness_contents_creator FOREIGN KEY (created_by) REFERENCES users(id);
