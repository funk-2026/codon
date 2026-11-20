# PM change request (20 Nov 2026): build status

Branch `feature/tests-exam-simulation`. Chunks 1 to 10 are built, tested (jest, go test) and bundle on Android and iOS. Nothing has been run on a device.

| Chunk | What | Where |
|---|---|---|
| 1 Nav | Tabs Home, MCQs, Video, Tests, Brain Hack; Profile hidden tab | `src/navigation/RoleTabs.tsx`, `(tabs)/_layout.tsx` |
| 2 Home | Countdown, 4 tiles, goal, streak, detailed analysis, message | `(tabs)/home.tsx`, `src/home/` |
| 3 Profile | Edit profile, resets, settings, dark theme, reference PDFs, faculty | `edit-profile.tsx`, `settings.tsx`, `reference-doc.tsx` |
| 4 Brain Hack | Videos above articles, 4 categories | `src/brainhack/` |
| 5 Class 10 | Board-paper channel | `board-papers.tsx` |
| 6 Bookmarks | Types, filters, re-attempt that saves nothing, shared question layout | `bookmarks.tsx`, `src/question/` |
| 7 Video | Subject list, player, PDFs, mark complete | `(tabs)/learn.tsx`, `video-player.tsx` |
| 8 QBank | NEET UG QBank, solve once per module, notice, overview endpoint | `src/qbank/`, `be/handlers/qbank.go` |
| 9 Tests | Grand / Mini / Subject-wise, Live / Library / Attempted, months and year, Grand analysis | `(tabs)/tests.tsx`, `src/exam/testsTabs.ts`, `grand-analysis.tsx` |
| 10 Study | Schema, Pulse, Flashcards by chapter, analytics for each | `src/study/`, `schema*.tsx`, `pulse*.tsx`, `study-list.tsx`, `be/handlers/study.go` |

## Gaps closed in the final pass
Custom Module v44 (three tiles, three-page builder, PYQ 10/25, saved templates with "select at test time", tick list, save popup, codes, Start screen, Challenges, leaderboard, percentage-only result); Pulse and Flashcard deck bookmarks; Tests result tiles, radar comparison, review ranges and Subjects filter, Discard Test; Grand analysis percentage/percentile and strongest/weakest; Home Test series opens the Grand analysis; QBank result screen and search; chapter covers, video download, Downloaded and Free videos; unavailable days in graphs; confidence picker in every test mode.

## Decisions made (confirm)
- Custom Module "Tests" source stays off by default so exam papers stay fresh (admin can allow it). Custom Module search icon opens Challenges.
- Repeat solves of a custom module need its code; the first attempt per student is the leaderboard attempt.
- Video download uses the host's MP4 rendition and only appears when it exists.
- Subject percentile in Grand analysis; chapters show percentage only.
- No rank prediction is offered.
- Pulse items publish without review; Schema and Pulse are editable by teachers and admins.

## Needs a device
Dark theme contrast, Android PDF viewer, picture in picture and the mini player, push taps, the Pulse timer, video download (needs MP4 renditions on the host), clipboard copy.

## Tests tab consistency pass (2026-11-20)
Grand, Mini and Subject-wise now behave the same (views, next up, waiting, series, subject and chapter on cards, subject grouping for the library, no year filter on live or attempted). Details and decisions are in tests-product-spec.md section 18. Backend: the exams list now returns `subject_name` and `chapter_name`.
