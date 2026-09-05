# Codon — Todos

## FE

### P0

#### UI

- **API failure fallback.** When a fetch fails, screens currently keep showing whatever their initial/default state was (e.g. a stat stuck at 0, a flag stuck at its default `true`/`false`) with no indication anything went wrong — it just looks like real data. Need a consistent error state (banner or full-screen, depending on whether the failed fetch is the whole screen's content or just part of it) with a Retry action, instead of silently rendering stale defaults.
  → ✅ Done — see [P0-Todos.md item 2](P0-Todos.md#2-no-error-state-after-a-failed-api-call-silently-shows-stalede-fault-data--✅-done). Swept 44 screens; two real bugs (infinite-spinner-on-failure, misleading "0 of 0 succeeded" state) turned up and got fixed along the way.

- **Loading skeletons across the app.** Most student screens already show shaped loading placeholders (`SkeletonBlock`); admin (11 of 24 screens) and teacher (17 of 20) were largely missing them, falling back to plain "Loading…" text or nothing at all.
  → ✅ Done — see [P0-Todos.md item 3](P0-Todos.md#3-shimmersskeletons-missing-across-large-parts-of-the-app--✅-done). Also caught two real bugs: a results screen that briefly showed "you got every question right!" before data loaded, and a submit-confirm screen showing fake "0 Answered/0 Unanswered" stats pre-load.

- **Settings toggles are non-functional.** The Notifications and Sound Effects switches in Student → Settings are pure local UI state — flipping them does nothing (no persistence, nothing in the app actually reacts to them), and they silently reset to "on" every time you leave and come back.
  → ✅ Done, as a deliberate scope call — see [P0-Todos.md item 4](P0-Todos.md#4-settings--sound-effects--notifications-toggles-are-non-functional--✅-done). Neither toggle has a real system to wire to yet (no sound-effect engine, no push-notification flow exists anywhere in the app) — building either is a real feature, not a settings fix. Went with the honest middle ground: both now persist your choice, and both are labeled "Coming soon" instead of looking fully functional.

- **Back-transition snaps instead of sliding.** Moving forward between screens animates smoothly; moving back, the previous screen appears to get removed/replaced instantly with no transition.
  → ⚠️ Best-guess fix applied, needs on-device confirmation — see [P0-Todos.md item 5](P0-Todos.md#5-forward-screen-transitions-are-smooth-back-transitions-snapremove-instantly--⚠️-code-fix-applied-needs-device-confirmation). Set `freezeOnBlur: false` app-wide (the top suspect: `react-native-screens` freezing the revealed screen mid-transition). No device available to confirm during that work — this is the #1 item on the manual test checklist.

- **Initial app-open animation feels stuck.** The splash/entrance sequence when the app first opens reads as a stall rather than an animation.
  → ⚠️ Fix applied, needs on-device confirmation — see [P0-Todos.md item 6](P0-Todos.md#6-initial-app-open-animation-feels-stuckunclear--⚠️-code-fix-applied-needs-device-confirmation). The animation itself was already implemented correctly; cut the artificial minimum-display hold from 2000ms to 1200ms, since that forced floor (not the animation) was the likely culprit.

- **Admin analytics page shows dummy data.**
  → ✅ Re-confirmed as already resolved on the frontend — see [P0-Todos.md item 7](P0-Todos.md#7-admin-analytics-page--dummy-data--✅-no-fe-change-needed). The screen has no hardcoded numbers; it renders whatever `GET /admin/analytics` returns. If it still looks fake, that's the backend endpoint (added in `925d9b9`), not this screen — worth a live check now that the backend's had more work done on it.

- **Approval sections cluttering the admin home page.** Test/Content/KYC approvals were reachable two different ways — separate tiles on Home, and again under the Review tab — which is also part of why admin back-navigation felt broken.
  → ✅ Done — see [P0-Todos.md item 8](P0-Todos.md#8-approval-sections-testcontentkyc-cluttering-the-admin-home-page--✅-done). Consolidated into a single "Approvals" hub (one entry point, badge showing combined pending count) instead of three duplicate tiles plus the Review tab.

- **Admin back-navigation breaks in many places.** Flagged in the original backlog as a big, systemic issue — five separate tab stacks, each with its own nested navigator, plus (at the time) duplicate entry points into the same screens.
  → ⚠️ Two known contributing causes fixed, full audit still needed — see [P0-Todos.md item 9](P0-Todos.md#9-admin-back-navigation-breaking-in-many-places--⚠️-contributing-causes-fixed-needs-device-audit). The `freezeOnBlur` fix and the duplicate-entry-point removal (previous bullet) both reduce the surface area here, but a systematic "walk every admin flow, press back at every step" pass on a real device is still the only way to close this out for good.

- **Admin can't browse the course structure beyond Subjects.** Admin could create Subjects but had no read-only way to see Chapters/content/tests underneath — that lived entirely on the Teacher side.
  → ✅ Done — see [P0-Todos.md item 10](P0-Todos.md#10-admin-has-no-way-to-browse-the-full-course-structure--✅-done). New read-only drill-down screen (Course → Subject → Chapter → Content/Tests) added to Admin Home.

- **Post-login back-navigation lands back on the sign-in screen.** An authenticated user pressing back could end up back at the phone-entry/OTP screen — a real security-feeling bug, not just a UX annoyance.
  → ✅ Done — see [P0-Todos.md item 1](P0-Todos.md#1-authenticated-user-can-navigate-back-to-the-sign-in-screen--✅-done). Restructured the root navigator so auth-flow screens are actually unmounted (via `Stack.Protected`) once signed in, not just hidden underneath — back navigation genuinely can't reach them anymore, in either direction (same protection applies symmetrically on sign-out).

- **Payments/Review routes cluttering the admin home page.** Same shape of issue as the approvals bullet above — payment and review references sitting on Home instead of living in their own tabs.
  → ✅ Covered by the same consolidation as the approvals-hub fix above.

#### Functionality

- **Test/content preview screens were entirely mocked.** The teacher's "preview before submitting" screen showed fixed sample data (a hardcoded "20 questions / 30 min", 2 fake sample questions, a fake video title, even a literal `'Test published (mock)'` toast) regardless of what was actually being previewed.
  → ✅ Done — see [P0-Todos.md item 12](P0-Todos.md#12-demo-test-series-preview-is-mocked--✅-done). Rewritten to use real data end to end (real test metadata/questions, real content metadata) — the flagged gap at the time (video/document upload itself still being mocked) has since been closed too, see below.

- **CSV bulk-upload for teachers was mocked; template download didn't work.** The picked file was never actually uploaded — a hardcoded `'mock-csv-key'` was sent instead, and there was no real download-template flow.
  → ✅ Done — see [P0-Todos.md item 11](P0-Todos.md#11-teacher-csv-upload-is-mocked--✅-done). Real file picker → real presigned-upload → real backend processing. The backend half (worker downloading the CSV from storage and actually parsing/importing rows) is also done — see the matching BE item below; this was genuinely a full-stack fix, not just a frontend one.

- **Teacher video upload was entirely mocked; no real playback anywhere.** Beyond the CSV item above, this backlog also called for teachers to be able to add real video content — at the time, video "upload" was a fake `setInterval` progress bar with a hardcoded `mock-video-key`, and there was no real video player anywhere in the app (student, teacher preview, or admin review) — all three showed either a static play icon over a black box or, for admin, a "preview isn't available" placeholder.
  → ✅ Done, full stack, this session. Real upload via Cloudflare Stream direct-upload (falls back to a raw R2 upload if Stream isn't configured), a real background worker that polls Cloudflare for transcode status and stores the real HLS playback URL once ready, and a real `expo-video`-based player wired into all three consumers: the student watch screen (previously a fake timer over a black box), the teacher's own preview, and — a gap found along the way — the admin moderation screen, which had never fetched or displayed the content being reviewed at all despite the API for it already existing. Paired with this: video content is now correctly gated behind an active subscription (see the matching BE item below), closing a real security hole where any logged-in student could previously fetch a paid video's real playback URL for free.
  Still open: the **document** half of "teacher can add content" is unfinished — document upload still sends a hardcoded `mock-doc-key`, and the underlying product question hasn't been settled (should a document be an uploaded file like a PDF, reusing the same real-upload pattern as video, or should the currently-typed-in-app rich text actually get persisted instead of discarded?). The student- and admin-facing document *viewers* were fixed regardless (both render whatever real file URL the backend returns, via a `WebView`) — but there's no real file to view yet until the upload side is decided and built.

- **Razorpay integration from the frontend was pending.** The checkout screen created a real backend order but then faked the actual payment step — it called the verify endpoint with a hardcoded `mock_signature`, which the backend explicitly special-cased to skip real signature verification. No user ever saw a real payment sheet, no money ever moved.
  → ✅ Mostly done, isolated on its own branch (`razorpay-integration`) rather than merged into the main working branch — because `react-native-razorpay` is a native module and can't run in Expo Go, and pulling it into the branch used for day-to-day testing broke that workflow. The real SDK call, the `mock_signature` backdoor removal, and two related type-contract bugs (frontend types not matching what the backend actually returns) are all fixed. **Still needed:** a development-client build (EAS or local) to actually test the real payment sheet on a device, and real Razorpay Test-mode keys configured on the backend — neither has happened yet, so this hasn't been run end-to-end for real.

### P1

- **Persist user session across logout so re-login skips OTP.** Currently every sign-out forces a full OTP re-verification to sign back into the *same* account, even moments later. Needs a locally-persisted "last account" record so re-entering the same phone number can skip straight to a lighter re-auth, without weakening the security of switching to a *different* account. Not investigated or started.

---

## BE

### P0

- **Prod sanity pass** — needs at least a week of real usage before launch, across:
  - **OTP delivery** — not touched this session. Currently backed by 2Factor.in in production, falling back to a console-logged stub for local dev when no API key is set. Needs a real end-to-end send-and-verify pass with real credits, not just the dev stub.
  - **Payments** — see the Razorpay item above; the backend side (order creation, HMAC signature verification, webhook handling, idempotent subscription activation) was already solid going into this session and is unchanged. What's new: the frontend now actually drives it for real instead of faking the last step. Still needs a real end-to-end run once the dev-client build exists.
  - **Redis** — not touched this session. Used for OTP rate-limiting per existing config; needs a real production check (connection resilience, actual rate-limit behavior under load).
  - **Subscription-gated access for users** — ✅ Done this session. Found a real gap: a `CheckAccess`/subscription-gate mechanism existed in the codebase and was correctly wired into starting a test attempt, but nowhere else — meaning any logged-in student could fetch a paid video or document's real playback URL directly, with zero subscription check. Fixed by wiring the same existing check into the content-item and chapter-content endpoints.
  - **S3 / video playback from S3** — ✅ Done this session, see the video item above. Real Cloudflare Stream integration (with a working R2-raw-file fallback when Stream isn't configured), real transcode-status polling, real playback in every screen that shows video.
  - **Teacher content upload — working end to end?** — CSV: yes, done. Video: yes, done this session. Document: no, still mocked — see the open item above.
- **Worker should download the CSV from storage, parse it, and store questions in the DB.** At the time this was written, the worker's CSV-import handler was a complete stub — it logged and immediately marked the batch "completed" without ever downloading or parsing anything, while a fully-correct parsing function sat unused right next to it.
  → ✅ Done (from earlier in this session, before the video/Razorpay work). Wired the existing S3 download method into the existing parser; the worker also needed a fix to initialize its storage client at all (it never had before), and the raw-file-upload API contract had a field-name mismatch (`filename` vs `file_name`) that silently produced files with no extension.
- **Change the OTP service.** As written, this doesn't specify what's actually wrong with the current one or what to change it *to* — needs scoping before it can be picked up. Not investigated.

### P1

- **Check what happens to sessions when the app is uninstalled.** Auth is JWT-based; uninstalling the app clears local storage (so the device itself "forgets" the token), but the token itself is stateless and would remain valid server-side until it naturally expires if it were ever extracted or replayed. Worth deciding whether that's an acceptable risk as-is, or whether server-side session tracking/revocation is needed. Not investigated.
- **Add coupon codes for users.** A real, unbuilt feature — needs a discount-code model and wiring into the Razorpay checkout flow (adjusting the order amount before creating it). Not started.

### P2

- **Move to an ORM instead of raw SQL queries.**
  → Appears to already be satisfied — this backend uses GORM throughout (every handler and model touched this session was GORM-based: struct tags, `.Where().First()`/`.Updates()` query patterns, no raw SQL found anywhere). This item may predate a migration that already happened, or refer to a different part of the codebase not encountered in this session's work. Worth a quick confirmation sweep before removing it outright, but nothing found so far suggests it's still open.
