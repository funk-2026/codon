# Teacher: product gaps and flaws (2026-11-14)

A product review of the teacher role after the UX rework, from the frontend code, the API layer and the backend routes. **Nothing here has been changed.** "Verified" means I found the code that proves it; "to check" means likely but not confirmed. "BE" means the fix needs backend work.

## What already works well (so we don't break it)

- **Authoring is forgiving:** question drafts autosave on the phone and offer to restore; duplicate detection warns while typing; "Try it as a student" previews a test; images and a formula button are in the rich editor.
- **Quality guidance:** per-question stats (accuracy, average time, difficulty the results suggest vs. tagged), a completeness dashboard, quick tagging, and "chapters that need questions".
- **A clear review loop:** statuses, the reviewer's reason on the item, a "Needs you" list on Home, student reports and the status of my edits to live questions.
- **Safe changes to live questions:** edits go through a correction that an admin approves, instead of silently changing what students see.
- **Resumable video upload** and CSV bulk import with a check-before-import report.

## P0: a teacher can't fix a mistake, or can't tell if their work matters

| # | Gap | Evidence |
|---|---|---|
| 1 | **A test's details can't be edited after it's created.** Title, duration, marks, price flag and location are set once. A wrong duration or "requires subscription" means deleting the test and starting again. | Verified: the backend accepts `PATCH /teacher/tests/:id` and the app's API wrapper exists, but no screen uses it. |
| 2 | **A lesson can't be deleted, and its title, chapter or free/paid flag can't be changed.** | Verified: there is no delete route for lessons (tests, decks and hacks have one). `PATCH /teacher/content/:id` can change title, chapter and subscription flag, but the app only uses it for the lecture PDFs. A rejected lesson therefore can't really be fixed (already noted last time). BE for delete. |
| 3 | **No feedback on how their content performs.** The only numbers are per-question accuracy and a star rating. There is nothing for: a test (attempts, average score, completion, where students drop off), a lecture (views, watch time, completion), a deck or a Brain Hack (uses, ratings over time). Teachers can't tell what to make more of, and have little reason to keep contributing. | Verified: the teacher routes have question stats only. BE. |
| 4 | **Document lessons are still a stub.** The text is collected but a placeholder file key is saved, so the body is never stored. | Verified in `create-content.tsx` (found earlier). BE and FE. |

## P1: workflow and trust

| # | Gap | Evidence |
|---|---|---|
| 5 | **Teachers have no notification inbox, and a tapped push goes nowhere.** Approvals, rejections and take-downs are created as notifications, but the teacher app has no screen to read them, and the push tap handler only opens student screens. If push is off, the only trace is the status on the item. | Verified: no notifications screen under the teacher role; `routeFromNotification` allows student routes (and now the admin Review tab) only. |
| 6 | **No way to talk to the reviewer.** A rejection is one line of text; the teacher can't ask "what exactly is wrong?" or resubmit with a note, and the admin can't see what changed. | Verified: no comment or note on resubmit. BE. |
| 7 | **No idea how long review takes.** After submitting, there is no queue position, expected time or "reviewed by" on approval. | Verified. BE for any estimate. |
| 8 | **No duplicate or "make next version" for a test.** A series of mock tests (Mock 7 after Mock 6) means rebuilding everything. | Verified: no clone endpoint or button. BE. |
| 9 | **Publishing is "now" only.** There is no schedule ("release Sunday 9 am"), no availability window, and no expiry for a time-bound test series. | Verified: no such fields on tests or content. BE. |
| 10 | **No bulk actions on content.** Several finished drafts must be submitted one at a time. (The question bank does support bulk edits.) | Verified. |
| 11 | **No guidance for a new teacher.** There are no content guidelines (what gets rejected), no CSV how-to beyond the template, no sample test, and no help or support contact in the teacher app. New accounts (now created by invite) land on an empty Home. | Verified: no teacher help screen. |
| 12 | **Test options are minimal.** There are no sections (Physics, Chemistry, Biology), no instructions text for students, no option or question shuffling, and no passage- or case-based questions. All questions are single-answer multiple choice. | Verified in the models; `question_type` exists but only the single-answer type is used. BE. To confirm which types your exams need. |

## P2: motivation, reach and robustness

| # | Gap | Evidence |
|---|---|---|
| 13 | **No credit.** Students don't see who made a test, lecture or Brain Hack, and there is no teacher profile or bio. A product decision: credit drives quality and trust, but also exposes teachers to comparison. | Verified: no author shown to students. |
| 14 | **No recognition or earnings.** No contribution stats, badges, leaderboard or payout. A business question (are teachers paid per content or per student?). | Verified: nothing in the data model. |
| 15 | **No co-authoring or hand-over.** Content belongs to one teacher; "can manage all content" is an admin-granted flag, not a way to share a test with a colleague. | Verified. BE. |
| 16 | **No version history or undo** for tests and lessons. A live question is protected by corrections; everything else is overwritten. | Verified. BE. |
| 17 | **Video upload may not survive leaving the app.** Uploads are resumable (tus), but it runs in the foreground; a long upload on mobile data has no "wait for Wi-Fi" warning or background mode. | To check on a device. |
| 18 | **Formulas are typed as raw `$...$` text** with no live preview in the editor (students see it rendered). | Verified: the formula button wraps the selection in `$`. To check whether a preview exists elsewhere. |
| 19 | **Student questions about a teacher's content have nowhere to land.** Students can report a mistake, but can't ask "why is this the answer?" (the "doubts" decision for students also decides this for teachers). | Same open question as the student doubts feature. |
| 20 | **English only**, like the student app. | Verified. |

