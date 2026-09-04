# Codon — Product Notes & Roadmap

Forward-looking feature backlog — new product ideas, not bug fixes. For active bugs and in-flight fixes, see [P0-Todos.md](../P0-Todos.md).

Grouped by theme so it scans as a roadmap, not a list of unrelated bullets. Each epic is grounded against the current codebase — "new build," "extend this existing thing," or "already shipped," never guessed.

## Recently shipped

**Dynamic, timed review mode** — `(student)/(practice)/test-review.tsx` is now question-by-question (Previous/Next, not a scrollable list), with a live countdown timer sourced from the test's real duration (color-shifts to warning/danger as time runs low), a progress bar, and a "Review Palette" bottom sheet to jump straight to any question — mirroring the palette already used in the live test-taking screen. Was sitting half-finished on an old, unmerged branch since mid-August; found and integrated while merging branches back into `main`. One thing fixed on the way in: its original error handling silently substituted fabricated mock review data on a fetch failure instead of showing an error — replaced with the real error state + retry pattern the rest of the app uses now.

## A known bug, not a feature — flag for the tracker

**Video playback doesn't actually play video.** `(student)/(learn)/video-player.tsx` has no real video component at all — `playing` is local UI state toggling a play/pause icon over a static black canvas, with no native video player (`expo-video`/`expo-av`) rendering anything underneath. This is consistent with an earlier finding that teacher video upload is itself still mocked (no real file ever gets attached to a video content item) — the "toggle not working" complaint is very likely just the visible symptom of there being no real video to play yet, not a bug in the toggle logic itself. Needs a real investigation pass, but this is a bug-tracker item, not a roadmap epic — noted here only because it surfaced while researching §A.4 below.

## Suggested prioritization

**Now** — small, high-leverage, mostly UI:
- Home carousel (§E.1 — already built, just switched off)
- Report a question (§C.1)

**Next** — real features, moderate scope, no new infra:
- Bookmarks (§A.1)
- Rating system (§C.2)
- Custom test creation (§B.1)
- CSV schema additions — NCERT page, difficulty, tags (§D.1)

**Later** — needs its own infra/research before scoping:
- Dedicated Flashcards module + Explore revamp (§A.2, §A.3)
- Video notes with markdown support (§A.4) — blocked on real video playback existing first
- In-app push notifications v2 + AI (§E.2)
- Anti-piracy / screen-capture protection (§C.3)
- Video support in Brain Hacks (§D.2) — blocked on a working video upload pipeline first

---

## A. Personalized study tools

### A.1 Bookmarks

**Problem:** Students have no way to save a question or piece of content to come back to later. Everything is consumed once, in the moment, or lost.

**Proposed scope:** Bookmarking on questions (Q Bank / Test Series) and flashcards (§A.2), with **3 distinct bookmark categories** organized by the student's stated interest/topic area — not a single flat "saved" list.

**Current state:** No bookmark model, API, or UI exists anywhere in the app today — clean build. Needs: a `bookmarks` table/endpoint, a bookmark toggle on the question and flashcard UI, and a "My Bookmarks" screen (likely under Profile, or under the revamped Explore section, §A.3).

**Open question:** Are the 3 categories admin-configured, student-configured, or system-inferred from subject/chapter? Changes the data model significantly — decide before scoping.

### A.2 Flashcards

**Problem:** No flashcard content type exists today — a new study mode, not an extension of something broken.

**Proposed scope:**
- Flashcards as their own content type, with bookmarking (§A.1) built in from day one.
- A "quick questions" mode — short, time-boxed review sessions distinct from a full Q Bank session.
- Should eventually be a **dedicated module** (its own tab/section), not permanently nested under Learn → Video — fine as a fast v1 location, wrong as a permanent data-model assumption.
- Needs an **index/navigation view** — browsing by subject/chapter/deck, not a single infinite stream.

**Current state:** Zero existing flashcard infrastructure. The single biggest net-new build in this document — scope as its own mini-project.

### A.3 Explore section revamp

**Problem:** The current "Explore" section (the `EXPLORE` tile row on Student Home) is a navigation shortcut, not a discovery surface.

**Proposed scope:** Rebuild Explore as real discovery combining **Flashcards + Q Bank** — browse across both content types instead of picking a destination blind. Custom test modules (§B.1) should also get a quick-link from Home, not just from inside Explore.

**Current state:** "Explore" already exists as a labeled section on `(student)/(home)/index.tsx` — this is a revamp of something real. Depends on Flashcards (§A.2) existing first.

### A.4 Video notes with markdown support

**Problem:** No way to attach notes to a video lesson — a student watching a video has nowhere in-app to jot structured notes tied to what they're watching.

**Proposed scope:** A quick-link from the video renderer to a notes panel/screen, with markdown formatting support, scoped per video (or per chapter).

**Current state:** No notes feature exists anywhere in the app. **Sequencing matters here:** the video player itself doesn't play real video yet (see the bug flagged above) and video content upload is still mocked — building a polished notes feature on top of a player that doesn't actually play anything yet means re-testing this feature once video playback is real. Worth sequencing after that gap closes, not before.

---

## B. Assessment & practice

### B.1 Custom / user-created test modules

