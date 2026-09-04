# Codon — Product Notes & Roadmap

This is the forward-looking feature backlog — new product ideas, not bug fixes. For active bugs and in-flight fixes, see [P0-Todos.md](../P0-Todos.md).

Grounded against the current codebase where relevant, so each idea below is either "new build," "extend this existing thing," or "already shipped" — not guessed.

## Suggested prioritization

**Now** — small, high-leverage, mostly UI:
- Home carousel (already built, just switched off)
- Report a question
- Video-toggle bug fix

**Next** — real features, moderate scope, no new infra:
- Bookmarks (questions + flashcards)
- Rating system
- Custom test creation
- CSV schema additions (NCERT page, difficulty, tags)

**Later** — needs its own infra/research before scoping:
- Dedicated Flashcards module + Explore revamp
- In-app push notifications v2 + AI
- Anti-piracy / screen-capture protection
- Video support in Brain Hacks

**Done:**
- Dynamic, timed review mode (§5) — shipped via a branch merge the same day this doc was written; see note there.

---

## 1. Bookmarks

**Problem:** Students have no way to save a question or piece of content to come back to later. Everything is consumed once, in the moment, or lost.

**Proposed scope:** Bookmarking on questions (Q Bank / Test Series) and flashcards (see §2), with **3 distinct bookmark categories** organized by the student's stated interest/topic area — not a single flat "saved" list. Needs a small taxonomy decision: are the 3 categories fixed (e.g. "Weak areas," "Revisit before exam," "Interesting") or user-defined?

**Current state:** No bookmark model, API, or UI exists anywhere in the app today — this is a clean build. Will need: a `bookmarks` table/endpoint on the backend, a bookmark toggle on the question and flashcard UI, and a "My Bookmarks" screen (likely under Profile or a new Explore section, see §7).

**Open question:** Are the "3 themes" categories admin-configured, student-configured, or system-inferred from subject/chapter? This changes the data model significantly — worth deciding before scoping.

---

## 2. Flashcards

**Problem:** No flashcard content type exists today — this is a new study mode, not an extension of something broken.

**Proposed scope:**
- Flashcards as their own content type, with bookmarking (§1) built in from day one, not bolted on later.
- A "quick questions" mode — short, sharp review sessions (time-boxed, small batch) distinct from a full Q Bank session.
- Should eventually be a **dedicated module** (its own tab/section), not buried inside Learn → Video as a sub-item — start there if needed for a fast v1, but don't design the data model as if it's permanently nested under Video.
- Needs an **index/navigation view** — browsing flashcards by subject/chapter/deck, not just a single infinite stream.

**Current state:** Zero existing flashcard infrastructure (content type, API, or screens). This is the single biggest net-new build in this list — worth scoping as its own mini-project rather than a quick add.

---

## 3. Explore section revamp

**Problem:** The current "Explore" section (the `EXPLORE` tile row on Student Home — Q Bank, Test Series, Video Classes, Support) is just a navigation shortcut, not a discovery surface.

**Proposed scope:** Rebuild Explore as a real discovery section combining **Flashcards + Q Bank** in one place — browse across both content types instead of picking a destination blind. Custom test modules (§4) should also get a quick-link from Home, not just from inside Explore.

**Current state:** "Explore" already exists as a section on `(student)/(home)/index.tsx` (the label above the quick-access tile grid) — this is a revamp of something real, not a new section from scratch. Depends on Flashcards (§2) existing first.

---

## 4. Custom / user-created test modules

**Problem:** Practice tests today are fixed, pre-authored content — no way for a student to assemble their own practice set (pick subjects, chapters, difficulty, count) the way competitor apps like Marrow support.

**Proposed scope:**
- Let a student build a custom test: choose subject(s)/chapter(s), question count, difficulty, timed or untimed.
- "Broader idea of custom module" suggests this shouldn't be scoped as a one-off feature bolted onto Practice — think of it as a **module type** alongside Q Bank / Test Series / Practice, with its own generation logic pulling from the existing question bank.
- Add a quick-link to custom test creation from Home, not just from within Practice.

**Current state:** The `module_type` field already distinguishes `'qbank' | 'test_series' | 'practice'` on the backend `Test` model — a `'custom'` type (or a client-side-only generation flow that assembles a `practice` test on demand) is a natural extension of that existing enum rather than a parallel system.

**Action item:** "Check on Marrow end to end" — do a structured competitive walkthrough of Marrow's custom-test flow specifically before scoping this, since it's the explicit reference point.

---

## 5. Dynamic, timed review mode — ✅ done

**Problem:** The post-test review screen was static — no timer, no dynamic pacing. Felt like reading a transcript rather than a study session.

**What shipped:** `(student)/(practice)/test-review.tsx` is now question-by-question (Previous/Next, not a scrollable list), with a live countdown timer sourced from the test's real duration (color-shifts to warning/danger as time runs low), a progress bar, and a "Review Palette" bottom sheet to jump straight to any question — mirroring the palette already used in the live test-taking screen, so the review experience now actually feels like re-sitting the test rather than reading a transcript.

