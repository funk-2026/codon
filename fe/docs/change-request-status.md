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

## Not built, or decided by me (confirm)
- Custom Module v44 flow (codes, challenges, templates, 3-page builder). The older module remains, shown as a segment beside QBank, not a second square.
- Bookmark types (Revise later, Doubts, Important) for Pulse and Flashcards, and a Pulse bookmark category.
- Video download and chapter cover images.
- Pulse and Schema content must be loaded: teachers or admins add Pulse items (published at once, no review step); admins paste the Schema CSV (Admin > Schema table).
- Pulse last item returns to the list; Idx = syllabus order, Frq = most asked first; Schema analytics counts topics that are Confident now, by the day they became so. Pulse analytics counts items read; Flashcards counts cards by their last review day.
- Review ranges of 20 in test review, and the results screen redesign, were not touched.

## Needs a device
Dark theme contrast, Android PDF viewer (pdf.js from cdnjs), picture in picture and the mini player, push taps, the Pulse timer.
