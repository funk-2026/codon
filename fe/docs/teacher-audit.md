# Teacher role: screen audit (2026-11-14)

From the code in `fe/app/(teacher)`. **Status: the proposal below was built on 2026-11-14 (see "What changed" at the end).** Taps are counted from the Home tab.

## Screens (25 files)

**Tabs (4):** Home, My Content, Upload, Profile.

| Group | Screens |
|---|---|
| Create | `create-test`, `create-content` (video or notes), `create-brain-hack`, `flashcard-decks`, `flashcard-deck` |
| Test building | `csv-upload`, `csv-import-report`, `question-builder`, `question-editor` |
| Pick a place | `course-structure-manager` (drill-down: subject → chapter → "Use this") |
| Detail of one item | `content-preview` (tests, videos, notes), `rejected-content-detail`, `brain-hack-detail`, `preview-run` (take the test as a student) |
| Question bank tools | `question-bank`, `completeness`, `quick-tag` |
| Inboxes | `reports` (students reporting my questions), `corrections` (status of my fixes to live questions) |
| Account | `give-feedback`, `manage-devices` (one-line wrappers of shared screens) |

## Taps to reach each thing

| Goal | Path | Taps |
|---|---|---|
| New test, to the first question | Upload → New Test → form → place picker (subject, chapter, Use) → Create → add question | about 8 |
| New video or notes | Upload → New Video → form → place picker → Save | about 7 |
| Brain hack | Upload → New Brain Hack → write → Save | 2 + typing |
| A flashcard deck | Upload → Flashcard Decks → deck | 3 |
| Fix rejected item | Home tile or My Content → item → Fix | 3 |
| Question bank | Home → Question Bank | 2 |
| Reports, Corrections | Home → Reports / Corrections | 2 (no badge, so you can't tell if there's anything) |

## Duplication

1. **"New Test / Video / Brain Hack" lives in three places**: Home quick actions, My Content's "+" speed dial, and the whole Upload tab. The Upload tab is four buttons.
2. **Three detail screens for one list.** My Content opens `brain-hack-detail` for hacks, `rejected-content-detail` for rejected items, `content-preview` for everything else. Same list, three different screens depending on type and status.
3. **Home status tiles repeat My Content's status filters** (In Review, Approved, Live, Changes Needed), and they don't appear to open anything when tapped.
4. **Home "Recent activity" repeats My Content**, which is already sorted by recent.
5. **Place picker duplicates the browser we replaced on the student side** (subject → chapter drill-down on its own screens).
6. **CSV upload has two doors**: from create-test and from question-builder.
7. **Flashcards are split off.** Tests, videos and hacks are in My Content; decks are only under Upload, so you can't see a deck's status next to everything else.
8. **Three question-bank screens for one job** (find questions, find incomplete ones, tag them), all reached only from one Home button.

## What's off

- **Home is a counter board, not a to-do list.** The most important thing (Changes Needed) is one of four equal tiles. Student reports and pending corrections are buried two taps away with no badge.
- **"Upload" is the wrong name and the wrong tab.** It also creates tests and brain hacks, and it's a menu of four buttons.
- **The "+" speed dial hides the create options** behind a tap, and My Content has two filter rows (type, status) with 24 combinations.
- **Labels disagree:** "New Video" (Home), "New Video/Document" (Content, Upload).
- **Test creation is long:** about 8 taps before the first question, mostly the place picker.
- **Create-test still offers Practice**, which students now see as Q Bank.
- **"Chapters that need questions" on Home** tells you where to write, but tapping a chapter does nothing.
- **Reports and corrections** are the same kind of thing (feedback on live questions) in two separate inboxes.

## Proposal (not started)

**Tabs: Home · Content · Questions · Profile**

- **Home = what needs me.** Order: Changes needed, new student reports, pending corrections, then a tappable status summary that opens Content filtered, then one **Create** button, then a short recent list. "Chapters that need questions" gets a Write button.
- **Content = everything I've made.** Segmented Tests | Videos & Docs | Brain Hacks | Flashcards, status chips, search, and one "+" that creates for the segment you're on. Every row opens **one** detail screen, with the rejection reason as a banner at the top when relevant.
- **Questions = the question bank.** Segments: Bank | Needs tags | Reports | Corrections (Quick tag is one tap from "Needs tags"). Badges show counts.
- **Create flows:** the place picker becomes the same nested accordion as the student side, inside the form, so test creation drops to about 4 taps. Drop Practice from the type list. CSV upload stays inside Test building only.
- **Remove:** the Upload tab, Home's quick actions, the speed dial, and the two extra detail screens.

## Staging

1. Navigation: tabs, Home, one create entry, one detail screen.
2. Create flows: inline place picker, drop Practice.
3. Questions tab and inboxes with badges.

## What changed (built)

- **Tabs are now Home, Content, Questions, Profile.** The Upload tab, Home's quick actions and the speed dial are gone. Old links to retired screens redirect.
- **Home:** greeting plus one **Create** button (a sheet with test, lesson, Brain Hack, deck); a "Needs you" list (rejected items with the reviewer's note, approved items to publish, open student reports, untagged questions); a tappable status summary that opens Content filtered; recent items; "chapters that need questions" now start a test for that chapter.
- **Content:** Tests | Lessons | Hacks | Decks, status chips, search, and a + that creates the kind you're looking at. Flashcard decks are listed here too.
- **One detail screen** (`content-preview`) for tests, lessons and Brain Hacks, with the reviewer feedback at the top. `rejected-content-detail` and `brain-hack-detail` redirect to it.
- **Questions tab:** Bank | Tags | Reports | Edits (the old question bank, completeness, reports and corrections screens). Reports and untagged questions show a count badge.
- **Create flows:** the place picker is a bottom sheet over the form (the Course Structure screens are removed); Q Bank is preselected; Practice is no longer offered.

Taps for a new test to the first question: Content (1) → New test (2) → place field (3) → subject (4) → chapter (5) → Add questions (6), plus the title. About 6, down from about 8.

## Found along the way (not fixed)

- **Document lessons are a stub.** `create-content` collects the text but sends a placeholder file key (`mock-doc-key`), so the document body is never saved.
- **Rejected lessons can't be edited.** The old "Edit & Resubmit" opened a blank form. The detail screen now shows the feedback and lets you resubmit or change the lecture PDFs, but not the title, location or video.
- **Brain Hack and document previews** say "isn't available yet" in the shared preview (Brain Hacks use their own detail body, so only documents are affected).
- **Corrections** have no badge on purpose: they wait on a reviewer, not on the teacher.