**Problem:** Practice tests today are fixed, pre-authored content — no way for a student to assemble their own practice set (subjects, chapters, difficulty, count), the way competitor apps like Marrow support.

**Proposed scope:**
- Let a student build a custom test: subject(s)/chapter(s), question count, difficulty, timed or untimed.
- Scope as a **module type** alongside Q Bank / Test Series / Practice — not a one-off bolted onto Practice — with its own generation logic pulling from the existing question bank.
- Quick-link to custom test creation from Home, not just from within Practice.

**Current state:** The `module_type` field already distinguishes `'qbank' | 'test_series' | 'practice'` on the backend `Test` model — a `'custom'` type (or a client-side generation flow assembling a `practice` test on demand) is a natural extension of that existing enum, not a parallel system.

**Action item:** Do a structured competitive walkthrough of Marrow's custom-test flow specifically before scoping — it's the explicit reference point.

---

## C. Trust, quality & safety

### C.1 Reporting a question

**Problem:** No way for a student to flag a bad or incorrect question — errors sit indefinitely with no feedback loop back to content authors.

**Proposed scope:** A "Report" action on each question (Q Bank, Test Series, review contexts) opening a dropdown of report reasons ("Wrong answer marked," "Typo/unclear wording," "Duplicate," "Outdated") rather than a freeform box — faster for students, easier to triage in bulk.

**Current state:** No report-question flow exists. Connects naturally to the existing content-moderation infrastructure already built for Admin (the Approvals hub) — a reported question could feed the same queue pattern rather than needing a new review surface.

### C.2 Content rating system

**Problem:** No quality signal exists on any content type (Q Bank, Test Series, Videos, Notes) — no way to know what's good without reading it all first, and no feedback loop for authors.

**Proposed scope:** A rating mechanism (star rating, thumbs, or similar — needs a UX call) attached to Q Bank items, Test Series, videos, and notes. Framed as being for the *student's* benefit — likely meant to help them find good content (sortable/filterable by rating), not just a backend quality metric.

**Current state:** No rating model or UI exists. Smallest-scope version: a rating field + average display; written reviews are a bigger content-moderation surface (spam/abuse handling) worth flagging before committing to it.

### C.3 Anti-piracy / content protection

**Problem:** Nothing prevents a student from screen-recording or screenshotting paid video/content, with no distinction for admin's own legitimate need to capture screenshots (support/moderation).

**Proposed scope:** Block screen capture in student-facing content screens (video player, question content) while explicitly preserving screenshot capability for the admin role.

**Current state:** No screen-capture prevention exists anywhere today. Needs native library research before scoping — `expo-screen-capture` provides screenshot/recording detection and blocking, but role-conditional behavior (block for students, allow for admin) needs to be gated on `auth.user.role` wherever it's applied. This is fundamentally best-effort on both platforms — neither iOS nor Android can fully prevent screen recording at the OS level — worth setting that expectation before this gets scoped as "solved."

---

## D. Content authoring

### D.1 CSV bulk upload — richer question schema

**Problem:** The current bulk-upload CSV format is bare-bones — enough to define a question, no metadata for organizing or filtering the question bank at scale.

**Proposed scope:** Extend the CSV schema (and the underlying question model) with:
- **NCERT page number** — ties a question back to its textbook source page.
- **Difficulty level** — enables difficulty-aware custom tests (§B.1) and adaptive practice later.
- **Tag system** (hashtags) — freeform topical tagging beyond the fixed subject/chapter hierarchy.

**Current state:** Real, current CSV columns (`fe/app/(teacher)/csv-upload.tsx`): `question_text, option_a, option_b, option_c, option_d, correct_option, explanation`. Adding 3 optional columns is a contained change touching the template, the question model, and the bulk-import backend parser — scope as one unit since all three share a schema migration.

### D.2 Brain Hacks — video support

**Problem:** Brain Hacks (short study tips) currently only support image + text — no video, limiting the format for tips easier to show than describe.

**Proposed scope:** Add video as a supported media type for Brain Hack content, alongside the existing image option.

**Current state:** Brain Hack creation (`(teacher)/create-brain-hack.tsx`) and detail screens are text/image-only today. **Sequencing matters:** teacher video upload elsewhere in the app (`create-content.tsx`) is itself still using a mocked upload path — build this on top of a *working* video upload pipeline, or it inherits the same gap on day one.

---

## E. Engagement & retention

### E.1 Home carousel

**Problem:** Nothing visible today — flagged as a wanted feature.

**Current state — basically done:** Student Home (`(student)/(home)/index.tsx`) already has a fully-built "Updates" carousel component (auto-advancing, paginated, dot indicators) — it's just **commented out** in the JSX. The cheapest win in this entire document: uncomment it, confirm the `UPDATES` content array reflects real content instead of placeholder copy, ship it. No new engineering required.

### E.2 In-app push notifications v2 (+ AI)

**Problem:** No push notification system exists yet — this note is explicitly framed as "v2," planning ahead of a v1 that doesn't exist.

**Current state:** The Settings screen's "Notifications" toggle is already labeled "Coming soon" — no permission flow, no token registration, no backend endpoint to receive push tokens. That's the actual v1 that needs to exist first. The "AI" pairing (presumably notification content/timing personalization) should stay v2+ until basic push delivery works end to end.