## Suggested order

1. **Let teachers fix and remove (P0 #1, #2):** an Edit details screen for tests (the backend is ready), editing a lesson's title, chapter and free/paid flag, and a lesson delete (small backend route).
2. **Close the document-lesson stub (#4),** so Notes made by teachers actually work for students.
3. **Show impact (#3):** a per-test and per-lecture summary (attempts, average score, completion; views, watch time, completion) on the item detail screen, and a "my impact" line on Home.
4. **Make the review loop two-way (#5, #6, #7):** a notification inbox that opens the item, a note when resubmitting, and "reviewed by and when".
5. **Authoring speed (#8, #9, #10, #12):** duplicate a test, schedule a release, bulk submit, then sections and instructions.
6. **Help (#11):** a short guide, a CSV how-to and the support contacts that now exist in Platform settings.

## Questions for discussion

1. Are teachers employees, freelancers paid per content, or volunteers? That decides credit, earnings and how much feedback they need.
2. Which question types do your exams need beyond single-answer multiple choice (multiple correct, numeric answer, assertion-reason, matching)?
3. Do test series need sections and a published schedule from day one?
4. Is it right for students to see who made a lesson or test?
5. Who reviews, how many people, and what turnaround do you want to promise teachers?
6. Should a teacher be able to share or hand over a test to another teacher?

---

# Status after the fixes (2026-11-14)

Decisions you gave: earnings are not decided yet; single-answer questions are enough for now; students see who made content; test series get sections and scheduling; the rest "build everything".

Two corrections to the review above: a **formula preview already existed** (the Preview toggle on every rich field), and a **formatting/tagging help sheet already existed** inside the question editor. #18 was wrong and #11 was only half right: what was missing was a guide outside the editor.

| # | Gap | Status |
|---|---|---|
| 1 | Edit a test after creation | Built: ⋯ → Edit details (title, description, instructions, timing, marks, paid/free, location). Draft or changes-needed only, as the server enforces. |
| 2 | Delete / edit a lesson | Built: delete (draft or changes-needed lessons), edit title, location, paid/free, and the text of in-app lessons. Approved or live lessons can't be deleted because students may have progress on them. |
| 3 | Performance feedback | Built: stats card on a live test (students, finished, average score, average time, hardest questions) and lesson (students, finished, minutes watched); "Your impact" on Home. Brain Hack and deck stats are not built (they have ratings only). |
| 4 | Document lessons stub | Built: the text is stored and students read it in the app. The fake formatting toolbar and fake "Saved" flash were removed. |
| 5 | Notification inbox | Built: bell on Home with unread dot, a teacher inbox, and push taps open it. Review outcomes open the item. |
| 6 | Talk to the reviewer | Partly built: an optional note when sending or resending for review, shown to the admin on the review screen. A full back-and-forth thread is not built. |
| 7 | Review turnaround | Built: the send sheet and Home show the median review time over the last 30 days and the queue length (shown once there are 3+ reviews). |
| 8 | Duplicate a test | Built: ⋯ → Duplicate as a new draft (questions and tags are copied). |
| 9 | Schedule | Built for tests, lessons, Brain Hacks and decks: after approval, publish now or at a date and time. Expiry/availability windows are not built. |
| 10 | Bulk submit | Built: on Content → Drafts, "Send all drafts for review"; incomplete ones are skipped and named. |
| 11 | Guidance | Built: Teacher guide (Profile) with review criteria, scheduling, corrections, CSV and video tips, and the support contacts from Platform settings. No sample test. |
| 12 | Test options | Built: instructions text and per-question sections (students see the heading). Not built: shuffling (needs per-attempt remapping of answers, risky without tests), passage/case questions. |
| 13 | Credit | Built: "By <name>" on test, lesson and video screens when the teacher has a name. No teacher profile page or bio. |
| 14 | Earnings / recognition | Not built: undecided. |
| 15 | Hand-over | Built: ⋯ → Hand over to another teacher by phone number (tests and lessons), with a notification. Not co-authoring. |
| 16 | Version history | Not built. |
| 17 | Video upload in the background | Not built: needs a device test first. The guide tells teachers to stay in the app on Wi-Fi. |
| 19 | Student questions on content | Not built: waits on the student "doubts" decision. |
| 20 | Other languages | Not built. |

Also removed: the Profile row "My Content" (it duplicated the Content tab); it is now "Teacher guide".

## Needs checking before release

- **Backend is uncompiled and untested** (no Go toolchain here): run `go build ./...`, `go vet ./...`, `go test ./internal/router/...` (new tests are in `teacher_features_test.go`) and apply migration `0008_teacher_features.sql`. Gofmt has not been run on the new files either.
- The worker has a new ticker, `scheduled_publish` (every minute). Without the worker running, scheduled items never go live.
- A scheduled **video** lesson waits until its video is ready.
- Editing a lesson's text is blocked once it is approved; editing its title or location is not blocked by the server on live lessons (as before).
- Schedule times are typed as DD/MM/YYYY and HH:MM in the phone's time zone (no date picker library is installed).
- The hand-over phone number must match how numbers are stored (the server normalizes it the same way as sign-in).
