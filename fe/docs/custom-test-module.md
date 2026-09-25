# Custom Test Module — Feature Specification

| | |
|---|---|
| **Status** | **v0.2 — decisions D1–D11 accepted as recommended; scope extended** (rich content/images everywhere, teacher authoring flow, bookmarks/reports/ratings, follow-on epics from notes.md — see §5A and §12). Implementation plans: [FE todo](custom-test-module-fe-todo.md) · [BE todo](custom-test-module-be-todo.md). |
| **Origin** | [notes.md §B.1](../notes.md) — "Custom / user-created test modules" |
| **Reference product** | Marrow (see §13 for what is assumed vs. verified) |
| **Grounded against** | `fe/` and `be/` as of branch `dev` @ `0cc39f3`. Backend was **read only**; no `be/` changes are proposed as edits here, only as a handoff contract (§10). |
| **Next document** | Technical design (data model, API contract, FE architecture) — written *after* the scoping decisions in §12. |

---

## 0. How to read this document

This is the **inventory of everything the Custom Test Module could be**. It is deliberately broader than what we will build. The next step is to walk the feature IDs, cut scope, and only then write the technical design.

- **Feature IDs** look like `CM-B3`. Letter = area, number = feature. Use these when discussing scope.
- **Priority**
  - **P0** — foundation / MVP. Without it the module is not a module.
  - **P1** — fast follow. Expected by students who know Marrow-style apps.
  - **P2** — differentiators, retention, depth.
  - **P3** — exploratory. Do not design around it, but do not block it.
