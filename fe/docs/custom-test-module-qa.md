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

## Bug log (fill in while testing)
| # | Screen | Device / theme | What happened | Severity | Fixed? |
|---|--------|----------------|---------------|----------|--------|
| | | | | | |
