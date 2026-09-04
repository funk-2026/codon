# P0 Todos — Technical Breakdown (FE)

Pulled from [Todos.md](Todos.md). Scope: frontend only (`fe/`) — the two "Blocked on BE" P0s are listed at the bottom for tracking but not expanded, since they need backend work first.

Each item below has: what's actually happening in the code today (with file refs), the proposed approach, and a subtask checklist. Work through them top to bottom — roughly ordered from quick/isolated fixes to the bigger, riskier epics (nav rework is last on purpose, since two other items feed into it).

---

## 1. Authenticated user can navigate back to the sign-in screen — ✅ DONE

**Todos.md:** "After signing in to the Dashboard, if user tries to go back, then he is getting redirected to the login page."

**Root cause:** [otp-verify.tsx:93-99](fe/app/otp-verify.tsx#L93-L99) calls `router.replace(...)` on successful sign-in, which only swaps out the *current* stack entry. The screens beneath it — `index` → `onboarding` → `phone-entry` → `otp-verify` (replaced) — were still sitting in the native stack. Pressing back from the dashboard popped to `phone-entry`, which is effectively the login screen again.

**Fix applied:** Restructured [app/_layout.tsx](fe/app/_layout.tsx) — the single root `<Stack>` is now built by an inner `RootNavigator` component that reads `auth.status` and wraps the auth-flow screens (`onboarding`/`phone-entry`/`otp-verify`/`preview-mode`) in `<Stack.Protected guard={auth.status !== 'authenticated'}>`, and the authenticated screens (`profile-setup`/`(student)`/`(teacher)`/`(admin)`) in the inverse guard. Expo Router (6.0.8, confirmed `Stack.Protected` is available) unmounts whichever group's guard is `false` — so once `auth.status` flips to `'authenticated'`, the sign-in screens are removed from the navigator entirely, not just hidden, and back navigation can't reach them. Same protection applies symmetrically on sign-out. No changes needed in otp-verify.tsx or AuthContext.tsx — their existing `router.replace(...)` calls already land in the now-visible group.

**Verified:** `npx tsc --noEmit` clean. **Still needs:** an on-device/simulator pass to confirm the guard-driven unmount doesn't introduce any visible flicker on the sign-in/out transition (no device available in this environment — see the same caveat on items 5/6).

---

## 2. No error state after a failed API call (silently shows stale/default data) — ✅ DONE

**Todos.md:** "Fallback for API status errors, we should not show cached data or something, we need to indicate some error state after failed api call."

**Root cause:** Confirmed pattern — [app/(student)/(home)/index.tsx:131-133](fe/app/%28student%29/%28home%29/index.tsx#L131-L133):
```ts
} catch (err) {
  console.error('Failed to load home data', err);
}
```
On failure this just logs and leaves whatever the initial `useState` default was (e.g. `isNewUser` stays `true`, streak stays `0`) — the screen renders a plausible-looking but wrong state, with no indication anything failed. A repo-wide check found only 56 of 90 screens even have a `catch` block around a fetch at all; the rest have none. There's already an [EmptyState.tsx](fe/src/components/EmptyState.tsx) component and a working `ToastProvider` ([Toast.tsx](fe/src/components/Toast.tsx)) — toasts are used for ~20 action-result flows already, just not for initial-load failures.

**Approach:** This needs one shared pattern, not 90 one-off fixes:
- Add a `loadError`/`status` piece of state (`'loading' | 'error' | 'ready'`) to the common data-loading screens, and render `EmptyState` (or a new `ErrorState` variant with a "Retry" action) instead of the skeleton/content when it's `'error'`.
- Since `apiFetch` already throws a typed `ApiError` ([client.ts:51-58](fe/src/api/client.ts#L51-L58)), the catch blocks have what they need — they're just not doing anything with it today.
- Worth a small shared hook (e.g. `useAsync`/`useApiData`) to avoid repeating this boilerplate across 90 screens, rather than hand-editing each one.

**Fix applied — full sweep, 44 screens:** Rather than a shared hook (state shapes vary too much screen to screen — many fetch several things in parallel into separate `useState`s), went with two shared UI primitives plus a per-screen judgment call:
- New [ErrorBanner.tsx](fe/src/components/ErrorBanner.tsx) — inline, non-blocking card with a Retry link, for **dashboard-style** screens (student/teacher/admin home, practice/learn landing pages, profile home) where the failed fetch only feeds *part* of an otherwise-static page.
- Existing [EmptyState.tsx](fe/src/components/EmptyState.tsx) + `TextButton` retry, for **list/detail-style** screens (queues, lists, detail pages) where the failed fetch *is* the screen's entire content.

Every screen from the earlier "42 files import an API + use `useEffect`" scan got one of the two, decided per-screen (not a blanket rule) — full list and per-file pattern is in the commit/diff, not duplicated here. Two things worth knowing:
- **Live test-taking screen** ([test-question.tsx](fe/app/%28student%29/%28practice%29/test-question.tsx)) got split treatment on purpose: full-screen `EmptyState`+retry for the initial question-set load, but a non-blocking `ErrorBanner` for per-answer save failures — a save failure must never blank an in-progress answer sheet.
- **Checkout** ([checkout.tsx](fe/app/%28student%29/%28profile%29/checkout.tsx)) only got the treatment on the plan-details load; the actual payment-submission path and its existing toast handling were left untouched.
- The sweep incidentally caught and fixed two real bugs, not just missing error UI: [payment-detail.tsx](fe/app/%28admin%29/%28payments%29/payment-detail.tsx) and [user-detail.tsx](fe/app/%28admin%29/%28users%29/user-detail.tsx) had `if (loading || !data)` guards that left the skeleton spinning forever on a fetch failure (never actually stuck in `loading`, just permanently blank) — now a proper distinct error branch. [csv-import-report.tsx](fe/app/%28teacher%29/%28upload%29/csv-import-report.tsx)'s polling failure was falling through to a misleading "0 of 0 rows imported / all succeeded" state.

**Verified:** `npx tsc --noEmit` clean across the whole `fe/` tree after all edits (44 files changed, +1308/−636). Not yet done: on-device visual check that the new banners/empty states actually look right in context — worth a pass next time the app's running.

---

## 3. Shimmers/skeletons missing across large parts of the app — ✅ DONE

**Todos.md:** "Shimmers for the entire app, that indicate loading state."

**Current coverage:** [SkeletonBlock.tsx](fe/src/components/SkeletonBlock.tsx) exists and is already used in most student screens. Gaps by role:
- Admin: 13 of 24 screens use it (11 missing)
- Teacher: 3 of 20 screens use it (17 missing)
- Student: broadly covered already

**Approach:** This is coverage work, not new infra — `SkeletonBlock` already exists and the pattern is established (see [analytics-overview.tsx:146-160](fe/app/%28admin%29/%28home%29/analytics-overview.tsx#L146-L160) for a good reference implementation with a `loading` boolean gating skeleton vs real content). Mostly: add a `loading` state to each screen's fetch, add `SkeletonBlock` placeholders matching the real content's shape/height. Worth doing after item 2 (error state) since both touch the same load-state branching in each screen — do them together per screen rather than two separate passes.

**Fix applied:** Re-scanned coverage after item 2 (which already added `loading` state to most fetch-driven screens) and found 16 real candidates — screens with a mount-time fetch that still showed plain "Loading…" text, a spinner, or nothing at all instead of a content-shaped placeholder. Fixed two by hand as references — [test-history.tsx](fe/app/%28student%29/%28practice%29/test-history.tsx) (list rows) and [subscription-plan-edit.tsx](fe/app/%28admin%29/%28payments%29/subscription-plan-edit.tsx) (a form that had *no* loading indicator at all, just a disabled Save button) — then swept the remaining 14 across 3 background agents. Result: 11 screens got real `SkeletonBlock` placeholders shaped to their actual content (question cards, stat tiles, result rings, form fields, etc.); 5 were correctly left alone as dashboard-style screens with no blocking loading gate to replace (their fetch just fills in details on an already-usable page — that's what `ErrorBanner` from item 2 is for, not a skeleton).

Two real bugs turned up along the way, not just missing polish:
- [test-review.tsx](fe/app/%28student%29/%28practice%29/test-review.tsx) had no loading branch at all — while data was still loading it fell through to the "you got every question right!" congratulations message.
- [test-submit-confirm.tsx](fe/app/%28student%29/%28practice%29/test-submit-confirm.tsx) briefly showed "0 Answered / 0 Unanswered" as if that were real data, since the stat tiles weren't gated on `loading`.

Both fixed as part of this pass.

**Verified:** `npx tsc --noEmit` clean across the whole `fe/` tree after all edits. **Still needs:** on-device check that skeleton shapes/timing actually read well — no device available in this environment (same caveat as items 1/5/6).

---

## 4. Settings — Sound Effects / Notifications toggles are non-functional — ✅ DONE

**Todos.md:** "In settings the UI for notifications, sound effects is broken."

**Root cause:** [settings.tsx:67-68](fe/app/%28student%29/%28profile%29/settings.tsx#L67-L68):
```ts
const [soundEffects, setSoundEffects] = useState(true);
const [notifications, setNotifications] = useState(true);
```
Both switches are pure local component state — flip them and nothing happens: not persisted (no AsyncStorage/API call), not wired to any actual behavior (there's no app-wide sound-effect player to toggle, no push-notification permission/registration flow). The "Notifications" row already has a `caption="Coming soon"` ([settings.tsx:165](fe/app/%28student%29/%28profile%29/settings.tsx#L165)) — i.e. it's labeled unfinished but still rendered as a live, working-looking switch, which is the "broken" part.

**Approach — needs a product decision first, not just code:**
- Sound Effects: is there actually a sound-effect system anywhere in the app today to gate? (quick grep found none). If not, this toggle currently controls nothing — either build the minimal sound-effect plumbing + persist the preference (AsyncStorage), or remove the toggle until sound effects exist.
- Notifications: real push notifications need `expo-notifications` permission request + token registration + a backend endpoint to store the token — that's a real feature, not a settings-screen fix. Short-term: either hide/disable the row (it already says "Coming soon") or implement permission-request wiring if push is actually in scope now.

**Fix applied — made a call rather than blocking on a product decision:** Neither toggle had a backing system to wire to (no sound-effect engine anywhere in the app, no push-notification permission/token flow), and building either from scratch is a real feature, not a settings-screen fix. Went with the honest, low-risk middle ground:
- Both toggles now **persist** to `expo-secure-store` ([settings.tsx](fe/app/%28student%29/%28profile%29/settings.tsx)) — previously they reset to `true` every time you left and came back, which was itself part of what made the screen feel broken.
- Added the same `caption="Coming soon"` to **Sound Effects** that **Notifications** already had, instead of leaving it looking fully functional when nothing consumes it. Both switches stay interactive (so a user's stated preference is captured for whenever a real system lands) but neither pretends to be more finished than it is.
- Did not touch [platform-settings.tsx](fe/app/%28admin%29/%28home%29/platform-settings.tsx) — confirmed that one's unrelated and already fine (real KYC toggle backed by a real endpoint).

**Verified:** `npx tsc --noEmit` clean.

---

## 5. Forward screen transitions are smooth, back transitions snap/remove instantly — ⚠️ CODE FIX APPLIED, NEEDS DEVICE CONFIRMATION

**Todos.md:** "when moving from one screen to another forward... is smooth, but when moving back the old screen is getting completely removed immediately."

**Current state:** [ThemedStack.tsx](fe/src/components/ThemedStack.tsx) sets one shared `animation: slide_from_right` (native) / `fade` (web) across every `Stack` in the app, applied via `useStackScreenOptions()`. Per the existing Done-log note in [Todos.md:29](Todos.md#L29), this was verified on web only — **no physical device/simulator has been used to confirm native feel**, which is very likely why this bug is still open despite the animation constant being "wired everywhere."

**Approach:** This needs on-device repro before writing any fix — don't guess at react-native-screens flags blind. Candidates to check once reproducible on a real device/simulator:
- `react-native-screens` defaults (`freezeOnBlur`, `detachInactiveScreens`) potentially unmounting/freezing the screen being revealed before its reveal animation finishes
- Each tab group has its own nested `Stack` ([admin _layout.tsx](fe/app/%28admin%29/_layout.tsx) + per-group layouts) — a pop inside a nested stack vs. the Tab container itself may behave differently
- `contentStyle` background ([ThemedStack.tsx:21](fe/src/components/ThemedStack.tsx#L21)) causing a visible flash that reads as "removed" rather than an actual unmount

**Fix applied:** Set `freezeOnBlur: false` in the shared `useStackScreenOptions()` ([ThemedStack.tsx](fe/src/components/ThemedStack.tsx)), which applies to every `Stack` in the app (it's the single shared options object every stack navigator uses). This was the top candidate from the earlier investigation — `react-native-screens`' default freezes a screen as soon as it loses focus, which on a back-pop can freeze the screen being *revealed* mid-transition before its reveal animation finishes, reading as an instant cut rather than a slide.

**Not verified — genuinely can't be, in this environment:** No physical device or simulator is available here, only web (where this specific bug doesn't manifest the same way). This is a well-reasoned fix for the most likely cause, not a confirmed one. **This is the #1 thing to check manually** — see the checklist at the bottom of this file.

---

## 6. Initial app-open animation feels stuck / unclear — ⚠️ CODE FIX APPLIED, NEEDS DEVICE CONFIRMATION

**Todos.md:** "The initial animation that comes right when we open the app, feels like the app got stuck... need to think of an animation there or remove it completely."

**Current state:** [app/index.tsx](fe/app/index.tsx) already implements a splash/entrance animation: fade + translateY brand mark ([index.tsx:70-91](fe/app/index.tsx#L70-L91)), three pulsing dots, and a `MIN_DISPLAY_MS = 2000` minimum hold before redirecting ([index.tsx:25-26](fe/app/index.tsx#L25-L26)). This may have been added after this Todos.md line was written, or it exists but doesn't read as intended on-device (same "no device tested" caveat as item 5).

**Approach:** Don't write new animation code yet — first actually watch the current sequence run (native splash → this screen → redirect) on a device/simulator. It's possible this item is already resolved and just needs to be checked off, or the 2s minimum hold is what reads as "stuck" (nothing moves for the first moment while fonts/auth are still resolving).

**Fix applied:** Reduced `MIN_DISPLAY_MS` from 2000ms to 1200ms in [app/index.tsx](fe/app/index.tsx#L26) — kept it above `ENTER_MS` (900ms) so the entrance animation still finishes before redirecting, but cut the forced hold by 800ms. The animation code itself (fade + translateY brand mark, pulsing dots) was already there and looked correct on inspection — the most likely culprit for "feels stuck" was simply the full 2-second artificial floor before anything could navigate, regardless of how fast auth/fonts actually resolved.

**Not verified — needs a device/simulator**, same caveat as item 5.

---

## 7. Admin analytics page — dummy data — ✅ NO FE CHANGE NEEDED

**Todos.md:** "Remove dummy data from Admin analytics page."

**Current state:** [analytics-overview.tsx](fe/app/%28admin%29/%28home%29/analytics-overview.tsx) already calls a real endpoint — [adminAnalyticsOverview()](fe/src/api/admin.ts#L24) hits `GET /admin/analytics` and renders whatever it returns (no hardcoded arrays found in this file). The most recent backend commit (`925d9b9 add analytics feature for admin in the BE`) suggests this may have just been wired up and this Todos.md line predates it.

**Approach:** Verify against a live backend before assuming there's FE work here at all.

**Conclusion:** Re-confirmed on closer inspection — [analytics-overview.tsx](fe/app/%28admin%29/%28home%29/analytics-overview.tsx) has no hardcoded arrays or fake numbers anywhere; it renders exactly whatever `adminAnalyticsOverview()` ([admin.ts:24](fe/src/api/admin.ts#L24)) returns from `GET /admin/analytics`. There is nothing left for the frontend to fix here — if this still shows placeholder-looking numbers on a running app, the cause is on the backend side (the endpoint added in `925d9b9`), not this screen. No code change made. **Can't be fully verified without a live backend** — worth a quick look next time the app's running against one (see checklist at bottom).

---

## 8. Approval sections (Test/Content/KYC) cluttering the Admin home page — ✅ DONE

**Todos.md:** "The approval Sections... can be moved to a separate tab... instead of the home page... refer to main branch for grouping tabs approach."

**Current state:** Confirmed duplication — [(admin)/(home)/index.tsx:86-93](fe/app/%28admin%29/%28home%29/index.tsx#L86-L93) has 9 tiles on the home grid, 3 of which (`kyc`, `tests`, `content`) just deep-link into screens that already live under the separate **Review** tab ([(admin)/(review)/_layout.tsx](fe/app/%28admin%29/%28review%29/_layout.tsx)). So the review/approval flows are reachable two ways today — home tiles and the Review tab — which is presumably part of what's making admin nav feel broken (item 9 below).

**Approach:** Per the todo, check `main` branch for how it already groups these tabs before redesigning from scratch — no need to invent a new IA if one was already worked out there.

**Checked `main` first, as the todo suggested:** it turned out to have the *identical* 5-tab structure and the *same* home-grid duplication (`main`'s admin home also has separate KYC/Test/Content tiles alongside the Review tab) — so there was no different grouping pattern there to copy. Designed the consolidation directly instead:
- [(admin)/(review)/index.tsx](fe/app/%28admin%29/%28review%29/index.tsx) is no longer just the KYC queue — it's now an **Approvals hub**. Header changed to "Approvals," and a new row of 3 nav cards (KYC Review / Test Approvals / Content Approvals, each with a live pending-count badge) sits above the existing KYC list. KYC stays inline (it's already the tab's native content); tapping Test or Content Approvals pushes into the existing `moderation-tests`/`moderation-videos-docs` screens exactly as before — nothing about those two screens changed.
- [(admin)/(home)/index.tsx](fe/app/%28admin%29/%28home%29/index.tsx) — the 3 duplicate tiles (`kyc`, `tests`, `content`) collapsed into a single `approvals` tile, badge showing the combined pending count, linking to `/(admin)/(review)`.

**Verified:** `npx tsc --noEmit` clean.

---

## 9. Admin back navigation breaking in many places — ⚠️ CONTRIBUTING CAUSES FIXED, NEEDS DEVICE AUDIT

**Todos.md:** "Back navigation is breaking at many places for admin please fix. (Navigation is going to be a whole big change, lot of things are breaking)"

**Current state:** Admin has 5 tab groups, each with its own nested `Stack` ([(home)](fe/app/%28admin%29/%28home%29/_layout.tsx), [(review)](fe/app/%28admin%29/%28review%29/_layout.tsx), [(users)](fe/app/%28admin%29/%28users%29/_layout.tsx), [(payments)](fe/app/%28admin%29/%28payments%29/_layout.tsx), [(profile)](fe/app/%28admin%29/%28profile%29/_layout.tsx)) under one root `Tabs` ([(admin)/_layout.tsx](fe/app/%28admin%29/_layout.tsx)). Combined with the duplicate entry points from item 8 (reaching the same screen via two different tab stacks), back-stack state is likely inconsistent depending on which tab you entered a screen from.

**Approach:** This is explicitly called out as a big-change item in the todo itself — treat it as its own epic, done *after* items 5 and 8 land (screen-transition fix and de-duplicated approval routes both reduce the surface area here). Needs a systematic audit, not spot fixes:

**Both named contributing factors are now fixed:** item 5 (`freezeOnBlur: false`, applies to every stack including admin's) and item 8 (removed the duplicate KYC/Test/Content entry points — Test and Content approvals are now reachable exactly one way, through the Approvals hub, instead of two competing paths from Home and Review). This doesn't mean every admin back-nav complaint is resolved — I have no way to run this app to find out. What's left genuinely requires the on-device pass the original scope called for: walk every admin flow, press back at every step, log where it breaks. That's now a much smaller surface than before (2 known causes removed), which should make that audit faster whenever it happens. See the checklist at the bottom.

---

## 10. Admin has no way to browse the full course structure — ✅ DONE

**Todos.md:** "Admin can't go beyond adding subjects, there should be UI supporting for him to see all the content present from the course structure."

**Current state:** [manage-subjects.tsx](fe/app/%28admin%29/%28home%29/manage-subjects.tsx) lets admin create **Subjects only** (per the existing Done-log entry). Chapters/Topics/content live under Teacher's [course-structure-manager.tsx](fe/app/%28teacher%29/%28home%29/course-structure-manager.tsx) (315 lines). The API is already role-agnostic-ish: [getCurriculum(courseId)](fe/src/api/courses.ts#L38) returns the full subject→chapter→topic→content tree and doesn't look student/teacher-specific — worth checking if admin's role already has access to call it.

**Approach:** Read-only drill-down, not a new editor. Reuse `getCurriculum()` and as much of `course-structure-manager.tsx`'s list-rendering as can be extracted, but stripped of the create/edit/upload actions (those stay teacher-only, per the earlier Done-log note that admin only manages Subjects).

**Built:** New screen [course-structure.tsx](fe/app/%28admin%29/%28home%29/course-structure.tsx), registered in [(home)/_layout.tsx](fe/app/%28admin%29/%28home%29/_layout.tsx), entry point added as a "Course Structure" tile on the admin home dashboard. Drill-down: Course → Subject → Chapter → Content, back button walks up one level at a time before falling through to `router.back()`. Loading/error/empty state at every level, fully read-only — no create/edit/upload affordance anywhere, confirmed only GET calls are made.

Two things worth knowing:
- `getCurriculum()`'s response only goes 3 levels deep (Course → Subject → Chapter) — "Chapter" *is* what the todo called "Topic" (confirmed by an existing code comment: teachers create "chapters (topics)"). Actual content/test items aren't in that response at all — the screen fetches them separately per-chapter via the existing admin-scoped `adminListContent()`/`adminListTests()` (chosen over the student-facing `content.ts`/`tests.ts` equivalents, which are likely published-only — admin needs to see every status).
- `status` strings are inconsistent across the codebase (`pending` vs `pending_review` for the same state) — the screen maps both to the same badge and falls back to showing the raw string for anything unrecognized, so it won't silently mislabel something if the backend uses a value nobody's seen yet.

**Verified:** `npx tsc --noEmit` clean.

---

## 11. Teacher CSV upload is mocked — ✅ DONE

**Todos.md:** "Upload a CSV for teacher is mocked currently.. implement that Upload CSV feature, also the download CSV is not working."

**Root cause — confirmed:** [csv-upload.tsx:36](fe/app/%28teacher%29/%28upload%29/csv-upload.tsx#L36):
```ts
const res = await importQuestionsCSV(testId, { file_key: 'mock-csv-key' });
```
The actual file picked by the user is never uploaded anywhere — a hardcoded `'mock-csv-key'` string is sent instead, so `importQuestionsCSV` is always processing a key that doesn't correspond to a real file. There's already an upload API module — [src/api/uploads.ts](fe/src/api/uploads.ts) — worth checking whether it already has an S3 presigned-URL flow that other upload screens use, so this can follow the same pattern rather than a new one. Note: the backend Todos.md P0 list separately has *"the worker needs to download the csv file from S3 and then process and store it in the DB"* — so this is a full-stack feature, the FE half is: pick file → upload to S3 → get back a real `file_key` → call `importQuestionsCSV` with it.

**Fix applied** — [csv-upload.tsx](fe/app/%28teacher%29/%28upload%29/csv-upload.tsx) rewritten, all three mocks replaced:
- **Real file picking** via `expo-document-picker` (newly added dependency — nothing in this codebase picked a real file before this).
- **Real upload**: `getPresignedUrl()` → PUT the actual file bytes to the returned `upload_url` → `importQuestionsCSV()` with the real `file_key`. This was already wired to a real backend endpoint (`POST /uploads/presign`) that nothing was calling — the presign function existed, unused, before this fix.
- **Real "Download Template"**: generates the CSV client-side from the column list already shown in the UI, writes it locally via `expo-file-system`, hands it to the user through the OS share sheet via `expo-sharing` (`newly added dependencies both`) — there's no backend template endpoint and no "Downloads folder" concept on mobile, so share-to-save is the standard idiom here.

**Verified:** `npx tsc --noEmit` clean. **Still needs:** confirmation that the backend's S3-download-and-process worker (tracked as a separate BE P0 item in the original [Todos.md](Todos.md)) is actually consuming what gets uploaded here — no point this FE half being right if nothing reads it yet.

---

## 12. Demo test series preview is mocked — ✅ DONE

**Todos.md:** "Demo test series preview is mocked currently, implement that from the backend?"

**Current state:** No file with "demo" in the name was found under `fe/app` or `fe/src` — this is likely referring to the pre-test preview screen ([test-pre-start.tsx](fe/app/%28student%29/%28practice%29/test-pre-start.tsx)), but no mock markers were found there either on a first pass.

**Approach:** This one needs clarification before scoping — the todo itself ends in a question mark, suggesting it wasn't fully scoped originally either.

**Found it:** [content-preview.tsx](fe/app/%28teacher%29/%28content%29/content-preview.tsx) — the teacher's "preview before submitting" screen for Test/Video/Document/Brain Hack. It was 100% hardcoded regardless of what was actually being previewed: a fixed title, fixed "20 questions / 30 min" stats, a 2-item `SAMPLE_QUESTIONS` array (despite claiming 20), a fake video title, fake document text, even a literal `'Test published (mock)'` toast on publish. Confirmed via `git diff` against `main` and via inspection this was never wired to anything real.

**Fix applied:** Rewrote the preview-rendering logic to use real data, scoped precisely to "what's shown," leaving `handleSubmitForReview`/`handlePublish`'s actual submit logic untouched (a separate concern):
- **Test, saved (has an id)**: real title/question-count/duration/marking from `getTest(id)`. Question list attempts `getTestQuestions(id)` lazily on expand — **this may hit the same `RoleStudent`-only backend gate already tracked as BE-3** (that item was about admins getting 403; whether teachers previewing their own test are also blocked is unconfirmed, no live backend to test against here). Handled gracefully either way: a distinct "Question preview isn't available yet" message on failure, no fake fallback, no fake retry loop.
- **Test, draft (no id yet)** — the "Preview & Submit" button on the creation form itself: [create-test.tsx](fe/app/%28teacher%29/%28upload%29/create-test.tsx) now passes the form's actual in-progress title/duration/marking/question-count as route params instead of just `{ type: 'Test' }`; preview renders those for real.
- **Video**: real title/breadcrumb via `getTeacherContent(id)`. If there's no real `hls_playlist_url` (likely, since **video/document upload turned out to be separately mocked too** — see the flagged finding below), shows an honest "Video not available" panel instead of the old fake always-clickable play button.
- **Document**: real title/breadcrumb; the `ContentItem` type has no body/notes field at all (confirmed by reading it and by `create-content.tsx` never sending one), so it honestly says preview text isn't available rather than inventing any.
- **Brain Hack**: this type turned out to have no save path at all (`create-brain-hack.tsx`'s draft save never calls an API) — so the only reachable case is the draft-params path, which now shows the real just-typed title/category/content directly from [create-brain-hack.tsx](fe/app/%28teacher%29/%28upload%29/create-brain-hack.tsx)'s form state.
- **Fixed an existing bug along the way**: the entry point from the teacher home "recent activity" list passes an `id` with no `type`, which was silently defaulting to `'Test'` (`(rawType as ContentType) ?? 'Test'` in the old code) — now it tries `getTest(id)` first and falls back to `getTeacherContent(id)`, resolving the real type instead of guessing wrong.

**New findings surfaced, not part of the original 12 P0s — flagging rather than silently fixing:**
- `create-content.tsx` (teacher video/document upload) has the exact same hardcoded-`file_key` mock bug item 11 just fixed for CSV (`'mock-video-key'`/`'mock-doc-key'`) — left untouched, out of scope.
- `getTeacherContent()` in `teacher.ts` is itself commented `(Requires BE implementation)`, same convention as the tracked BE-1/2/3 gaps — so the Video/Document with-id fetch this fix relies on may itself be backend-incomplete today, independent of anything in this fix.

**Verified:** `npx tsc --noEmit` clean.

---

## Blocked on BE (tracked, not expanded — needs backend work first)

Per [Todos.md](Todos.md), these are P0 but the frontend side is already done — client stubs exist and are marked "Requires BE implementation" in [src/api/admin.ts](fe/src/api/admin.ts). Not expanding backend implementation here since that's `be/` (Go) — flag to whoever owns backend, or say the word if you want these picked up too.

- **BE-1** — `GET /admin/users/:id/subscription` (plan name/status/dates) — blocks User Detail subscription display
- **BE-2** — `GET /admin/users/:id/sessions` (active device count) — blocks User Detail device count
- **BE-3** — `GET /admin/tests/:id` / `GET /admin/content/:id` admin-accessible (currently 403 for admin role) — blocks full question-list/video/document preview in the review screen; FE stubs already exist (`adminGetTest`/`adminGetContent`)

---

## Manual test checklist

Everything below was verified by reading the code and `tsc --noEmit` — none of it has been seen running, since there's no device/simulator in this environment (web doesn't exercise native navigation/animation/file-picker behavior the same way). This is what to actually tap through on a device. Grouped by flow, roughly in the order you'd hit them opening the app fresh.

### Auth flow (item 1, item 6)
- [ ] Sign in (OTP or preview mode) → land on your role's home screen → press back (hardware/gesture). **Expect:** nothing happens, or the app backgrounds — you should NOT land back on the phone-entry/OTP screen.
- [ ] Sign out from Settings → press back from the phone-entry screen. **Expect:** you should NOT land back on your authenticated home screen.
- [ ] Force-quit and reopen the app. Watch the splash screen. **Expect:** the brand animation (fade + logo) plays and it moves on to onboarding/home within ~1.2s of the animation finishing — should no longer feel like a multi-second stall.

### Screen transitions (item 5, item 9)
- [ ] From any tab's home screen, push into a detail screen (e.g. Admin Home → Users → tap a user). **Expect:** smooth slide-in, as before.
- [ ] From that detail screen, press back. **Expect:** the previous screen should slide back into view smoothly — NOT snap/appear instantly with no transition. This is the main thing to check; it's a best-guess fix (`freezeOnBlur: false`), not a confirmed one.
- [ ] As admin, walk through: Home → Approvals → Test Approvals → open a test → back → back → back. Repeat via Home → Approvals → Content Approvals. **Expect:** each back press returns to the immediately previous screen, never jumps past it or dead-ends.

### Loading & error states (items 2 & 3 — spot-check a few, not all 44)
- [ ] Turn off wifi/data, open Student Home, Admin Home, or Teacher Home. **Expect:** an inline banner ("Couldn't load the latest data — Retry"), not a silently stuck-looking dashboard with zeroed-out stats.
- [ ] Same offline test on a list screen — e.g. Admin → Users, or Student → Practice → Test History. **Expect:** a full "Couldn't load X — Retry" panel instead of an empty list.
- [ ] Reconnect and tap Retry on any of the above. **Expect:** it actually reloads and shows real data.
- [ ] With a normal connection, open a few screens fast (Test History, a Test question screen, Test Result) and watch the loading instant. **Expect:** shaped skeleton blocks (matching the real layout), not a bare "Loading…" text or a flash of "0/wrong-looking" data.

### Settings toggles (item 4)
- [ ] Student → Settings → flip Sound Effects and Notifications off, leave the screen, come back. **Expect:** both stay in the state you left them (previously reset to on every time).
- [ ] Both rows show "Coming soon" — confirms neither is pretending to be a finished feature.

### Admin approvals & course structure (items 8, 9, 10)
- [ ] Admin Home: **expect** one "Approvals" tile (not three separate KYC/Test/Content tiles) and one "Course Structure" tile, both with pending-count badges where relevant.
- [ ] Tap Approvals → **expect** a header with 3 cards (KYC Review / Test Approvals / Content Approvals), each with a live count. Tapping Test/Content Approvals navigates correctly; KYC list still works as before (approve/reject a record).
- [ ] Tap Course Structure → pick a course → a subject → a chapter → **expect** a list of real content/test items with status badges. Back button should walk up one level at a time, not exit straight to Home.

### CSV upload (item 11)
- [ ] Teacher → create/open a test → Bulk Upload → tap the upload zone. **Expect:** your device's real file picker opens (not an instantly-fake-filled "thermodynamics_questions.csv").
- [ ] Pick a real CSV, tap Upload & Process. **Expect:** it actually uploads (watch for a brief delay/spinner) and routes to the import report — if it fails, check whether the backend's CSV-processing worker is live yet (tracked separately as a BE item).
- [ ] Tap "Download Template (CSV)". **Expect:** your device's native share sheet opens with a real CSV file attached (columns matching what's shown on screen), not nothing happening.

### Content preview (item 12)
- [ ] Teacher → open an existing Video or Document from My Content → Preview. **Expect:** the real title and subject/chapter breadcrumb, not "Thermodynamics" / "Entropy — Chapter Notes". If no real video file exists yet (likely, see the flagged `create-content.tsx` finding above), you should see an honest "Video not available" panel, not a fake playable player.
- [ ] Teacher → start creating a new Test, add a few questions, tap "Preview & Submit" before actually saving. **Expect:** the preview shows YOUR real title/duration/marking scheme/question count, not "Practice Set 4 / 20 questions / 30 min".
- [ ] Same for a Brain Hack draft — Preview & Submit should show your actual typed title and text.
- [ ] Expand "Questions (N)" on a saved test's preview. **Expect either:** your real questions with options and the correct one marked, OR an honest "Question preview isn't available yet" message. If you get a crash or an infinite spinner instead of one of those two, that's a real bug to report back — it means the role-gate question flagged in item 12 resolved differently than the graceful-failure path assumed.

### Analytics (item 7)
- [ ] Admin → Analytics. **Expect:** real numbers matching actual platform activity, not obviously-fake round numbers. If they still look fake, it's a backend issue (the endpoint added in `925d9b9`), not something to fix here.