**How it happened:** This was sitting half-finished on an old, unmerged branch (`ui`, commit "fix review page") from before this doc even existed — found and integrated while merging branches back into `main`. Its original version had one issue worth knowing about: on a fetch failure it silently fell back to fabricated mock review data instead of showing an error, which would have shown a student fake results under real-looking network conditions. That's been replaced with a real error state + retry, consistent with how every other screen in this app now handles load failures.

---

## 6. Reporting a question

**Problem:** No way for a student to flag a bad or incorrect question — errors just sit there indefinitely with no feedback loop back to content authors.

**Proposed scope:** A "Report" action on each question (in Q Bank, Test Series, and review contexts) opening a dropdown of report reasons (e.g. "Wrong answer marked," "Typo/unclear wording," "Duplicate," "Outdated") rather than a freeform box — faster for students, easier to triage in bulk for admins/teachers.

**Current state:** No report-question flow exists anywhere in the app. This connects naturally to the existing content-moderation/review infrastructure already built for Admin (the Approvals hub) — a reported question could feed the same queue pattern rather than needing a whole new review surface.

---

## 7. Content rating system

**Problem:** No quality signal exists on any content type (Q Bank, Test Series, Videos, Notes) — no way to know what's actually good without reading it all first, and no feedback loop for authors.

**Proposed scope:** A simple rating mechanism (star rating, thumbs, or similar — needs a UX call) attached to Q Bank items, Test Series, videos, and notes. Framed explicitly as being "for his own benefit" in the original note — likely meant to help the *student* find good content (sortable/filterable by rating), not just a backend quality metric.

**Current state:** No rating model or UI exists. Smallest-scope version: a rating field + average display; larger version includes written reviews, which is a bigger content-moderation surface (spam/abuse handling) worth flagging before committing to it.

---

## 8. CSV bulk upload — richer question schema

**Problem:** The current bulk-upload CSV format is bare-bones — just enough to define a question, no metadata for organizing or filtering the question bank at scale.

**Proposed scope:** Extend the CSV schema (and the underlying question model) to include:
- **NCERT page number** — ties a question back to its textbook source page.
- **Difficulty level** — enables difficulty-aware custom tests (§4) and adaptive practice down the line.
- **Tag system** (hashtags) — freeform topical tagging beyond the fixed subject/chapter hierarchy.

**Current state:** Real, current CSV columns (`fe/app/(teacher)/csv-upload.tsx`): `question_text, option_a, option_b, option_c, option_d, correct_option, explanation`. Adding 3 new optional columns is a contained change to the template, the question model, and the bulk-import backend parser — worth scoping as one unit since all three touch the same schema migration.

---

## 9. Brain Hacks — video support

**Problem:** Brain Hacks (short study tips) currently only support image + text — no video, limiting the format for tips that are genuinely easier to show than describe.

**Proposed scope:** Add video as a supported media type for Brain Hack content, alongside the existing image option.

**Current state:** Brain Hack creation (`(teacher)/create-brain-hack.tsx`) and detail screens exist but are text/image-only today. Note: this session found that teacher video upload elsewhere in the app (`create-content.tsx`) is itself still using a mocked upload path — worth building this on top of a *working* video upload pipeline, not before one exists, or it'll inherit the same gap.

---

## 10. Home carousel

**Problem:** Nothing visible today — but flagged in notes as a wanted feature.

**Current state — this one's basically done:** Student Home (`(student)/(home)/index.tsx`) already has a fully-built "Updates" carousel component (auto-advancing, paginated, with dot indicators) — it's just **commented out** in the JSX. This is the cheapest win in this entire document: uncomment it, confirm the `UPDATES` content array reflects real content instead of placeholder copy, and ship it. No new engineering required.

---

## 11. In-app push notifications v2 (+ AI)

**Problem:** No push notification system exists yet at all — this note is explicitly framed as "v2," i.e. planning ahead of a v1 that doesn't exist yet.

**Current state:** Confirmed elsewhere in this project's tracking: the Settings screen's "Notifications" toggle is already labeled "Coming soon" — there's no permission flow, no token registration, no backend endpoint to receive push tokens. That's the actual v1 that needs to exist first. The "AI" pairing mentioned here (presumably notification content/timing personalization) should stay a v2+ idea until basic push delivery is working end to end.

---

## 12. Anti-piracy / content protection

**Problem:** Nothing currently prevents a student from screen-recording or screenshotting paid video/content, with no distinction for admin's own legitimate need to capture screenshots (e.g. for support/moderation).

**Proposed scope:** Block screen capture in student-facing content screens (video player, question content) while explicitly preserving screenshot capability for the admin role.

**Current state:** No screen-capture prevention exists anywhere in the app today. This needs native library research before scoping — `expo-screen-capture` provides screenshot/recording *detection and blocking* on the JS side, but role-conditional behavior (block for students, allow for admin) needs to be gated on `auth.user.role` wherever it's applied. Note: this is fundamentally best-effort on both platforms (neither iOS nor Android can fully prevent screen recording at the OS level) — worth setting that expectation before this gets scoped as "solved."