- **Suffixes** like `Q3a` / `B5b` mean a feature row that carries two priorities (e.g. `Q3` = P0 authored difficulty, P2 empirical difficulty; `B5` = P0 simple filter, P1 target mix). In the roll-up (§15) `a` is the earlier tier, `b`/`c` the later ones.
- **Owner**: `FE` (this repo's `fe/`), `BE` (Go service in `be/`, owned by someone else), `FE+BE`, `Content` (question authoring / data work).
- **Deps**: other feature IDs or roadmap items from `notes.md` (A.1 Bookmarks, C.1 Report, D.1 CSV schema, …).

---

## 1. Goals, non-goals, principles

### 1.1 What this module is

A student-facing module where the student **assembles their own practice test** from the platform's existing question content — choosing what to be tested on (subjects, chapters, topics), how much (question count), how hard, in which mode (timed exam or tutor), and which questions (never-seen, previously-wrong, bookmarked, …) — and then takes it through the *same* attempt → result → review pipeline as every other test.

It is a **peer of Q Bank / Test Series / Practice**, not a sub-feature of Practice (`notes.md` §B.1).

### 1.2 Goals

1. A student can go from Home to "test running" in **≤ 4 taps** for the common case (preset or "same as last time").
2. The module is **course-agnostic** (9th, 10th, NEET UG today; anything the admin adds tomorrow) — nothing hard-codes "Physics/Chemistry/Botany/Zoology".
3. **Extensible by configuration and registration, not by editing screens** — new filters, question types, scoring rules, modes and result widgets plug in (§CM-E).
4. Results feed **real learning analytics**: the point of a custom test is to fix weak spots, so the module must close the loop (weak topic → new custom test).
5. Server-authoritative: question selection, timing, scoring and answer disclosure are decided by the backend, never trusted from the client.

### 1.3 Non-goals (for this document's scope)

- Teacher-authored tests (already exist: `create-test.tsx`, CSV upload).
- Live / scheduled / proctored cohort tests.
- Social features beyond optional share-a-blueprint (CM-L9, P3).
- Replacing Q Bank / Test Series / Practice. They keep working exactly as today.

### 1.4 Design principles

- **Config over code.** Anything a product person might want to change (limits, presets, marking scheme options, which sources are eligible) is data, not a release.
- **Snapshot everything at generation time.** A generated test never changes underneath the student (questions, order, marking scheme, mode).
- **One attempt pipeline.** Custom tests reuse attempt/answer/submit/result/review. No parallel scoring path.
- **Honest empty states.** If the pool can't satisfy the request, say exactly why and offer the nearest valid alternative — never silently return fewer questions.
- **No fabricated data.** (Learned the hard way — see the mock-review-data fix in `notes.md` "Recently shipped".)

---

## 2. Current-state audit — what the codebase actually constrains

These are facts from reading the code, not assumptions. Each one shapes a decision later in this document. **Items marked ⛔ are hard blockers for the module; ⚠️ are things that will bite us; ℹ️ are useful facts.**

| # | Finding | Evidence | Impact on this module |
|---|---|---|---|
| A1 | ⛔ **There is no question bank.** Every `Question` belongs to exactly one `Test` (`test_id NOT NULL`). "Pulling from the existing question bank" (notes §B.1) isn't possible today — the bank is just the union of questions inside tests. | `be/internal/models/models.go` → `Question.TestID` | Need a way for one question to appear in a generated test without copying it. Biggest design decision (D1, §12). |
| A2 | ⛔ **Questions carry no metadata of their own.** No subject, chapter, difficulty, tags, NCERT page, source, year. Subject/chapter live on the *parent test* only. | `Question` struct; CSV columns in `fe/app/(teacher)/csv-upload.tsx` (`question_text, option_a..d, correct_option, explanation`) | Can't filter "difficulty" or "topic" at question level. Needs `notes.md` §D.1 (richer CSV schema) as a **prerequisite**, not a parallel item. |
| A3 | ⛔ **Students cannot create tests.** `POST /teacher/tests` is teacher/admin only; `/tests/*` is student read-only and lists **only `published`** tests. | `be/cmd/api/main.go` route groups (`/teacher` vs `/tests`) | Needs a student-scoped generation endpoint. |
| A4 | ⛔ **`GET /tests` has no owner concept.** If a generated custom test were stored as a normal published `Test`, it would appear in every student's Q Bank/Practice lists. | `TestHandler.ListTests` filters only by status/course/module/subject/chapter | Generated tests need an owner + visibility, or a separate listing path. |
| A5 | ⛔ **`notes.md`'s "client-side generation flow assembling a `practice` test on demand" is not viable.** Question text is only returned by `GET /tests/:id/questions`, which requires an active attempt on that specific test; there is no endpoint that reads questions across tests. | `TestHandler.GetQuestions` | Generation must be server-side. Update notes §B.1 accordingly. |
| A6 | ⚠️ **Timer is client-only.** The server never checks `duration_minutes`. `SubmitAttempt` accepts a submit at any time; the FE computes remaining time from `attempt.started_at` vs. **device clock**. On expiry the FE *navigates to the submit-confirm screen* rather than auto-submitting. | `ScoringService.SubmitAttempt`; `test-question.tsx` (timer effect) | Timed custom tests need server-enforced deadline, auto-submit, and server-time-based countdown. |
| A7 | ⚠️ **Per-question time is dropped.** FE `UpsertAnswerRequest` sends `time_taken_seconds`, but the backend request struct only has `selected_option`, so it's discarded. | `fe/src/api/attempts.ts` vs `be/.../attempts.go` `upsertAnswerRequest` | Time-per-question analytics need a BE change. FE contract already half-exists. |
| A8 | ⚠️ **"Clear response" fails.** FE sends `selected_option: null`; backend rejects anything not A–D with 400. FE swallows it as `saveError`. | `test-question.tsx` `clearResponse` vs `AttemptHandler.UpsertAnswer` | Existing bug; custom module needs clear + mark-for-review to work. Flag to tracker. |
| A9 | ⚠️ **Subject analytics assume one subject per test.** Progress breakdown joins `attempt_answers → questions → tests → subjects` via `tests.subject_id`. A cross-subject custom test has `subject_id = NULL` and is silently dropped from subject accuracy. | `ProfileHandler.GetProgressBreakdown` SQL | Analytics must move to *question-level* subject/chapter (depends on A2). |
| A10 | ⚠️ **`UpsertAnswer` doesn't verify the question belongs to the attempt's test**, and `GetReview` returns every `attempt_answers` row with the correct option. A student who knows any question UUID can upsert it and read its key in review. | `ScoringService.UpsertAnswer`, `AttemptHandler.GetReview` | Low exploitability today (UUIDs), but a shared pool with many-to-many membership raises exposure. Harden as part of the module (CM-S2). |
| A11 | ⚠️ **Review order isn't guaranteed.** `GetReview` runs `Find(&answers)` with no `ORDER BY`. Unanswered rows are created lazily at submit. | `AttemptHandler.GetReview`, `SubmitAttempt` | Review filters/ordering by question position need an explicit order column. |
| A12 | ⚠️ **`module_type` is stringly-typed and unvalidated.** `CreateTest` casts the request string straight into the enum. FE hard-codes the three labels in at least: `test-history.tsx`, `test-pre-start.tsx`, `test-result.tsx` (`canRetake`), `moderation-tests.tsx`, `create-test.tsx`, `csv-upload.tsx`, `hierarchy.tsx` (title), and the three category cards in `(practice)/index.tsx`. | grep of `module_type` | Adding `'custom'` = touching ≥ 8 places. This *is* the extensibility problem; fix it once with a module registry (CM-E1). |
| A13 | ⚠️ **Attempt has no config snapshot.** `StudentAttempt` stores results only; mode, marking scheme, filters used are not recorded. Marking scheme is read live from `Test` at submit. | `StudentAttempt`, `SubmitAttempt` | Need a blueprint + snapshot so history/analytics can say *what* was generated. |
| A14 | ⚠️ **Content moderation pipeline is per-test.** `draft → pending_review → approved → published` with admin review. A generated test must **not** enter this pipeline (its questions are already approved). | `SubmitForReview`, `AdminApproveTest`, `PublishTest` | Generated tests need their own lifecycle. |
| A15 | ⚠️ **Retake semantics are hard-coded.** `canRetake = qbank || practice` (test-result). `GetOrCreateAttempt` allows only one *in-progress* attempt per (user, test). | `test-result.tsx`; `ScoringService.GetOrCreateAttempt` | Retaking a custom test must be an explicit product decision (CM-L3). |
| A16 | ℹ️ **Curriculum API exists and is reusable.** `GET /courses/:id/curriculum` returns Course → Subject → Chapter with `test_count` per chapter (not `question_count`). | `fe/src/api/courses.ts` | Builder's subject/chapter picker can use it; need `question_count` (per filter) for live availability. |
| A17 | ℹ️ **Access gating is per test.** `requires_subscription` + `course_id`, checked inline in the `POST /tests/:id/attempts` route via `SubscriptionService.CheckAccess`; admins bypass. KYC gate optional. | `main.go` (route), `subscription_service.go` | Need a rule for entitlement of a *mixed* test (§CM-X). |
| A18 | ℹ️ **`PlatformSetting` (key/value) already exists** with an admin write path (`kyc-required`). | `models.PlatformSetting`, `KYCHandler` | Natural home for module limits/feature flag without a new table. |
| A19 | ℹ️ **Reusable FE runtime.** `test-pre-start → test-question → test-submit-confirm → test-result → test-review` already implements palette, timer, autosave-per-tap, resume-from-answers, review with palette bottom-sheet. | `fe/app/(student)/(practice)/*` | Custom tests should enter this flow, not fork it. |
| A20 | ℹ️ **Home already has an `EXPLORE` row and a (disabled) Updates carousel**; Practice hub has 3 hard-coded category cards. | `(student)/(home)/index.tsx`, `(practice)/index.tsx` | Entry points exist (CM-I6). |
| A21 | ℹ️ **Only MCQ-single, 4 options (A–D).** Enum `CorrectOption` = A/B/C/D; question text/options are plain `text`. No images, LaTeX, multi-correct, numeric. | `models.CorrectOption`, `Question` | Constrains question types; rich content is a separate track (CM-Q7, CM-E4). |

**Added in v0.2 (found while scoping images, authoring and the dependent roadmap items):**

| # | Finding | Evidence | Impact |
|---|---|---|---|
| A22 | ⛔ **The app renders no images at all.** Zero `<Image>` usages in `fe/app` or `fe/src`; `expo-image`, `expo-image-picker`, `expo-image-manipulator` are not installed (only `expo-camera`, `expo-document-picker`, `react-native-webview`, `expo-video`). No test runner is configured either (`package.json` has no `test` script). | grep + `package.json` | The shared renderer is a from-scratch build, not an upgrade. |
| A23 | ⛔ **No upload purpose exists for question/content images.** Allowed purposes are only `kyc_document`, `video`, `csv`, `profile_photo`. Presigned PUT has no server-side size/dimension check and there is no "upload complete" confirmation step. | `be/internal/handlers/uploads.go` | Needs a media pipeline (validate, dimensions, variants), not just a new enum value. |
| A24 | ⛔ **Every question field is plain `text`** (`question_text`, `option_a–d`, `explanation`); FE screens render them as raw `<Text>` in ≥ 7 places (`test-question`, `test-review`, teacher `content-preview`, `question-builder`, admin `content-preview-detail`, …). | grep of `question_text`/`option_a` | Renderer must be adopted at every one of those sites, and legacy plain text must keep rendering exactly as before. |
| A25 | ⚠️ **CSV import cannot carry images**, and only creates rows (no update-by-id). The teacher question editor is text-only, one question at a time. | `csv_import_service.go`, `question-builder.tsx` | Teacher authoring needs CSV+images, preflight validation, bulk edit and update mode (§CM-TA). |
| A26 | ⚠️ **A published question can never be corrected.** `UpdateQuestion` returns 409 unless the parent test is `draft`/`rejected`. A wrong answer key found after publish has no fix path. | `TestHandler.UpdateQuestion` | Need a correction flow (CM-TA10) before Reports (C.1) can do anything useful. |
| A27 | ⚠️ **Brain Hacks are frontend-only mocks.** `create-brain-hack.tsx` fakes saving with `setTimeout`; `brain-hack-detail.tsx` renders a hard-coded `HACKS` record; the backend has no brain-hack model (admin dashboard counts `content_type = 'brain_hack'` but `CreateContent` rejects anything except `video`/`document`). `notes.md` §D.2 describes it as "text/image-only today" — it is neither, yet. | files named | Brain Hacks need a real backend before "image (or video) support" means anything (CM-FO4). |
| A28 | ⚠️ **`StartAttempt` contract mismatch.** The FE expects `{ attempt (with `test` preloaded), answers[] }`; the repo's handler returns a bare `StudentAttempt` with no `Test` preloaded (`GetOrCreateAttempt` has no `Preload`). Either the deployed backend is ahead of this repo or the runtime relies on something not in `be/`. | `fe/src/api/attempts.ts` vs `attempts.go`/`scoring_service.go` | Verify against the deployed API before building on it (BE-0 task). |
| A29 | ⚠️ **Prod schema changes = `AutoMigrate` on both API and worker start-up.** No SQL migrations exist; the code comment itself says prod should use `golang-migrate`. `AutoMigrate` won't backfill data or reliably add the constraints/indexes this module needs. | `be/internal/db/db.go`, `cmd/*/main.go` | Adopt versioned migrations before the big schema change (D17). |
| A30 | ℹ️ **Private bucket, presigned URLs.** Files are served via `PresignGet` (2 h TTL, `resolveContentURL`). Presigned URLs change on every request, which defeats naive image caching. | `content.go`, `storage/s3.go` | FE must cache by stable media id (`expo-image` `cacheKey`), not by URL (D13). |
| A31 | ℹ️ **`notes.md`'s "video doesn't play" item is stale.** `video-player.tsx` now uses `expo-video` `VideoView` (commits "update videoplayer", "Update video player (#8)"). The "blocked on real video playback" gating for A.4 / D.2 needs re-checking, not assuming. | `video-player.tsx` | Unblocks a re-evaluation of CM-I9 / CM-FO5. |

**Consequence in one sentence:** the *test-taking* half of this module is mostly reuse; the *question-pool + generation + analytics* half is net-new and sits on backend changes that the frontend cannot fake.

---

## 3. Concepts and glossary

| Term | Meaning |
|---|---|
| **Question pool** | The set of approved questions eligible for custom selection. Not a separate product — the union of eligible questions across published tests, subject to source rules (CM-Q2). |
| **Blueprint** | A declarative description of *what the student asked for*: filters, count, difficulty mix, mode, marking scheme, timing. Versioned JSON. Saved, re-run, cloned, shared. |
| **Generated test** (a.k.a. custom test instance) | The frozen result of running a blueprint once: an ordered list of question IDs + resolved config. |
| **Attempt** | Same meaning as today: a student's run through a test. A generated test may have many attempts (CM-L3). |
| **Mode** | How the attempt behaves: `exam` (answers hidden until submit), `tutor` (answer + explanation revealed per question), `quick` (short, untimed, streak-style). |
| **Question status** (per student) | Derived per (student, question): `unattempted`, `correct`, `incorrect`, `bookmarked`, `flagged`, … Powers "only show me what I got wrong". |
| **Preset / template** | A system- or user-saved blueprint one tap away ("Daily 20", "Weak areas", "NEET 45-min mini"). |
| **Source** | Where a question originates: Q Bank test, Practice test, Test Series test, previous-year set. Some sources may be excluded from the pool (D2). |
| **Module definition** | A registry entry that describes a module type (key, label, icon, entry route, builder schema, capabilities). Q Bank, Test Series, Practice, Custom and (future) Flashcards are all module definitions. |

---

## 4. Personas and access rules

| Persona | What they do here | Rules |
|---|---|---|
| **Student (paid)** | Full builder, all filters, unlimited generation within caps. | Entitled per course subscription. |
| **Student (free / starter)** | Limited use — e.g. only free-flagged questions, daily generation cap, or a fixed question ceiling. | Exact policy = decision D5. Must degrade gracefully with an upsell, not a dead end. |
| **Teacher** | Does not use the builder. Sees *question-level* stats and reports for their content (CM-M4). | Only own content unless `can_manage_all_content`. |
| **Admin** | Configures module (flags, limits, presets, taxonomy), monitors pool health, triages reports. Can preview any generated test. Can bypass gating (already true in `CheckAccess`). | — |
| **Preview-mode user** | `app/preview-mode.tsx` exists. Must see a **read-only** builder with generation disabled, or be routed to auth. | Decide in tech design. |

---

## 5. Feature catalogue

Format: **ID — Feature.** Description. `Pri · Owner · Deps`.

### CM-Q — Question pool & metadata (foundation)

The module is only as good as the pool. Most of this area is a prerequisite for the rest.

| ID | Feature | Detail | Pri · Owner · Deps |
|---|---|---|---|
| CM-Q1 | **Question-level taxonomy** | Every question gets its own `subject`, `chapter`, and optional `topic` (finer than chapter), independent of the parent test's location. Backfill from parent test where present. Analytics and filters read the question's own fields. (Fixes A2, A9.) | P0 · BE+Content · D.1 |
| CM-Q2 | **Eligibility rules for the pool** | Configurable per source type which questions are custom-eligible: e.g. Q Bank ✅, Practice ✅, Test Series ⚠️ (excluded by default — spoils full-length mocks), previous-year ✅. Only from `published` tests. Per-question kill switch (`custom_eligible=false`) for teachers/admin. | P0 · BE · — |
| CM-Q3 | **Difficulty** | `easy / medium / hard` authored via CSV/builder, **plus** an *empirical* difficulty computed from cohort accuracy once N attempts exist (CM-A9). Selection can use either; UI shows authored until empirical is trustworthy. | P0 (authored) / P2 (empirical) · BE+Content · D.1 |
| CM-Q4 | **Tags (hashtags)** | Free-form, admin-curated vocabulary with autocomplete (avoid `#neet`, `#NEET`, `#Neet` fragmentation — normalise case/whitespace, alias table). Filterable in builder. | P1 · BE+Content · D.1 |
| CM-Q5 | **NCERT reference** | `ncert_class`, `ncert_page` (and optionally line/figure). Lets a student say "only from NCERT pages 40–60" and lets review link back to source. | P1 · Content · D.1 |
| CM-Q6 | **Provenance & attribution** | `source_test_id`, `source_type`, `year`/`exam` for previous-year questions ("NEET 2021"), authoring teacher, approval date. | P1 · BE · — |
| CM-Q7 | **Rich question content** | **Promoted to P0 and expanded in §5A (CM-RC).** Images in stem/options/explanation across the whole app; LaTeX/chemistry; tables. | **P0** · FE+BE · see CM-RC |
| CM-Q8 | **De-duplication** | Content hash (normalised stem + options) so the same question appearing in two source tests can't appear twice in one generated test and isn't double-counted in stats. | P0 · BE · — |
| CM-Q9 | **Question versioning** | If a teacher fixes a wrong key after students attempted it, past attempts must keep their scored result, while future generations use the fixed version. Also decide whether to re-score (CM-M5). | P1 · BE · C.1 |
| CM-Q10 | **Pool health metrics** | Per subject/chapter/difficulty: eligible count, untagged count, missing-metadata count, reported-question count. Drives builder availability and admin dashboards (CM-M3). | P1 · BE · — |
| CM-Q11 | **Question types beyond single-MCQ** | Multi-correct, numeric/integer answer (JEE-style, and NEET-like "assertion-reason", "match the column"), true/false. Data model must not assume A–D from day one even if UI ships MCQ first (see CM-E4). | P2 · FE+BE · — |

### CM-B — Builder (the creation experience)

| ID | Feature | Detail | Pri · Owner · Deps |
|---|---|---|---|
| CM-B1 | **Course-scoped builder** | Builder operates within the student's selected course; switching course re-scopes everything. | P0 · FE · — |
| CM-B2 | **Subject multi-select** | Select one or more subjects. Course-driven list (from `getCurriculum`), never hard-coded. Select-all / clear. | P0 · FE · A16 |
| CM-B3 | **Chapter (and topic) multi-select** | Nested under subjects; tri-state parent checkboxes; search; expand/collapse; "select all chapters in subject". Shows per-node **available question count** reflecting the *current filters*. | P0 · FE+BE · CM-Q1 |
| CM-B4 | **Question count** | Stepper + numeric input + quick chips (10/20/30/50/90). Bounded by pool availability and admin max (CM-M2). | P0 · FE · — |
| CM-B5 | **Difficulty filter / mix** | Simple: multi-select `easy/medium/hard`. Advanced: target mix (e.g. 30/50/20) with graceful fallback when a bucket is short (CM-G4). | P0 (simple) / P1 (mix) · FE+BE · CM-Q3 |
| CM-B6 | **Question-status filter** | Include only: **All / Unattempted (never seen) / Incorrect (last time) / Correct / Bookmarked / Flagged**. Multi-select with union semantics. Marrow's signature feature and the key to "practise your weak spots". | P1 · FE+BE · A.1 Bookmarks, CM-Q1 |
| CM-B7 | **Tag filter** | Autocomplete chips; include/exclude. | P1 · FE · CM-Q4 |
| CM-B8 | **Source filter** | Q Bank / Practice / Previous-year (and Test Series if D2 allows). Also "only PYQs". | P1 · FE · CM-Q2, CM-Q6 |
| CM-B9 | **NCERT range filter** | Class + page-range slider/inputs. | P2 · FE · CM-Q5 |
| CM-B10 | **Exclusions** | "Skip questions I attempted in the last N days"; "skip anything from tests I've already taken". | P1 · FE+BE · — |
| CM-B11 | **Subject weightage (distribution)** | When multiple subjects: split count *evenly*, *proportional to available*, or *custom weights* (e.g. NEET pattern 45/45/90). | P1 · FE+BE · CM-G3 |
| CM-B12 | **Live availability & validation** | As filters change, show "N questions match" (debounced server call). Disable Start when 0; when N < requested, offer one-tap "use N" or "relax filters". Explain *which* filter is the bottleneck. | P0 · FE+BE · CM-G6 |
| CM-B13 | **Ordering** | `random` (default), `by chapter/syllabus order`, `easy → hard`, `hardest first`, `unattempted first`. | P1 · FE+BE · — |
| CM-B14 | **Title & description** | Auto-title ("Physics · Thermodynamics · 20Q") editable; optional note. | P0 · FE · — |
| CM-B15 | **Save as template** | Toggle to save the blueprint into "My templates" (CM-L5) instead of/in addition to running it. | P1 · FE+BE · — |
| CM-B16 | **Builder UX shell** | Single scrollable form with sticky summary bar (`20Q · 30 min · Tutor · Start`) vs. stepper wizard — decide in design. Must be usable one-handed, keyboard-safe, and match `theme/tokens` (light/dark). Draft state survives backgrounding. | P0 · FE · — |
| CM-B17 | **Quick-start entry** | One tap "Repeat last test", "Continue where you left off", and a preset row above the full builder for the ≤4-tap goal. | P1 · FE · CM-L5 |
| CM-B18 | **Recent blueprints** | Last 5 blueprints as chips ("Physics · Optics · 25Q"). | P2 · FE · — |

### CM-C — Test configuration & modes

| ID | Feature | Detail | Pri · Owner · Deps |
|---|---|---|---|
| CM-C1 | **Timed / untimed** | Timed: duration auto-suggested (e.g. 1 min/question, editable, NEET-pace option ≈ 1.0 min/Q) with min/max bounds. Untimed: no clock, no expiry. | P0 · FE+BE · A6 |
| CM-C2 | **Exam mode** | Answers/explanations hidden until submit. Identical to today's runtime. | P0 · FE · A19 |
| CM-C3 | **Tutor mode** | After locking an answer, reveal correct option + explanation immediately; answer becomes read-only. Requires a server "check/reveal" step so keys are never shipped to the client up-front. | P1 · FE+BE · CM-S1 |
| CM-C4 | **Quick mode** | Short untimed sets (5–10) — overlaps Flashcards "quick questions" (A.2). Same engine, minimal chrome. | P2 · FE · A.2 |
| CM-C5 | **Marking scheme** | Presets: NEET (+4/−1), no-negative (+1/0), custom (+x / −y) with sanity bounds. Uses fields the `Test` model already has (`marks_per_correct`, `marks_per_wrong`). Snapshot on generation (A13). | P0 · FE+BE · — |
| CM-C6 | **Negative marking toggle** | Shortcut over CM-C5 for casual users. | P0 · FE · CM-C5 |
| CM-C7 | **Option shuffling** | Randomise option order per question (server-side, recorded so review shows what the student saw). Optional; default off for exam-pattern fidelity. | P2 · BE · — |
| CM-C8 | **Per-question time guidance** | Optional soft timer per question with a nudge (not enforced). Feeds time-analysis (CM-A5). | P2 · FE · A7 |
| CM-C9 | **Pause / resume** | Untimed: free pause. Timed: default *no pause* (matches pre-start copy "clock cannot be paused"); optional admin-enabled limited pauses. Resume-from-background is already supported by autosave. | P1 · FE+BE · A6 |
| CM-C10 | **Sections** | Group questions by subject with per-section navigation (and optionally per-section timing) for multi-subject tests, like the real NEET pattern. | P2 · FE+BE · CM-B11 |
| CM-C11 | **Instructions screen** | Reuse `test-pre-start`; contents generated from resolved config (mode, timing, marking) instead of static strings. | P0 · FE · — |
| CM-C12 | **Config summary & confirm** | Pre-start recap of resolved config + how many questions actually generated vs. requested. | P0 · FE · CM-G6 |

### CM-G — Generation engine (backend behaviour the FE depends on)

| ID | Feature | Detail | Pri · Owner · Deps |
|---|---|---|---|
| CM-G1 | **Server-side generation from a blueprint** | `POST` a blueprint → server selects questions and returns a generated test. Client never receives a full pool. | P0 · BE · A3, A5 |
| CM-G2 | **Snapshot** | Persist ordered question IDs, resolved marking scheme, mode, duration and the blueprint used. Immutable after creation. | P0 · BE · A13 |
| CM-G3 | **Selection strategies (pluggable)** | `random`, `weighted-by-subject`, `weak-first` (lowest accuracy topics), `unseen-first`, `spaced` (due for revision), `sequential`. Strategy chosen by blueprint; new strategies register without API change (CM-E2). | P0 (random) / P1 / P2 · BE · — |
| CM-G4 | **Fallback / relaxation policy** | Explicit, reported: when a difficulty/subject bucket is short, either (a) fail, (b) borrow from adjacent bucket, or (c) return fewer. Response states what happened; never silent. | P0 · BE · — |
| CM-G5 | **Determinism & idempotency** | Optional `seed` for reproducible generation (support, "re-roll", sharing). Client-supplied idempotency key so a retried request doesn't create duplicates. | P1 · BE · — |
| CM-G6 | **Preview / dry-run** | `count`-only endpoint used by the builder (CM-B12) — same filters, no persistence. | P0 · BE · — |
| CM-G7 | **Generated-test lifecycle** | States: `generated → in_progress → completed → archived`; **bypasses** review/approval (A14). Optional TTL for never-started tests. | P0 · BE · — |
| CM-G8 | **Limits & quotas** | Max questions/test, max active generated tests, daily generation cap (entitlement-aware). Read from `PlatformSetting` (A18). | P1 · BE · CM-X |
| CM-G9 | **Performance budget** | Generation p95 < ~500 ms on the target pool size; avoid `ORDER BY random()` full scans on large pools. | P1 · BE · — |
| CM-G10 | **Pool-change safety** | If a question is retired after generation, existing generated tests keep it (snapshot) but flag it; new generations exclude it. | P1 · BE · CM-Q9 |

### CM-T — Test-taking runtime (mostly reuse, some new)

| ID | Feature | Detail | Pri · Owner · Deps |
|---|---|---|---|
| CM-T1 | **Enter existing runtime** | Route a generated test into `test-pre-start → test-question → submit-confirm → result → review` unchanged in look and behaviour. | P0 · FE · A19 |
| CM-T2 | **Palette** | Already present (grid sheet). Extend states: *answered / unanswered / marked / visited-not-answered*. | P0 · FE · — |
| CM-T3 | **Mark for review** | Toggle per question; persisted on the attempt so it survives resume; shown in palette + submit-confirm summary ("3 marked"). | P1 · FE+BE · — |
| CM-T4 | **Clear response** | Works (fix A8). | P0 · FE+BE · A8 |
| CM-T5 | **Server-authoritative timer** | Countdown derived from server `expires_at` (returned on start); FE corrects for clock skew; on expiry FE auto-submits (not just navigates) and server also auto-submits stale timed attempts (job) so a killed app can't leave a timed test open forever. | P0 · FE+BE · A6 |
| CM-T6 | **Autosave & offline tolerance** | Answers saved per tap today. Add: local queue + retry when offline, last-write-wins by `answered_at`, "unsynced" indicator, block submit until flushed (or submit with local answers as a batch). | P1 · FE(+BE batch) · — |
| CM-T7 | **Resume** | Resume banner in hub/history; `test-pre-start` currently hard-codes `isResume=false` — wire it up. | P1 · FE · — |
| CM-T8 | **Per-question bookmark** | Bookmark button in the question header; syncs to Bookmarks (A.1). | P1 · FE+BE · A.1 |
| CM-T9 | **Per-question report** | "Report" action → reasons dropdown (wrong answer / typo / duplicate / outdated). | P1 · FE+BE · C.1 |
| CM-T10 | **Option strike-through** | Long-press an option to cross it out (local only). | P2 · FE · — |
| CM-T11 | **Confidence marking** | "Sure / Unsure / Guess" per answer; stored; used in analytics ("confident-but-wrong"). | P2 · FE+BE · CM-A7 |
| CM-T12 | **Personal notes on a question** | Free-text/markdown note attached to (student, question); visible in review and bookmarks. Aligns with the markdown notes idea in A.4. | P2 · FE+BE · A.4 |
| CM-T13 | **Tutor-mode flow** | Lock → reveal → explanation → Next. Time still tracked. | P1 · FE+BE · CM-C3 |
| CM-T14 | **Submit flow** | Existing confirm modal, extended with unanswered / marked counts and the "expired" variant. | P0 · FE · — |
| CM-T15 | **Screen-capture protection** | Apply the C.3 policy (block for students, allow admin) on the runtime screen. | P2 · FE · C.3 |
| CM-T16 | **Interruption handling** | Phone call / backgrounding / low connectivity never loses answers or double-submits. | P1 · FE · CM-T6 |
| CM-T17 | **Accessibility in runtime** | Dynamic type, screen-reader labels for palette states, tap targets ≥ 44pt, colour-independent state cues. | P1 · FE · — |

### CM-R — Results & review

| ID | Feature | Detail | Pri · Owner · Deps |
|---|---|---|---|
| CM-R1 | **Result summary** | Score / total, correct / wrong / unattempted, accuracy %, time taken vs. allotted. Reuse `test-result`. | P0 · FE · A19 |
| CM-R2 | **Breakdown by subject / chapter / topic** | Computed from *question-level* metadata (fixes A9). Collapsible; sorted worst-first. | P0 (subject/chapter) / P1 (topic) · FE+BE · CM-Q1 |
| CM-R3 | **Breakdown by difficulty** | Accuracy per easy/medium/hard. | P1 · FE+BE · CM-Q3 |
| CM-R4 | **Review with filters** | Filter: All / Correct / Wrong / Unattempted / Marked / Bookmarked. Order by question position (fix A11). Reuse timed review (Recently shipped) — palette + Prev/Next. | P0 (all) / P1 (filters) · FE+BE · A11 |
| CM-R5 | **Explanation view** | Explanation, correct option highlighted, student's option highlighted, NCERT reference link (CM-Q5), "% of students who got this right" (CM-A8). | P0 (basic) / P1 (rest) · FE · — |
| CM-R6 | **Retake** | Retake the *same* generated test (same questions), or **"Regenerate"** (same blueprint, fresh questions). Decide semantics (CM-L3). | P1 · FE+BE · A15 |
| CM-R7 | **"Practise my mistakes"** | One-tap new custom test seeded from this attempt's wrong + unattempted questions. The loop-closing feature. | P1 · FE+BE · CM-B6 |
| CM-R8 | **Share result** | Image card (score, accuracy, streak) via native share sheet. No PII beyond first name. | P3 · FE · — |
| CM-R9 | **Result trend vs. previous** | "+8% vs. your last Thermodynamics test". | P2 · FE+BE · CM-A1 |
| CM-R10 | **Post-result recommendations** | "You're weakest in Optics — start a 15-Q Optics test" → prefilled builder. | P2 · FE+BE · CM-P1 |

### CM-A — Analytics & insights

| ID | Feature | Detail | Pri · Owner · Deps |
|---|---|---|---|
| CM-A1 | **Performance over time** | Score/accuracy trend across custom tests (existing profile "trend" only shows last 10 scores; extend, segment by module). | P1 · FE+BE · — |
| CM-A2 | **Topic mastery map** | Per chapter/topic: attempted, accuracy, last practised, mastery bucket (weak / improving / strong). Heat-map by subject. | P1 · FE+BE · CM-Q1 |
| CM-A3 | **Weak-area detection** | Rule: topic accuracy < threshold over ≥ N answered questions, with recency weighting. Threshold/N = admin config. | P1 · BE · CM-A2 |
| CM-A4 | **Coverage** | "You've seen 312 / 1,140 Physics questions (27%)". Motivates the *unattempted* filter. | P1 · BE · — |
| CM-A5 | **Time analysis** | Avg time/question, slowest questions, time by subject, "rushed vs. stuck". Needs A7 fix. | P2 · FE+BE · A7 |
| CM-A6 | **Attempt-quality signals** | Answer changes count, last-minute changes, guess rate. | P3 · BE · CM-T11 |
| CM-A7 | **Confidence analytics** | Confident-wrong / unsure-right matrix. | P2 · FE+BE · CM-T11 |
| CM-A8 | **Cohort comparison (opt-in)** | Per question "x% got it right"; per test **percentile vs. peers** with min-cohort threshold (no percentile shown under N users) and clear labelling that peers took *different* random tests (compare per-topic, not per-test). | P2 · BE · — |
| CM-A9 | **Empirical difficulty** | Recompute question difficulty from cohort accuracy; feed back into CM-Q3. Nightly job. | P2 · BE · CM-A8 |
| CM-A10 | **Streaks & goals** | Reuse `DailyActivity` (already drives `day_streak`); daily question goal ring; custom-test completions count toward streak. | P2 · FE+BE · — |
| CM-A11 | **Export / data** | Download personal history (CSV/PDF) — probably P3; note for privacy review. | P3 · BE · — |

### CM-L — Library, lifecycle & reuse

| ID | Feature | Detail | Pri · Owner · Deps |
|---|---|---|---|
| CM-L1 | **My custom tests** | List of generated tests with state (not started / in progress / completed), score, date, filters summary. Under Practice hub and Profile. | P0 · FE+BE · — |
| CM-L2 | **History integration** | `test-history.tsx` gains a "Custom" filter (today: All / Q Bank / Test Series / Practice) and shows blueprint summary as the subtitle. | P0 · FE · A12 |
| CM-L3 | **Re-attempt policy** | Options: (a) same questions again ("Retake"), (b) regenerate from same blueprint ("New set"). Attempts to the same generated test are numbered (#1, #2) with per-attempt results. | P1 · FE+BE · A15 |
| CM-L4 | **Rename / pin / delete** | Soft-delete only (analytics need the attempt rows; note `DeleteTest` today hard-deletes attempts — do not reuse that path for generated tests). | P1 · FE+BE · — |
| CM-L5 | **Templates ("saved blueprints")** | Save/run/edit/duplicate/delete personal templates. | P1 · FE+BE · CM-B15 |
| CM-L6 | **System presets** | Admin-authored blueprints shown as cards: *Daily 20*, *Weak areas*, *Chapter sprint*, *PYQ only*, *NEET 45 min*. Data, not code (CM-M1). | P1 · BE+FE · CM-E2 |
| CM-L7 | **Edit-and-rerun** | Open a past blueprint in the builder pre-filled. | P1 · FE · — |
| CM-L8 | **Search & filter my tests** | By subject, date, score band, mode. | P2 · FE · — |
| CM-L9 | **Share a blueprint** | Share a link/code; recipient gets the *blueprint* (not questions) and generates their own. Deep link into builder. Needs abuse rules. | P3 · FE+BE · — |
| CM-L10 | **Scheduled practice** | "Every day 7 pm, 20 weak-area questions" → local/push reminder deep-linking to a pre-built test. | P3 · FE+BE · E.2 push |
| CM-L11 | **Retention policy** | How long generated tests and attempts are kept; storage growth control. | P1 · BE · — |

### CM-P — Personalisation & adaptivity

| ID | Feature | Detail | Pri · Owner · Deps |
|---|---|---|---|
| CM-P1 | **Recommended test** | Home/Explore card: "Recommended for you — 15 Qs on Optics (accuracy 38%)", one tap to start. Rule-based first. | P2 · FE+BE · CM-A3 |
| CM-P2 | **Adaptive difficulty** | Within a session, adjust next-question difficulty from recent correctness (tutor/quick modes). Off by default. | P3 · BE · CM-Q3 |
| CM-P3 | **Spaced repetition** | Re-surface questions the student got wrong at growing intervals; "Due for revision" preset. Shares scheduling model with Flashcards (A.2) — design once. | P2 · BE · A.2 |
| CM-P4 | **Goal-aware suggestions** | Exam date + syllabus progress → suggested weekly plan. | P3 · BE · — |
| CM-P5 | **Personal defaults** | Remember last-used mode/duration/marking scheme. | P1 · FE · — |

### CM-I — Integrations with the rest of the app

| ID | Feature | Detail | Pri · Owner · Deps |
|---|---|---|---|
| CM-I1 | **Bookmarks (A.1)** | Custom tests both *consume* bookmarks (filter CM-B6) and *produce* them (CM-T8). The "3 bookmark categories" open question in A.1 affects the filter UI — resolve together. | P1 · FE+BE · A.1 |
| CM-I2 | **Report a question (C.1)** | Same report flow from runtime and review; reported questions can be auto-excluded from generation past a report threshold. | P1 · FE+BE · C.1 |
| CM-I3 | **Ratings (C.2)** | Thumbs on a question in review ("was this explanation helpful?"). Not a rating of the *generated test*. | P2 · FE+BE · C.2 |
| CM-I4 | **CSV schema (D.1)** | D.1 columns (NCERT page, difficulty, tags) are **the** data source for CM-Q3/Q4/Q5. Sequence D.1 first. | P0 · BE+Content · D.1 |
| CM-I5 | **Flashcards / Explore (A.2, A.3)** | Explore becomes discovery across Flashcards + Q Bank; custom tests appear as a first-class Explore tile. Future: "make a flashcard from a wrong question". | P2 · FE · A.2, A.3 |
| CM-I6 | **Home & navigation entry points** | Quick-link on Student Home (notes §B.1), Practice hub 4th card, Profile → My tests, post-result CTAs. The Practice hub cards become registry-driven (CM-E1). | P0 · FE · — |
| CM-I7 | **Progress screens** | `progress-detail` and profile summary include custom-test stats (module-segmented). | P1 · FE+BE · CM-A1 |
| CM-I8 | **Notifications (E.2)** | Streak nudges, "your weak-area set is ready", scheduled practice. Blocked on push v1 existing. | P3 · FE+BE · E.2 |
| CM-I9 | **Video linkage** | From a wrong-answer review → "Watch the lecture for this chapter" via chapter content. Blocked on real video playback (notes bug). | P3 · FE · video fix |
| CM-I10 | **Wellness tie-in** | After a bad result / long session, surface an MMM (wellness) card — consistent with the product's "embedded well-being" principle. Copy/tone must not be patronising. | P3 · FE · — |

### CM-X — Access, entitlement & monetisation

| ID | Feature | Detail | Pri · Owner · Deps |
|---|---|---|---|
| CM-X1 | **Entitlement rule for mixed tests** | A generated test mixes questions from tests with different `requires_subscription`. Options: (a) require subscription for the whole module; (b) free users draw only from free-flagged questions; (c) free users get N generations/day. Recommend (b)+(c). Decision D5. | P0 · BE · A17 |
| CM-X2 | **Free-tier experience** | Show the full builder; clamp the pool/count; explain *why* ("Free plan: 10 questions from free chapters") with an upgrade sheet (reuse the locked-item bottom sheet from `hierarchy.tsx`). | P0 · FE · CM-X1 |
| CM-X3 | **Subscription expiry mid-attempt** | An in-progress attempt started while entitled may be completed; new generation blocked. | P1 · BE · — |
| CM-X4 | **KYC gate** | Honour the platform `kyc_required` setting the same way as other gated content. | P0 · BE · A17 |
| CM-X5 | **Admin bypass** | Existing behaviour in `CheckAccess`; keep, plus admin "preview" of a blueprint result. | P0 · BE · — |
| CM-X6 | **Course boundary** | Cannot generate across courses; cannot draw from a course the student has no subscription for. | P0 · BE · — |

### CM-M — Admin & teacher operations

| ID | Feature | Detail | Pri · Owner · Deps |
|---|---|---|---|
| CM-M1 | **Module configuration** | Admin screen (or `PlatformSetting` keys) for: module on/off per course, max questions, allowed durations, default marking schemes, eligible sources, free-tier limits, daily caps. Ship via feature flag. | P1 · FE(admin)+BE · A18 |
| CM-M2 | **System presets manager** | CRUD for CM-L6 presets. | P1 · FE(admin)+BE · — |
| CM-M3 | **Pool-health dashboard** | Counts by subject/chapter/difficulty, metadata completeness, low-inventory alerts ("Botany · Ecology has 6 eligible questions"). | P1 · FE(admin)+BE · CM-Q10 |
| CM-M4 | **Question-level stats for teachers** | Attempts, accuracy, avg time, report count per question; flag questions with <20% or >95% accuracy (likely wrong key / too easy). | P2 · FE(teacher)+BE · CM-A8 |
| CM-M5 | **Correction workflow** | When a key is corrected: mark affected attempts, optionally re-score, notify affected students. | P2 · BE · CM-Q9 |
| CM-M6 | **Reported-question queue** | Reuse the Approvals-hub queue pattern (notes C.1). | P1 · FE(admin)+BE · C.1 |
| CM-M7 | **Taxonomy management** | Topics and tag vocabulary CRUD, merge duplicates/aliases. (`manage-subjects` / `course-structure` screens exist for subject/chapter.) | P1 · FE(admin)+BE · CM-Q1, Q4 |
| CM-M8 | **Bulk metadata backfill** | CSV re-import that *updates* metadata on existing questions by ID/hash (existing importer only creates). | P1 · BE · D.1 |
| CM-M9 | **Usage analytics** | Adoption, generation counts, drop-off in builder, most-used filters, empty-pool rate. Feeds roadmap. | P2 · BE+FE(admin) · — |
| CM-M10 | **Audit trail** | Who changed limits / presets / eligibility, when. | P2 · BE · — |

### CM-E — Extensibility platform ("most extensible" requirement)

This area is what makes the module *durable* rather than a one-off. Each item is an explicit extension point.

| ID | Feature | Detail | Pri · Owner · Deps |
|---|---|---|---|
| CM-E1 | **Module registry (FE)** | One typed registry (`ModuleDefinition`: `key`, `label`, `icon`, `entryRoute`, `capabilities`, `historyLabel`, `canRetake`, `pillColor`, …) replaces the ≥ 8 hard-coded `'qbank'\|'test_series'\|'practice'` switches (A12). Custom is the 4th entry; Flashcards the 5th. **This is the FE refactor to do first.** | P0 · FE · A12 |
| CM-E2 | **Server-driven builder schema** | `GET builder-config?course_id=` returns the *dimensions available for this course*: subjects/chapters (+counts), difficulty levels, status filters, sources, tags, limits, modes, marking presets, presets. FE renders a generic form from it; new filter = server change + a renderer only if the widget type is new. Includes `schema_version` for compatibility. | P0 · FE+BE · CM-G6 |
| CM-E3 | **Filter registry** | Filters are `{id, label, widget: 'multiselect'\|'range'\|'toggle'\|'tree'\|'tags', options-source, param-encoding}`. FE widget catalogue is small and fixed; filters are open-ended. | P0 · FE+BE · CM-E2 |
| CM-E4 | **Question-type registry** | `QuestionRenderer` per `question_type` (`mcq_single` now; `mcq_multi`, `numeric`, `assertion_reason`, `match`, `image_mcq` later) with matching *answer input*, *palette state* and *scoring strategy*. Runtime never `switch`es on A–D directly. | P1 (scaffold) · FE+BE · CM-Q11 |
| CM-E5 | **Scoring strategy interface** | `score(question, answer, scheme) → marks`. Supports partial credit, per-section schemes, integer answers, negative marking variants. Backend interface first; FE only *displays*. | P1 · BE · CM-Q11 |
| CM-E6 | **Selection-strategy interface** | See CM-G3. New strategy = new implementation + config key. | P1 · BE · — |
| CM-E7 | **Runtime-mode interface** | `exam`, `tutor`, `quick`, `review` share the runtime shell; a mode defines *reveal policy*, *timer policy*, *navigation policy*, *submit policy*. | P1 · FE · CM-C2/C3 |
| CM-E8 | **Result-widget registry** | Result screen = ordered list of widgets (`summary`, `subject-breakdown`, `difficulty-breakdown`, `time-analysis`, `recommendations`, …) chosen by module/mode config. Adding analytics = adding a widget. | P1 · FE · — |
| CM-E9 | **Versioned blueprint schema** | `schema_version` on every blueprint; server migrates old blueprints forward so saved templates/shared codes don't rot. Unknown fields are ignored, not fatal. | P0 · BE · — |
| CM-E10 | **Feature flags & remote config** | Per-capability flags (tutor mode, status filters, sharing, …) so partial rollout is possible and half-built parts can ship dark. Builder hides unsupported controls based on `builder-config`. | P0 · FE+BE · CM-E2 |
| CM-E11 | **Course-agnostic taxonomy** | No hard-coded subject names or counts anywhere (note the mock fallback in `GetProgressBreakdown` returns fixed Physics/Chem/Botany/Zoology when empty — must not leak into this module). | P0 · FE+BE · — |
| CM-E12 | **Stable public types** | One `src/api/customTests.ts` + `src/modules/custom/types.ts`; screens depend on types, not raw JSON. Breaking API changes go through a versioned path. | P0 · FE · — |
| CM-E13 | **Event bus / telemetry hooks** | Uniform events (`custom.builder_opened`, `custom.generated`, `custom.started`, `custom.submitted`, …) emitted through one function so an analytics vendor can be swapped. | P1 · FE · CM-N3 |
| CM-E14 | **Localisation-ready copy** | No inline user-facing strings inside logic; strings keyed for later i18n (Hindi is the obvious first ask for 9th/10th). | P2 · FE · — |
| CM-E15 | **Internationalisable content** | Question content locale fields (`lang`), fallback rules. | P3 · BE · — |

### CM-S — Security, integrity & privacy

| ID | Feature | Detail | Pri · Owner · Deps |
|---|---|---|---|
| CM-S1 | **Answer non-disclosure** | Keys/explanations never in the question payload (already true for `GET /tests/:id/questions`). Tutor mode reveals per question *after* lock via a server call; review only after submit. | P0 · BE · — |
| CM-S2 | **Attempt-scoped writes** | `UpsertAnswer` must verify `question_id ∈ attempt's generated test` (A10). Review must return only questions in the attempt. | P0 · BE · A10 |
| CM-S3 | **Pool-scraping resistance** | Rate-limit generation and dry-run counts; cap per-day distinct question exposure for free users; no endpoint returns questions outside an active attempt. (A determined user can *always* screen-record; goal is to make bulk export costly, not impossible.) | P1 · BE · — |
| CM-S4 | **Server-authoritative scoring & time** | Score computed only server-side (already true); deadline enforced server-side (CM-T5). | P0 · BE · A6 |
| CM-S5 | **Screen-capture policy** | See CM-T15 / C.3. Best-effort only; set expectations. | P2 · FE · C.3 |
| CM-S6 | **Privacy of cohort stats** | Minimum-N thresholds; no identifiable peer data; percentile computed on aggregates. | P2 · BE · CM-A8 |
| CM-S7 | **Data retention & deletion** | Account deletion removes personal blueprints/notes/bookmarks; aggregate question stats keep no PII. | P1 · BE · CM-L11 |
| CM-S8 | **Abuse & input validation** | Bound all blueprint fields (counts, ids list length, tag length), reject unknown filters, validate module/mode enums (A12 shows `module_type` isn't validated today). | P0 · BE · — |
| CM-S9 | **Multi-device consistency** | The two-device session limit means one attempt may be opened on two phones. Define behaviour: last-writer-wins on answers, single active runtime (second device gets read-only banner). | P1 · FE+BE · — |

### CM-N — Non-functional & quality

| ID | Feature | Detail | Pri · Owner · Deps |
|---|---|---|---|
| CM-N1 | **Performance** | Builder interactive < 1 s after config load; availability count debounced (~300 ms) with cancellation; question payload for a 90Q test cached in memory only; no re-render storms in palette (test-question.tsx is already ~590 lines — extract). | P0 · FE · — |
| CM-N2 | **Loading / error / empty states** | Follow the existing pattern (`SkeletonBlock`, `ErrorBanner` + retry, `EmptyState`). **No mock fallbacks on error.** Every screen: loading, error, empty, "no entitlement", "pool too small". | P0 · FE · — |
| CM-N3 | **Telemetry** | Funnel: builder open → config change → generate → start → submit → review. Plus error events. Respect privacy consent. | P1 · FE · — |
| CM-N4 | **Accessibility** | WCAG AA contrast in both themes, screen-reader flows for builder trees and palette, reduced-motion respect for `Stagger` animations. | P1 · FE · — |
| CM-N5 | **Theming** | Only `theme/tokens`; light + dark. No raw colours. | P0 · FE · — |
| CM-N6 | **Testing** | BE: unit tests for selection/fallback/scoring; FE: reducer/state tests for builder, contract tests against a recorded `builder-config`. Note: repo has almost no tests today (`role_test.go`, `subscription_service_test.go` only). | P1 · FE+BE · — |
| CM-N7 | **Observability** | Generation latency, empty-pool rate, fallback rate, autosave failure rate, timer-expiry auto-submits. | P1 · BE · — |
| CM-N8 | **Scale assumptions** | Design for ~10⁵ questions, ~10⁴ active students, generation bursts before exams. To be validated with real numbers. | P1 · BE · — |
| CM-N9 | **Backwards compatibility** | Q Bank / Test Series / Practice behave identically; old app versions keep working against a BE that adds `custom` (unknown `module_type` handled gracefully by old clients — currently they'd label it "Practice" via default branches). | P0 · FE+BE · A12 |
| CM-N10 | **Analytics correctness** | Unit-test the accuracy/coverage maths; document formulas (accuracy = correct ÷ *attempted*, or ÷ total? — pick one and use it everywhere; current SQL uses attempted). | P1 · BE · — |

---

## 5A. Scope additions (v0.2)

These extend §5. Where they overlap an earlier row (CM-Q7, CM-I1–I3, CM-M6), **this section wins**.

### CM-RC — Rich content & media (platform-wide — the most important addition)

Images must work in **any type of question, anywhere in the app**, including custom tests. This is a platform capability, not a custom-module feature: it is built once and adopted everywhere.

| ID | Feature | Detail | Pri · Owner · Deps |
|---|---|---|---|
| CM-RC1 | **Rich-text format v1** | Restricted markdown subset stored in the *existing* text columns: paragraphs, bold/italic, sub/superscript, lists, line breaks, inline + block math markers (`$…$`, `$$…$$`), and images as `![alt](media:<uuid>)`. New `content_format` column (`plain` for all existing rows, `rich_v1` for new/edited) so legacy text containing `$`, `*`, `_` is **never** reinterpreted. Any field can hold images: stem, each option, explanation. (D12) | P0 · FE+BE · A24 |
| CM-RC2 | **Media asset model + upload pipeline** | `media_assets` table; `presign → PUT → complete` flow; server verifies size/MIME (sniffing, not trusting the client), records width/height/sha256, generates display + thumbnail variants in the worker, then flips to `ready`. Constraints: jpeg/png/webp, ≤ 5 MB, ≤ 4096 px, **no SVG uploads**. (D13, D15) | P0 · BE+FE · A23 |
| CM-RC3 | **Media delivery** | Content payloads carry a resolved `media` map (`id → {url, thumb_url, width, height, alt}`); private bucket + presigned GET; TTL ≥ test duration + buffer; FE caches by **media id**, not URL (A30). | P0 · BE+FE · A30 |
| CM-RC4 | **`RichContent` renderer (FE)** | One component renders any rich field: text runs, sub/sup, lists, images, math. Images: reserved aspect-ratio box from `width/height` (no layout jump), blur/skeleton placeholder, failure state with retry, tap-to-zoom lightbox, dark-mode-safe backing for transparent diagrams, alt text for screen readers. | P0 · FE · A22 |
| CM-RC5 | **Image-in-option layouts** | Options that are image-only or image+text lay out correctly (large tap target, selection/correct/wrong states readable over an image, 2×2 grid variant for small images). | P0 · FE · CM-RC4 |
| CM-RC6 | **Math & chemistry** | Formula rendering. **Spike-gated** (D14): P0 fallback = teacher uploads the formula as an image + sub/sup text for simple chemistry (H₂O, CO₂); full LaTeX is P1 once the spike picks between on-device KaTeX→SVG with a cache, or authoring-time pre-render. Per-snippet WebViews are **rejected** (a 90-question test would spawn hundreds). | P0 (fallback) / P1 (LaTeX) · FE(+BE) · — |
| CM-RC7 | **Adoption across every surface** | Replace raw `<Text>` for question content in: `test-question`, `test-review`, teacher `content-preview` + `question-builder`, admin `content-preview-detail`, admin `moderation-tests`. Then (P1): Brain Hacks, wellness articles, flashcards, notes, video/document captions. | P0 (questions) / P1 (rest) · FE · A24 |
| CM-RC8 | **Accessibility** | Alt text on every image (required for stem images, warned for option images); screen-reader reads alt; math has a text alternative; zoom respects reduced motion. | P0 · FE+BE · — |
| CM-RC9 | **Media lifecycle** | Dedupe by sha256; reference tracking (`media_refs`); orphan garbage-collection; replace-image keeps references valid; cannot delete a referenced asset. | P1 · BE · CM-RC2 |
| CM-RC10 | **Prefetch & offline** | On test start, prefetch all images for the attempt (display variant) with progress; runtime never blocks a question on a slow image (placeholder + retry); cache eviction policy. | P1 · FE · CM-RC4 |
| CM-RC11 | **Protection posture** | Short-lived URLs, no public bucket, no listing endpoint; screenshot policy via C.3 (best-effort, role-gated). No DRM claim. | P1 · BE+FE · C.3 |
| CM-RC12 | **Audio/video attachments** | Video/audio in explanations and Brain Hacks. Same media model, different processing (reuse Cloudflare Stream path). | P3 · FE+BE · D.2 |

### CM-TA — Teacher authoring flow (dedicated)

The question database is authored **only by teachers**, so they get a first-class flow, not the current one-question-at-a-time form.

| ID | Feature | Detail | Pri · Owner · Deps |
|---|---|---|---|
| CM-TA1 | **Question Bank manager** | A teacher-side browse of *all* their questions across tests — server-paginated, search text, filters (course/subject/chapter/difficulty/tag/reported/missing-metadata/custom-eligible), sort, multi-select. Own content only unless `can_manage_all_content`. | P0 · FE+BE · CM-Q1 |
| CM-TA2 | **Rich question editor** | Replaces `question-builder.tsx`'s form: rich stem/options/explanation with toolbar (bold, italic, sub, sup, list, image, math), image attach per field, live **student-view preview** (exact `RichContent` renderer, light/dark), inline validation checklist, "save & next", edit in place. | P0 · FE · CM-RC4 |
| CM-TA3 | **Media picker / library** | Camera, gallery, files; on-device crop + compress before upload; progress + retry; alt-text prompt; reuse from "my media" library; clear error on rejected files. | P0 · FE+BE · CM-RC2 |
| CM-TA4 | **Metadata editing** | Subject/chapter/topic, difficulty, tags (autocomplete), NCERT class/page, source + year, `custom_eligible`. Defaults inherited from the parent test's chapter. | P0 · FE+BE · D.1 |
| CM-TA5 | **Completeness dashboard + quick-tag** | "312 questions missing difficulty" → a fast one-tap tagging queue for backfilling the existing pool. | P0 · FE+BE · CM-TA4 |
| CM-TA6 | **Bulk actions** | Multi-select → set chapter/difficulty/tags, toggle eligibility, move to another draft test, delete (drafts only). | P1 · FE+BE · CM-TA1 |
| CM-TA7 | **Import v2** | CSV template v2 (new columns: metadata + image columns referencing filenames) and an optional **ZIP bundle** (`questions.csv` + `images/`). **Preflight validation** (dry-run) reports row-level errors *including missing/oversized images* before committing; commit; **update mode** (backfill metadata on existing questions by id/hash). Downloadable error report. | P0 · FE+BE · A25 |
| CM-TA8 | **Duplicate detection** | On save/import: content-hash match against the pool → warning with the matching question(s), teacher chooses keep/skip/link. | P0 · BE+FE · CM-Q8 |
| CM-TA9 | **Draft safety** | Autosave the editor draft locally and server-side; unsaved-changes guard; resume after crash/backgrounding. | P0 · FE · — |
| CM-TA10 | **Corrections on published questions** | Edit a live question → submit a correction with a reason; lightweight admin review (auto-approved for admins/manage-all teachers); version bump; optional re-score of past attempts when the key changes. (D18, fixes A26) | P1 · FE+BE · CM-Q9 |
| CM-TA11 | **Reports inbox** | Teacher sees reports on their questions, jumps into the editor, resolves with a note. | P1 · FE+BE · CM-RP |
| CM-TA12 | **Publish gate** | `submit-for-review` for Q Bank/Practice tests requires chapter + difficulty on every question; the error lists exactly which questions/fields are missing. (D16) | P0 · BE+FE · CM-TA4 |
| CM-TA13 | **Inventory hints** | "Botany · Ecology has 6 questions — most in demand" so authors fill real gaps (fed by pool health, CM-Q10). | P1 · FE+BE · CM-Q10 |
| CM-TA14 | **Question stats** | Attempts, accuracy, avg time, report count per question; outlier flags. | P2 · FE+BE · CM-A8 |
| CM-TA15 | **Author help** | In-app formatting guide (sub/sup, images, math), image guidelines (size, contrast, alt text), template download. | P1 · FE · — |
| CM-TA16 | **Preview-as-student** | Full-test preview through the *real* runtime components (not a bespoke read-only view). | P1 · FE · CM-RC4 |
| CM-TA17 | **Attribution & audit** | Who created/edited/corrected each question and when. | P2 · BE · — |

### CM-BK — Bookmarks (notes A.1 — pulled into scope)

| ID | Feature | Detail | Pri · Owner · Deps |
|---|---|---|---|
| CM-BK1 | **Collections model** | Bookmarks belong to a *collection*. Three system collections seeded and admin-configurable; the schema also allows student-created collections later, so the "admin / student / inferred" question (D6/D19) never forces a migration. | P1 · BE · — |
| CM-BK2 | **Toggle everywhere** | Bookmark button on every question surface (runtime, tutor reveal, review, Q Bank browse) with a collection chooser (defaults to last used; one tap to toggle off). Polymorphic (`question`, `flashcard`, `content`) from day one. | P1 · FE+BE · CM-BK1 |
| CM-BK3 | **My Bookmarks screen** | Profile → My Bookmarks: collection tabs, subject/chapter filter, search, remove, open a question in context, empty state. | P1 · FE · CM-BK2 |
| CM-BK4 | **Practise bookmarks** | "Practise these" CTA → pre-filled custom-test builder (status = Bookmarked, chosen collection). Also the builder's status filter (CM-B6). | P1 · FE+BE · CM-B6 |
| CM-BK5 | **Optimistic + offline-safe** | Toggle updates instantly, syncs in background, reconciles on failure. | P1 · FE · — |
| CM-BK6 | **Note on bookmark** | Optional note attached to a bookmark. | P2 · FE+BE · — |

### CM-RP — Report a question (notes C.1 — pulled into scope)

| ID | Feature | Detail | Pri · Owner · Deps |
|---|---|---|---|
| CM-RP1 | **Report sheet** | From runtime, tutor reveal and review: dropdown of reasons — *Wrong answer marked · Typo / unclear wording · Duplicate · Outdated · **Image missing / unreadable** (new — images make this a real failure mode) · Other* — plus an optional ≤ 300-char note. (D21) | P1 · FE+BE · — |
| CM-RP2 | **Anti-spam** | One open report per (user, question); rate limit; reporter sees "already reported". | P1 · BE · — |
| CM-RP3 | **Routing** | Question author's inbox (CM-TA11) **and** admin Approvals hub "Reports" queue (the queue pattern notes C.1 points to). | P1 · FE+BE · — |
| CM-RP4 | **Auto-hold** | ≥ N distinct reporters (configurable) marks the question `under_review`: excluded from *custom generation* immediately (existing published tests keep working). | P1 · BE · CM-G10 |
| CM-RP5 | **Resolution & feedback** | Statuses: open → fixed / no-change / dismissed; reporter gets an in-app "Thanks — this was corrected" state (push later). | P1 · FE+BE · CM-TA10 |
| CM-RP6 | **Other content types** | Videos, documents, Brain Hacks (`item_type` is polymorphic from the start). | P2 · FE+BE · — |

### CM-RG — Ratings (notes C.2 — pulled into scope)

| ID | Feature | Detail | Pri · Owner · Deps |
|---|---|---|---|
| CM-RG1 | **Question feedback** | 👍/👎 on a question's explanation in review ("was this helpful?"). (D20) | P2 · FE+BE · — |
| CM-RG2 | **Stars on containers** | 1–5 stars on tests (Q Bank / Test Series / Practice), videos, documents, notes/decks; `my_rating`, `rating_avg`, `rating_count` on list + detail payloads. **No free-text reviews** (spam/abuse surface flagged in notes C.2). | P1 · FE+BE · — |
| CM-RG3 | **Eligibility** | Only after the student has *done* the thing (submitted the test / watched ≥ X% of the video) to keep the signal honest. | P1 · BE · — |
| CM-RG4 | **Sort/filter by rating** | Hierarchy lists get `sort=rating` and a "Top rated" chip. | P1 · FE+BE · — |
| CM-RG5 | **Author visibility** | Teacher sees rating + trend on their content. | P2 · FE · — |

### CM-FO — Follow-on epics from `notes.md` that share this platform

Each depends on pieces above; none is required for the Custom Test MVP. Scoped as separate mini-projects that *reuse* CM-RC / CM-BK / CM-E.

| ID | Item (notes ref) | Depends on | Pri |
|---|---|---|---|
| CM-FO1 | **Home carousel + Custom Test quick-link** (E.1, B.1) — un-comment the built carousel, replace placeholder `UPDATES`, add the custom-test tile. | CM-I6 | P0 (quick-link) / P1 (carousel) |
| CM-FO2 | **Explore revamp** (A.3) — discovery across Q Bank, Custom Tests, Flashcards. | CM-FO3 for flashcards half | P2 |
| CM-FO3 | **Flashcards v1** (A.2) — deck/card model on the same rich-content + media + bookmark + spaced-repetition foundations. | CM-RC, CM-BK, CM-P3 | P2 |
| CM-FO4 | **Brain Hacks — real backend + images (+ video later)** (D.2, corrected by A27). | CM-RC | P2 |
| CM-FO5 | **Video notes with markdown** (A.4) — reuses `RichContent` + `RichEditor`. Re-evaluate blocker (A31). | CM-RC | P2 |
| CM-FO6 | **Push notifications v1 → v2** (E.2) — needed for scheduled practice, "your report was fixed", streak nudges. | — | P3 |
| CM-FO7 | **Screen-capture protection** (C.3) — role-gated (`auth.user.role`), applied to runtime + review + video. Best-effort, set expectations. | `expo-screen-capture` | P2 |
| CM-FO8 | **Wellness content with images** — `wellness_content.media_url` already exists in the API type but the screens render hard-coded text. | CM-RC | P2 |

---

## 6. Key user journeys (end-to-end)

### J1 — First custom test (happy path)
Home → "Custom Test" quick-link → builder opens with defaults for selected course → pick *Physics → Thermodynamics, Optics* → counts update live (e.g. "184 questions match") → set 20 questions, Medium+Hard, Timed 20 min, NEET marking → **Start** → pre-start recap → runtime → submit → result with per-chapter breakdown → "Practise my mistakes".

### J2 — Fix weak spots
Result screen / Home recommendation → prefilled builder (*Optics*, Incorrect + Unattempted, 15Q, Tutor) → Start → after finish, coverage and mastery for *Optics* update.

### J3 — Nothing matches
Student picks Botany · Ecology · Hard · Unattempted → 0 matches → builder shows *"Only 4 questions match. Hard is the tightest filter (12 total, 8 already attempted)."* with **Use 4**, **Include Medium**, **Include attempted** actions. Never a blank error.

### J4 — Free user hits the ceiling
Free plan, wants 50 questions → clamps to 10 with sheet: "Free plan: up to 10 questions from free chapters" → **Upgrade** → subscription plans; **Continue with 10** → proceeds.

### J5 — Interrupted timed test
Timed test, app killed at 12:40 of 20:00 → reopen → Practice hub shows "Continue: Thermodynamics · 07:20 left" (server-derived) → resume with prior answers. If the deadline passed while away, server auto-submitted; the hub shows the result instead.

### J6 — Reported question
In review, student reports "wrong answer marked" → dropdown → sent → question excluded from *future generation* if reports ≥ threshold → appears in admin queue → correction → affected attempts flagged (CM-M5).

### J7 — Template
Student saves *Daily 20 (weak areas)* as template → home quick-start tile → one tap → a fresh generation each day.

---

## 7. Screens & navigation (feature-level, not final design)

New or changed FE surfaces. Names are working titles; route conventions follow `app/(student)/(practice)/`.

| Surface | New / changed | Notes |
|---|---|---|
| Practice hub | **Changed** | 4th card "Custom"; card list driven by module registry; "Continue" row for in-progress custom attempt. |
| Custom builder | **New** | The core screen (CM-B*). Sub-sheets: chapter tree picker, tag picker, advanced (mix/weightage/exclusions). |
| Generation loading / result-of-generation | **New (light)** | Shows resolved counts + any relaxation notes before start (CM-G4, CM-C12). |
| Pre-start | **Changed** | Instructions derived from resolved config. |
| Runtime (`test-question`) | **Changed** | Mark-for-review, bookmark, report, tutor reveal, server timer. |
| Submit confirm | **Changed** | Marked/unanswered counts. |
| Result | **Changed** | Widget-based; adds breakdowns + CTAs. |
| Review | **Changed** | Filters, NCERT link, bookmark/report/note. |
| My custom tests / templates | **New** | List + templates tabs. |
| History | **Changed** | "Custom" filter. |
| Progress detail | **Changed** | Custom segment, mastery map. |
| Home | **Changed** | Quick-link tile / recommendation card. |
| Admin: module config, presets, pool health, taxonomy, reports | **New** | Under `(admin)`; reuse Approvals-hub patterns. |
| Teacher: question stats | **New (later)** | CM-M4. |

---

## 8. Data & API implications (summary — detailed design comes after scoping)

Kept intentionally high-level so we don't design before deciding scope.

**Data (conceptual deltas):**
- `questions` gains: `subject_id`, `chapter_id`, `topic_id?`, `difficulty`, `ncert_class/page`, `source_type`, `year`, `custom_eligible`, `content_hash`, `question_type`, `version`, `lang`.
- `tags`, `question_tags`.
- A way for a generated test to reference existing questions without copying: **join table (`test_questions` with `position`)** — see D1.
- `tests` gains: `owner_user_id?`, `visibility` (`public|private`), `origin` (`authored|generated`), `blueprint jsonb`, `blueprint_schema_version`, `expires_at?`; `module_type` gains `custom`.
- `student_attempts` gains: `mode`, `expires_at` (server deadline), `config_snapshot jsonb`.
- `attempt_answers` gains: `marked_for_review`, `time_spent_seconds`, `confidence?`, `position`.
- Per-student per-question rollup (`student_question_state`: status, times seen/correct, last seen) for filters CM-B6/B10 — a table, not a per-request aggregation.
- `question_stats` (cohort aggregates), `question_reports`, `bookmarks`, `question_notes`.
- `platform_settings` keys for limits/flags (A18).

**API (conceptual):** `builder-config`, `blueprint dry-run count`, `generate`, `my generated tests` (list/get/delete), templates CRUD, `reveal` (tutor), mark-for-review, batch answer sync, question-level analytics for review. Existing attempt endpoints stay, with the fixes in §10.

---

## 9. Frontend impact (what changes in `fe/`)

| Area | Change | Refs |
|---|---|---|
| Module registry | New `src/modules/registry.ts`; replace hard-coded `'qbank'\|'test_series'\|'practice'` switches. | `test-history.tsx`, `test-pre-start.tsx`, `test-result.tsx`, `moderation-tests.tsx`, `create-test.tsx`, `csv-upload.tsx`, `hierarchy.tsx`, `(practice)/index.tsx` |
| API layer | New `src/api/customTests.ts`; extend `Test.module_type` union; extend `StudentAttempt` (`mode`, `expires_at`). | `src/api/tests.ts`, `src/api/attempts.ts` |
| Runtime | Extract palette/timer/answer-sync out of the 590-line `test-question.tsx` into hooks (`useAttemptTimer`, `useAnswerSync`) so tutor/exam/quick modes compose. | `test-question.tsx` |
| Curriculum | Builder needs per-filter question counts — extend usage of `getCurriculum` or call the dry-run count endpoint. | `src/api/courses.ts` |
| Theming | Tokens only. | `src/theme/tokens.ts` |
| State | Builder form state as a reducer + context, persisted as an unsent draft; no global store exists today. | — |
| Existing bugs to fix on the way | A8 (clear response), `isResume` hard-coded false, mock fallback data in progress (`GetProgressBreakdown` default subjects). | see §2 |

---

## 10. Backend handoff contract (owner: backend dev)

The FE owner does not change `be/`. These are the things the FE **needs** from the backend, phrased as requirements, to be turned into tickets. Ordered by dependency.

1. **Question metadata + CSV importer** (D.1): `difficulty`, `ncert_page`, `tags`, plus question-level `subject_id/chapter_id/topic`. Importer must also *update* existing rows (CM-M8).
2. **Question ↔ test decoupling** (D1): generated tests reference questions; `GetQuestions`, `SubmitAttempt`, `GetReview`, delete paths all resolve questions through membership, not `questions.test_id`.
3. **Generation endpoints**: dry-run count, generate, list/get/delete mine, `builder-config` (CM-E2).
4. **Attempt hardening**: verify `question_id` belongs to attempt (A10); accept and persist `time_taken_seconds` (A7); accept `null` to clear (A8); return `expires_at`; server auto-submit job; explicit review ordering (A11); `mode` + `config_snapshot`.
5. **Per-student question state** for status filters + coverage.
6. **Analytics**: subject/chapter/topic accuracy from question-level metadata (A9); coverage; trend segmented by module.
7. **Bookmarks / Reports / Notes** (A.1, C.1, T12) — as those roadmap items land.
8. **Entitlement rule** for mixed tests + quotas via `PlatformSetting`.

**FE-first strategy (so FE isn't idle):** the FE can build the *registry refactor*, *builder shell against a mocked `builder-config`*, *runtime hooks extraction*, *result widgets* and *history filter* behind a feature flag with a clearly-labelled **dev-only** fixture — **not** shipped fallback data (see principle in §1.4 and the lesson in notes "Recently shipped").

---

## 11. Phasing

> **v0.2:** the *authoritative* milestone plan (M0–M5, with task IDs, sizes and dependencies) is now in the [FE todo](custom-test-module-fe-todo.md) and [BE todo](custom-test-module-be-todo.md). The list below is the original v0.1 slicing, kept for feature-ID traceability. Deltas: CM-RC (rich content/images) and CM-TA (teacher authoring) are **Phase 0/1**, not later; CM-BK/RP/RG are **Phase 2**.

Slices are ordered by dependency, not by calendar.

- **Phase 0 — Foundations** (mostly BE + content; FE refactor in parallel)
  CM-Q1, Q2, Q3(authored), Q8, I4 (D.1) · CM-E1 (registry), E9, E10, E11, E12 · CM-S2, S8 · fixes A6–A11.
- **Phase 1 — MVP "it works"**
  CM-B1–B4, B5(simple), B12, B14, B16 · CM-C1, C2, C5, C6, C11, C12 · CM-G1, G2, G3(random), G4, G6, G7 · CM-T1, T2, T4, T5, T14 · CM-R1, R2(subject/chapter), R4(all), R5(basic) · CM-L1, L2 · CM-I6 · CM-X1, X2, X4, X5, X6 · CM-N1, N2, N5, N9.
- **Phase 2 — "Marrow-class"**
  CM-B6 (status filters), B7, B8, B10, B11, B13, B15, B17 · CM-C3 (tutor), C9 · CM-T3, T6, T7, T8, T9, T13, T16 · CM-R3, R4(filters), R6, R7 · CM-A1–A4 · CM-L3–L7 · CM-I1, I2, I7 · CM-M1–M3, M6–M8 · CM-E4–E8 · CM-Q4–Q6, Q9, Q10.
- **Phase 3 — depth & retention**
  CM-Q7 (rich content), Q11 · CM-C4, C7, C8, C10 · CM-T10–T12, T15 · CM-A5–A10 · CM-P1, P3, P5 · CM-R9, R10 · CM-I3, I5 · CM-M4, M5, M9, M10.
- **Phase 4 — exploratory**
  CM-P2, P4 · CM-L9, L10 · CM-R8 · CM-I8–I10 · CM-A6, A11 · CM-E15.

---

## 12. Decisions

**v0.2: D1–D11 are accepted as recommended.** Exceptions/refinements: **D10 is settled — images and rich content are P0 and platform-wide** (§5A CM-RC); **D6 is resolved by D19** below. New decisions D12–D22 follow the D1–D11 table; three of them (D19, D20, D22) are my proposals that need your confirmation, flagged ⚑.

| # | Decision | Options | Recommendation |
|---|---|---|---|
| **D1** | How does a generated test reference existing questions? | (A) Copy questions into a new `Test` per generation. (B) Keep questions owned by their source test; generated tests reference them via a join table with `position`. (C) Introduce a first-class `question_bank` and make tests reference it. | **B.** (A) duplicates data and breaks stats/dedupe; (C) is the cleanest end-state but is a large migration touching every existing screen and importer. B gives 90% of the benefit and leaves C reachable later. |
| **D2** | Are Test Series questions eligible? | Yes / No / per-course admin config. | **Configurable, default No** — protects the integrity of full-length mocks. |
| **D3** | Is a generated test a `Test` row (`module_type='custom'`) or a separate entity? | Reuse `Test` / new `custom_tests`. | **Reuse `Test`** with `origin=generated` + owner — keeps attempts/scoring/review/history unchanged. Requires closing A4 (never appear in public lists). |
| **D4** | Retake semantics | Same questions / regenerate / both. | **Both**, explicit labels ("Retake" vs "New set"). |
| **D5** | Free-user policy | Module fully paid / free from free-flagged pool / daily cap. | **Free-flagged pool + small daily cap**, full builder visible (better funnel than a paywall in front of the builder). |
| **D6** | Bookmark categories (A.1) | Admin / student / inferred. | Resolve *with* this module — it changes the builder's status filter UI. |
| **D7** | Mode scope for v1 | Exam only / + Tutor. | **Exam only in Phase 1**, Tutor first in Phase 2 (needs reveal endpoint). |
| **D8** | Cohort percentile | Yes / no / later. | **Later (P2)**, opt-in, min-N — random per-student tests make naive percentile misleading. |
| **D9** | Accuracy definition | correct ÷ attempted vs. correct ÷ total. | **Show both**, headline = correct ÷ attempted (matches existing SQL). |
| **D10** | Rich content (LaTeX/images) timing | Phase 1 / Phase 3. | **Decide with the content team now**: if NEET Physics/Chem questions depend on formulae, plain-text pool will limit real usefulness and this must move up. |
| **D11** | Where does the builder live? | Inside Practice hub / own tab. | **Practice hub card + Home quick-link** for now; own tab only if usage justifies (notes says "own module", not necessarily own tab). |

### New decisions (v0.2)

| # | Decision | Chosen | Why / consequence |
|---|---|---|---|
| **D12** | Rich-text storage format | **Restricted markdown subset in the existing text columns**, images as `![alt](media:<uuid>)`, plus a per-question `content_format` (`plain` \| `rich_v1`). | Zero schema churn on the 6 text fields; legacy plain text stays `plain` so a stray `$` or `*` is never reinterpreted; the format is a safe closed subset (no HTML), so there is no injection surface. Alternative (JSON block tree) is more extensible but forces new columns everywhere; revisit with CM-E4 question types. |
| **D13** | Media storage & delivery | **`media_assets` table; private bucket; presigned GET; resolved `media` map in payloads; FE caches by media id.** | Matches how video/docs are served today (A30). Presigned URLs change per request, so `expo-image` `cacheKey = media id + variant`. Revisit a CDN with signed URLs only if bandwidth cost demands. |
| **D14** | Math/chemistry rendering | **Spike first (FE-B spike).** P0 fallback = formula-as-image + sub/sup. LaTeX only after the spike; **no per-snippet WebViews.** | Formula-heavy NEET content is the real driver of D10, but a wrong rendering architecture would make 90-question tests janky. Image fallback means authoring is never blocked. |
| **D15** | Image upload constraints | **jpeg/png/webp; ≤ 5 MB; ≤ 4096 px longest side; SVG rejected; alt text required on stem images.** Client compresses/crops first; server re-validates by sniffing bytes and generates display (≤ 1600 px webp) + thumbnail variants. | SVG can carry script; presigned PUT cannot enforce size on its own; a `complete` step closes that gap. Limits live in `PlatformSetting` so they can change without a release. |
| **D16** | Publish gate | **Chapter + difficulty required on every question before a Q Bank/Practice test can be submitted for review** (Test Series exempt). | Otherwise the pool silently fills with unfilterable questions. Error lists exact missing fields (CM-TA12). |
| **D17** | Schema migrations | **Adopt versioned SQL migrations (`golang-migrate`) before the schema-heavy work.** `AutoMigrate` on both API and worker start-up is not enough (A29). | Backfills (question metadata, `test_questions`, `student_question_state`) and partial indexes need real migrations. Backend owner's call, but it is a prerequisite ticket (BE-M0). |
| **D18** | Editing published questions | **Correction flow with lightweight review; re-score of past attempts is opt-in per correction.** | Fixes A26. Past attempts keep their recorded result unless the reviewer chooses to re-score. |
| **D19** ⚑ | Bookmark categories (resolves D6) | **Collections are data**: 3 system collections seeded, admin-editable (name/order), each bookmark belongs to one collection; schema allows student-created collections later. **Placeholder names: "Revise later", "Doubts", "Important" — confirm what the 3 categories should actually be.** | notes A.1 says the 3 categories are "organized by the student's stated interest/topic area", which reads differently from intent-based labels. Because collections are rows, either reading is a data change, not a code change — but the *names/meaning* need your input before UI copy is final. |
| **D20** ⚑ | Rating UX | **Stars (1–5) on containers (tests, videos, documents, decks); 👍/👎 on question explanations. No written reviews.** | notes C.2 explicitly leaves the UX call open. Stars for "is this set worth my time", thumbs for "was this explanation helpful". |
| **D21** | Report reasons | notes' four (*Wrong answer marked, Typo/unclear, Duplicate, Outdated*) **+ *Image missing/unreadable* + *Other* (optional ≤ 300-char note).** | Images add a new failure mode; a free-form box is optional, not the primary path (notes C.1). |
| **D22** ⚑ | Authoring surface | **Mobile app first (tablet-friendly editor) with CSV + ZIP as the bulk path.** Web authoring deferred, but the editor is built with `react-native-web` compatibility in mind (`build:web` already exists). | Teachers authoring hundreds of image questions on a phone is painful; the ZIP importer is the pressure valve. If teachers will author mainly on desktop, promote web authoring to M1 — tell me. |

---

## 13. Reference product notes (Marrow)

`notes.md` lists a structured Marrow walkthrough as an *action item before scoping*. **That walkthrough has not been done**; this document was written without access to the Marrow app. What follows is *general knowledge of how Marrow-style custom modules work* and must be **verified** during the walkthrough — treat as hypotheses, not requirements:

| Hypothesis | Where it lands here |
|---|---|
| Student picks subjects/topics from the question bank, chooses a question count and timed/untimed. | CM-B2–B4, C1 |
| Filter by per-student question status (unused / incorrect / correct / bookmarked / marked). | CM-B6 |
| Tutor mode vs. test mode. | CM-C2, C3 |
| Result with subject-wise/topic-wise performance and per-question "% got this right". | CM-R2, A8 |
| Custom modules are saved and re-runnable; "create from mistakes". | CM-L5, R7 |
| Notes on questions, bookmarks, strike-through, confidence/"guess" marking. | CM-T8, T10–T12 |

**Walkthrough checklist (to do):** every control on the builder; defaults; maximum question count; what happens on 0 matches; free-vs-paid limits; result-screen widgets; how they name and lay out status filters; retake vs. regenerate behaviour; tutor-mode reveal UX; offline behaviour; any percentile/rank display.

---

## 14. Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Question pool too small / untagged at launch → builder feels empty. | **High** | High | Ship D.1 + backfill first; pool-health dashboard (CM-M3); honest empty states (J3). |
| Plain-text questions unusable for formula-heavy subjects. | Medium | High | Decide D10 early. |
| Scope explosion — this doc lists ~220 features. | **High** | High | Phase gates (§11); ship Phase 1 dark behind flags. |
| Backend dependency: FE cannot fake generation. | **Certain** | High | Handoff contract (§10); FE-first work limited to refactor/shell. |
| Server-timer change alters behaviour of existing tests. | Medium | Medium | Apply only to attempts that carry `expires_at`; roll out per module. |
| Analytics misleading (random tests, small samples). | Medium | Medium | Min-N, recency weighting, label sample sizes. |
| Pool exfiltration via generation. | Medium | Medium | CM-S3. |
| Existing-app compatibility with new `module_type`. | Medium | Low | CM-N9 — unknown types render as generic. |

---

## 15. Priority roll-up

**P0 (foundation + MVP):** Q1, Q2, Q3a, Q8 · B1–B4, B5a, B12, B14, B16 · C1, C2, C5, C6, C11, C12 · G1, G2, G3a, G4, G6, G7 · T1, T2, T4, T5, T14 · R1, R2a, R4a, R5a · L1, L2 · I4, I6 · X1, X2, X4, X5, X6 · E1, E2, E3, E9, E10, E11, E12 · S1, S2, S4, S8 · N1, N2, N5, N9

**P1:** Q4–Q7, Q9, Q10 · B5b, B6–B8, B10, B11, B13, B15, B17 · C3, C9 · G3b, G5, G8–G10 · T3, T6–T9, T13, T16, T17 · R2b, R3, R4b, R5b, R6, R7 · A1–A4 · L3–L7, L11 · P5 · I1, I2, I7 · X3 · M1–M3, M6–M8 · E4–E8, E13 · S3, S7, S9 · N3, N4, N6–N8, N10

**P2:** Q3b, Q11 · B9, B18 · C4, C7, C8, C10 · G3c · T10–T12, T15 · R9, R10 · A5, A7–A10 · L8 · P1, P3 · I3, I5 · M4, M5, M9, M10 · E14 · S5, S6

**P3:** R8 · A6, A11 · L9, L10 · P2, P4 · I8–I10 · E15

---

**§5A additions (v0.2):**
**P0:** RC1–RC5, RC6 (image fallback), RC7 (question surfaces), RC8 · TA1–TA5, TA7–TA9, TA12 · FO1 (quick-link)
**P1:** RC6 (LaTeX), RC7 (other surfaces), RC9–RC11 · TA6, TA10, TA11, TA13, TA15, TA16 · BK1–BK5 · RP1–RP5 · RG2–RG4 · FO1 (carousel)
**P2:** TA14, TA17 · BK6 · RP6 · RG1, RG5 · FO2–FO5, FO7, FO8
**P3:** RC12 · FO6

---

## 16. Next steps (v0.2)

1. ✅ D1–D11 accepted. **Confirm the three ⚑ items** in §12: D19 (what the 3 bookmark categories are), D20 (stars vs. thumbs), D22 (mobile-first vs. web authoring).
2. **Hand the [BE todo](custom-test-module-be-todo.md) to the backend owner.** Its BE-M0 block (migrations + contract verification) and BE-M1 block (media + question metadata) gate everything else.
3. **Start the [FE todo](custom-test-module-fe-todo.md) "Start here" block** — the platform work (deps, `RichContent` renderer, module registry, test runner) needs no backend.
4. **Marrow walkthrough** (§13) in parallel; mark features keep/cut/add.
5. **Update `notes.md`**: §B.1 (client-side generation not viable), §D.2 (Brain Hacks are FE mocks — A27), and the "video doesn't play" item (stale — A31).
