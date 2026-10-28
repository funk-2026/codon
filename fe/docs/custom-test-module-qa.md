# Custom Test Module — QA script (FE-4.24)

**Why this exists:** the frontend was built without a device or emulator, so *nothing visual or native has been run by a human yet*. What is verified automatically: TypeScript (`npx tsc --noEmit`), 133 unit tests (`npx jest`), a full Metro/Hermes bundle (`npx expo export --platform android`), and 60+ backend integration tests against real Postgres. This script is what a person must walk through on a device. Tick each line; anything that fails goes in the bug log at the bottom.

## 0. Prerequisites
1. Rebuild the dev client — new native modules were added (`expo-image`, `expo-image-picker`, `expo-image-manipulator`, `expo-notifications`, `expo-screen-capture`): `npx expo prebuild --clean && npx expo run:android` (or `eas build --profile development`). **Expo Go will not exercise push notifications or screen-capture protection.**
2. Backend: run migrations (automatic on API start). Turn features on as admin: *Admin → Home → Custom Tests & Pool* → toggle **Custom tests** (confirm), and optionally **Tutor mode** and **Question-status filters**. Bookmarks/reports/ratings endpoints work without flags.
3. Seed at least: 1 course, 2 subjects, 3 chapters, ~40 published questions across difficulties (use CSV import), one teacher, one admin, one free student and one paid student.
4. Devices: one small Android (≈5", 360dp), one large Android, one iPhone; light and dark theme; system font scale 100% and 200%.

## 1. Rich content & images (student)
- [ ] Open a test whose question stem has an image. Image appears with a skeleton first, then sharp; box doesn't jump.
- [ ] Tap the image → full-screen viewer; pinch, double-tap to zoom, swipe down to close; Android back closes.
- [ ] Options with image-only, text-only and mixed content all render; tapping an option **selects** it (does not open the viewer).
- [ ] Turn on airplane mode, open a question with an image you haven't seen: shows "Couldn't load image · Retry"; retry works after reconnecting.
- [ ] Subscript/superscript (H₂O, x², Ca²⁺) look right; inline `$math$` shows as monospace TeX (known limitation — see FE-1.1/1.13).
- [ ] Dark theme: transparent PNG diagram sits on a white "paper" and stays readable.
- [ ] TalkBack/VoiceOver: image announces its alt text; option announces letter + text + state.

## 2. Attempt runtime
- [ ] Start a **timed** test. Change the phone's clock ±10 min — the countdown must not change.
- [ ] Background the app 2 minutes; return — timer reflects real elapsed time.
- [ ] Let the timer hit 0: test auto-submits and the result shows the "Time's up" banner.
- [ ] Answer 3 questions, enable airplane mode, answer 3 more: banner "N answers not saved yet — retrying"; disable airplane mode → banner disappears; submit; result counts all 6.
- [ ] Kill the app mid-test with unsynced answers; reopen → answers restored and synced.
- [ ] Mark for review (flag), clear response, palette colours (answered / marked / both / current) and counts are right; "Next unanswered" jumps correctly.
- [ ] Submit sheet lists correct answered/unanswered/marked numbers. With airplane mode on it refuses and offers "Submit anyway".
- [ ] Open the same attempt on a second device: first device shows "open on another device" + *Continue here*; takeover works, second device becomes read-only.
- [ ] **Tutor mode:** choose an answer → *Check answer* → correct/incorrect + explanation; answer is locked afterwards.
- [ ] Bookmark icon toggles instantly and survives navigating away; Report sheet submits (and says "already reported" the second time).
- [ ] Screenshot attempt on Android/iOS as a student is blocked (dev client build only). As a teacher it is allowed.

## 3. Result, review, history, progress
- [ ] Result: score ring never shows a negative %; sections with no data (chapters/difficulty) are hidden, not zero-filled; "Practise my mistakes" builds a private test.
- [ ] Review: filter chips (Incorrect, Marked, Bookmarked…) each return the right set; paging beyond 50 questions works; thumbs, note, report, bookmark all work; cohort % shows.
- [ ] History: tapping an *In progress* attempt resumes it (regression: it used to open with the wrong id).
- [ ] Progress: a brand-new student sees empty states, not fake charts; streak has no invented "best streak".

## 4. Custom test builder
- [ ] Practice hub shows **Custom Test** only when the flag is on.
- [ ] Builder: live count updates ~½ s after each change; going below the requested count shows the tightest filter and tappable suggestions; tapping one applies it.
- [ ] Select a whole subject → its chapters show as included/disabled; count reflects it.
- [ ] Timed toggle suggests a duration; marking presets; custom marking validation (+ must be >0, − must be ≤0).
- [ ] Generate with a valid setup → pre-start shows "Built from: …"; questions match the filters.
- [ ] Generate with a too-narrow filter → clear message + suggestions, no crash.
- [ ] Free student: banner shows daily left and max questions; the count stepper cannot exceed the cap; 4th generation shows the quota sheet with reset time.
- [ ] Double-tap Generate on a slow connection → only **one** test is created.
- [ ] Save as template, reload it, share a code, enter the code on another account, deep link `codon://custom-test/shared/<code>`.
- [ ] My custom tests: filters, resume, *New set*, rename, delete (past scores remain in Progress).

## 5. Teacher authoring
- [ ] New test → duration and marks you entered are saved (regression: they used to be dropped). Check in the test's pre-start.
- [ ] Add question: toolbar (bold, sub, sup, formula, list), add image from gallery and camera, HEIC photo from an iPhone converts, alt-text prompt appears, live preview matches.
- [ ] Image > 5 MB is shrunk automatically; a non-image is refused with a clear message; upload can be cancelled and retried.
- [ ] Duplicate warning appears for a re-typed existing question but does not block saving.
- [ ] Kill the app mid-edit → "unsaved draft" banner offers restore.
- [ ] Submit for review with questions missing chapter/difficulty → list highlights exactly which questions and what is missing.
- [ ] Edit a **live** question's answer → goes to review ("Submit for review"), students keep the old version until an admin approves; edit only tags → saves immediately.
- [ ] CSV import: download template; upload CSV (+ ZIP with images); *Check* shows errors/warnings/missing images with nothing saved; *Import N* commits; update mode changes metadata by `question_id`.
- [ ] Question Bank: search, "No difficulty" queue, long-press to multi-select, bulk edit difficulty/tags.
- [ ] Reports inbox: mark fixed with a note → reporting student sees it in *My reports* and gets a notification.

## 6. Admin
- [ ] Reports queue and Corrections queue (diff of *Now* vs *Proposed*, images visible); approve applies; reject requires a reason.
- [ ] Custom Test admin: flip a flag (with confirm), change a limit (builder reflects within ~1 min), reset to default, pool-health list highlights chapters below the floor.

## 7. Other surfaces
- [ ] Home: no carousel when admin has no updates; add one in the API and it appears; CTA only opens allowed in-app routes. Day streak is the real number.
- [ ] Brain Hacks list/detail come from the server, categories filter, rating works; teacher can author + submit one.
- [ ] Flashcards: deck list (locked decks lead to plans), study session flip → rate; failure keeps the card.
- [ ] Notifications: Settings → Push notifications → OS permission prompt appears **only now**; token registers; tapping a push opens the right screen; toggling off stops pushes; logout removes the token.

## 8. Pending features built 2026-10-25 (one pass)
Use **two students** (one with attempts, one brand-new), **one teacher**, **one admin**. Restart the local API first (backend changed: flashcard deck subject/chapter clearing).

### 8A. Student test experience
- [ ] **Strike-through:** in a test, long-press option B → faded; long-press again → restored. Cross out C, leave the test, resume → C still crossed out. Tap C → selected and restored. Long-press your selected answer → nothing. TalkBack/VoiceOver: an option offers "Cross out option X".
- [ ] **Confidence:** after choosing an answer, *How sure are you?* chips appear; tap Sure, tap again → cleared. Tutor mode: chips gone once the answer is checked.
- [ ] **Result → Confidence vs. correctness:** mark ~5 answers (mix of right/wrong) → counts match; "sure but wrong" callout appears when relevant. Hidden if nothing was marked.
- [ ] **Result → Time analysis:** linger on one question → it is listed under *Slowest questions*; tap it → Review opens **on that question**. Hidden with < 3 timed answers.
- [ ] **Home → daily goal ring:** note the number, submit a test → ring grows by the questions answered. Tap → choose 10 → ring rescales (green when reached). Kill/reopen → goal kept.
- [ ] **Practice → chapter → Newest / Top rated:** order changes; ★ avg (count) shows once a test has ≥ 5 ratings.

### 8B. Teacher tools
- [ ] **Flashcard decks:** Upload → *Flashcard Decks* → + → create a deck (title, course, optional subject/chapter, free toggle) → add 3 cards (one with an image), edit one, move one up/down, delete one → *Submit for review*. Editing is locked while in review.
- [ ] **Deck subject/chapter:** set a chapter, then clear it → saved without the chapter; clear the subject → both cleared (was impossible before).
- [ ] **Brain Hacks in My Content:** My Content → Brain Hacks filter now lists your hacks. Open a draft → *Edit* reopens it in the editor; *Submit for review* works for a **brand-new** hack (was broken: "undefined" id).
- [ ] After admin approval (8C): Brain Hack detail and deck screen show **Publish** → publish → students can see it.
- [ ] **Question editor → ?**: help sheet shows formatting examples rendered as students see them (formula example typeset — see 8E).
- [ ] **Live question stats:** open a live question in the editor → *How students do* (or "stats appear after N answers").
- [ ] **Teacher Home → Chapters that need questions:** lists thin chapters with "+N"; hidden when every chapter is healthy.
- [ ] **My Content ratings:** rate a test/Brain Hack as a student → teacher's card shows ★ avg (count).

### 8C. Admin tools
- [ ] **Review → Hacks & Flashcards:** both tabs list pending items; expand to read the hack / every card; *Approve* → gone from queue; *Reject* requires a reason → teacher sees it on the item.
- [ ] **Home → Tags & Topics:** search tags; rename; *Merge into…* another tag (its questions move); delete an unused tag (in-use → explained, button disabled). Topics: pick course/subject/chapter → add, rename, delete (in-use → explained).
- [ ] **Custom Tests & Pool → presets:** *+ New preset* (e.g. 15 hard PYQs, timed 20 min) → preview line updates → create → appears in the student builder's *Start from* row. *Edit* an existing preset; course can't change.
- [ ] **Home → Wellness articles:** write an article with bold text and an image on the *Guidance* shelf → publish. Edit it. *Hide* another (warning that it can't be restored from the app). Delete one.

### 8D. Student content
- [ ] **Support tab:** with admin articles present, shelves and *Today* show them; an article opens with formatting and images. With **no** articles on the server, the built-in starter articles still show.
- [ ] **Explore:** Home → EXPLORE → *Discover more* → sections: Continue (in-progress test), Recommended, Quick start, Practise a chapter, Flashcards, Brain Hacks. Each opens the right screen; empty sections are hidden; with custom tests OFF the builder sections disappear.
- [ ] **Video notes:** play a video → *+ Note at mm:ss* (video pauses) → save. Seek elsewhere → tap the note's time → video jumps back. Edit, delete. Typing an image link is refused with a clear message.
- [ ] **Share result:** Result → *Share result* → card preview (first name, score, accuracy, streak) → Share → the image appears in the share sheet (WhatsApp etc.). Dark mode: the card still looks the same.
- [ ] **Practice reminder:** Settings → *Daily practice reminder* on → OS permission prompt → pick the next hour slot → notification arrives at that time → tap → opens Practice. Turn off → no more reminders. (Works in Expo Go; Android shows it under "Practice reminders".)

### 8E. Math (decision D14 — see `docs/decisions/math-rendering.md`)
- [ ] Teacher writes `$\frac{1}{2}mv^2$`, `$\sqrt{\frac{GM}{r}}$` and `$\ce{2H2 + O2 -> 2H2O}$` in a question/option/explanation → student view shows **typeset** formulas inline, baseline-aligned, in the text colour (check dark mode).
- [ ] A block formula on its own line (`$$ … $$`) renders centred and scrolls horizontally if wide.
- [ ] A broken formula (`$\frac{1}{$`) shows the TeX source chip — the question still works.
- [ ] Performance: a test with many formula questions → first question appears quickly, Next/Prev doesn't stutter; airplane mode → formulas still render.
- [ ] TalkBack/VoiceOver reads "Formula: …".

### 8F. Image prefetch
- [ ] Start a test with images on later questions, wait ~10 s on Q1, enable airplane mode → page through → later images render.

## 9. Gap completion (2026-10-25, second pass)

### 9A. Student
- [ ] **Bookmark list chooser:** tap the bookmark on a question → toast "Bookmarked · long-press to choose a list". Long-press it → sheet lists *Revise later / Doubts / Important* with counts → pick *Doubts* (✓ moves there). Tap the bookmark on another question → it goes to *Doubts* (last used). *Remove bookmark* in the sheet works. Bookmarks screen shows each in the right list.
- [ ] **Repeat last:** after building one custom test, the builder's *Start from* row begins with **Repeat last** → tap → your previous setup is prefilled.
- [ ] **Quick start:** long-press *Daily 20* (or Repeat last) → the test is built and opens immediately (≤ 4 taps from Home: Home → Custom Test tile → long-press → Start).
- [ ] **Custom difficulty mix:** Builder → Difficulty mix → *Custom* → set Easy/Medium/Hard; at 110 % you see "Adds up to 110 % — make it 100 % to apply"; at 100 % the count line updates.
- [ ] **Custom subject balance:** Advanced → Balance across subjects → *Custom* → per-subject 0–10 with "≈ N % of the questions"; the last subject can't go to 0.
- [ ] **Home tiles:** EXPLORE shows **Custom Test** (only when the module is on) and **Flashcards**, each with its own icon; both open the right screen.
- [ ] **Mastery heat-map:** Progress → BY SUBJECT shows coloured chapter tiles + legend; tap a tile → details + *Practise this chapter* → builder prefilled with that chapter.

### 9B. Teacher
- [ ] **Completeness:** Question Bank → *Fix chapter by chapter* → per-chapter missing counts → tap "N no difficulty" → **Quick-tag**: tap Easy/Medium/Hard → next question; swipe left = skip, swipe right = back; progress "3 of 12 · 2 saved". Back on Completeness the count dropped.
- [ ] **Quick-tag tags:** "N no tags" → pick popular chips and/or type a new tag → *Save*.
- [ ] **Quick-tag other kinds:** topic / NCERT / alt text → *Open in editor* opens that question.
- [ ] **Try it as a student:** teacher preview of a test with questions → *Try it as a student* → timer (if timed), pick, *Check answer* (correct/incorrect + explanation, or "No explanation" warning) → *Finish* → score with the test's marking. Nothing appears in any student's history.
- [ ] **Platform-wide banner:** Admin → Users → a teacher → *Can manage all content* on → that teacher sees "Platform-wide access…" on My Content and Question Bank (off → no banner).

### 9C. Admin
- [ ] **Test approvals filters:** chips are All + the teacher-creatable modules (from the registry).

### 9D. Engineering
- [ ] **CI:** push → GitHub Actions *CI* runs *App — typecheck & tests* and *API — vet & tests (Postgres)*; both green.

### 9E. Device-only checks (cannot be done in code — FE-0.1, 1.14, 1.15, 4.23, 4.24)
- [ ] **Native rebuild (SDK 58):** `npx expo prebuild --clean` → dev build on Android + iOS launches; re-apply the iOS fix from `dev` if needed; camera/photos/notification permission prompts show their purpose strings.
- [ ] **Screen reader pass** (TalkBack + VoiceOver): test runtime (options, strike-through action, confidence chips, palette), builder tree, result widgets, heat-map tiles, bookmark chooser, formulas read as "Formula: …".
- [ ] **200 % font scale:** test runtime, builder, result, Home — nothing clipped or overlapping.
- [ ] **Dark mode sweep:** every screen in §8–9.
- [ ] **Performance (FE-1.15 + D14):** 90-question test with ~30 image/formula questions on a low-end Android — first question < 1 s, Next/Prev smooth, memory flat; airplane mode after prefetch still renders.
- [ ] **Device matrix (FE-4.24):** small Android (~360 dp), large Android, an iPhone; light + dark.

## 10. Timers & lecture PDFs (2026-10-26)
Restart the local API first (backend changed: lecture PDF fields + `lecture_pdf` uploads).
- [ ] **Q Bank stopwatch:** open an untimed Q Bank test → top right shows a ⏱ stopwatch counting up. Leave and resume later → it shows the real time since you started (not 0:00). Timed tests still show the countdown.
- [ ] **Review 2-min limit:** open Review → top right counts down from 2:00 per question; at 0:00 "2 minutes up — next question" and it moves on; amber in the last 30 s. On the last question it only says time's up. Tap the timer → "2-min off" (stays off after reopening); tap again → on.
- [ ] **Teacher — attach PDFs:** New Video → *Lecture PDFs* → Attach a notes PDF and an annotated PDF (progress shown) → submit. On an existing video's preview: Replace / Remove work and say "students see it right away".
- [ ] **Student — notes:** open the lecture → *Lecture PDFs* → Notes → Download → share sheet (save to Files / open in a PDF app).
- [ ] **Student — annotated locked:** Annotated notes shows 🔒 "Unlocks after you watch the lecture".
- [ ] **Unlock:** watch (or seek) past 90 % → within a moment Annotated notes becomes downloadable. Reopen the lecture later → still unlocked.
- [ ] **Watch progress saves while playing** (was broken): play a video ~30 s, leave → Home's *Continue* shows it.

## Bug log (fill in while testing)
| # | Screen | Device / theme | What happened | Severity | Fixed? |
|---|--------|----------------|---------------|----------|--------|
| | | | | | |
