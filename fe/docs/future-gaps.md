# Future gaps, decisions and release checklist

The one place for what is **not** built yet, what you need to decide or set, and the release checklist. The map of screens is `screen-inventory.md`. Built work is not listed here (see git history).

## Before any release (backend was written without a Go toolchain)

1. `go build ./...`, `go vet ./...`, `go test ./internal/router/...`, and run gofmt.
2. Apply migrations `0006`, `0007`, `0008`.
3. Run the worker (scheduled publishing, push, reminders).
4. Set the blank settings below; remove the local-only edits (Razorpay disabled, dev host).
5. Device checks: push taps, video upload in the background, the new teacher and admin flows.

## Switches and settings (all off or blank by default)

| Where | Name | What it does |
|---|---|---|
| App build | `EXPO_PUBLIC_ANALYTICS_ENABLED=true` | Lets the app send usage events and crash events to our own backend. Off unless set. |
| Admin → Platform settings → App, links and support | Collect app usage events (`analytics.events`) | The server discards events unless this is on, so you can switch collection on or off without a release. Both switches must be on. |
| same | Minimum app version, Play Store and App Store links | Older versions see an "Update the app" screen. Blank = no gate. If the setting can't be fetched the app opens normally. |
| same | Terms and Privacy links | Open from Settings and the sign-in screen. Hidden or plain text until set. **Stores require a privacy policy link.** |
| same | Support email and WhatsApp | Shown on Help and support. |
| same | Students needed before rank shows (default 10) | Test Series results show rank and top percent once this many students have finished the test. |

## Student: needs a decision, or an account

### 1. Doubts (a student asks a question, a teacher answers)
Not built. What I need:
- **Who answers?** Teachers who authored the question, any teacher, or a paid mentor pool? Do they have time, and how fast is the promise?
- **What can a student attach** (question, a lecture timestamp, a photo)?
- **Is the answer public** (shared with everyone who views that question) or private?
- **What happens when nobody answers in time?** Escalate, auto-reply, or hide the feature?
A rough design once decided: a `doubts` table tied to a question or lecture, a teacher inbox (a segment in the Questions tab), a status the student can follow, and a notification on answer.

### 2. Real crash reporting
Crash events now go to our own backend (when analytics is on), but they have raw stack traces and no source maps. A proper tool (Sentry, Firebase Crashlytics) gives readable traces, grouping, alerts and release health. Needs: **which vendor, and its project key or DSN**, plus a development build (it adds a native module, so it will not run in Expo Go).

### 3. Analytics vendor
Events are stored in `analytics_events` (our database, 90 days). Querying them needs a dashboard (Metabase or similar) or a vendor (PostHog, Mixpanel, Amplitude). The collector has a single `setSink()` hook, so adding a vendor is a small change once chosen.

### 4. GST invoices
Students now get a payment receipt with a share button (marked "not a tax invoice"). A GST invoice needs: **legal business name, address, GSTIN, HSN/SAC code, GST rate and whether prices include it, and your invoice numbering format**. Without these I'd be inventing tax documents.

### 5. Refunds, auto-renew, coupons, free trial, referrals
Not built. They change money flow and need decisions:
- **Refunds:** policy (when allowed), who approves, full or partial, and how it reconciles with Razorpay.
- **Auto-renew:** Razorpay Subscriptions or UPI AutoPay, which is a different integration from today's one-time orders, plus the mandate and cancellation flow.
- **Coupons and referrals:** discount rules (percent or amount, per plan, expiry, usage limits), who can create them, and the reward for a referral.
- **Free trial:** how long, which content, and abuse limits (one per phone?).

### 6. Payment recovery after the app is closed
Mostly handled already: the backend has a Razorpay webhook that activates the plan even if the app dies after paying, and the app's confirm call is safe to repeat. What to confirm with whoever runs Razorpay: **the webhook is configured in the Razorpay dashboard for production**. If it isn't, a student whose app closed after paying has to rely on support. The Payments screen and the "Report a payment problem" path are there for that case.

### 7. Languages (Hindi and others)
Not built. Needs: **which languages and in what order**; who translates the app text (about 600 strings) and whether question content is also translated (the questions already have a language field); and whether students choose per-app or per-test language. Technical plan once decided: extract strings into a translation layer and add a language picker in Settings.

### 8. Dark theme
Not built. The colour system has a light palette only. Needs a designed dark palette (about 90 tokens) and a check of every screen. I can derive one, but you should approve how it looks.

### 9. Changing phone number, adding email
Not built. Sign-in is OTP to a phone, so changing the number is an identity change: verify the old and new numbers, and decide what happens to a lost SIM (support-assisted recovery?). Email would need verification and a decision on whether it is for recovery only or also for receipts.

### 10. Profile photo
Not built. The upload system has no profile-photo purpose, and the profile response gives a storage key, not a link the app can show. Needs a backend purpose, a size and format policy, moderation (is a photo reviewed?), and where it is shown. The dead camera button on Edit profile has been removed until this exists.

### 11. Offline videos and notes
Not built. Lecture PDFs can already be downloaded. Videos are streamed (HLS), and saving them for offline needs: **the video host's offline or DRM support, how long a download stays valid, how many devices, and a storage limit**. This is a large piece of work and also a piracy decision.

### 12. Retention features
Not built: streak freeze or recovery, weekly summary, leaderboards, badges. Needs product decisions on what you want to reward and whether public leaderboards are acceptable for your audience (privacy, pressure on younger students).

### 13. More push notifications
Done: a reminder three days before a plan ends, and a reminder to admins when something is submitted for review. Not done: "a new test in your chapter", inactivity nudges, exam countdown milestones. Needs frequency rules, quiet hours and per-type opt-outs so students aren't over-messaged.

## Teacher: needs a decision
- **Earnings and recognition:** are teachers paid per content or per student, and do you want badges or a leaderboard? Nothing is built.
- **Question types:** single-answer only today. Multiple-correct, numeric, assertion-reason, matching and passage questions need a decision on which exams need them, then backend and student-app work.
- **Shuffling** questions or options: needs per-attempt remapping of answers; build with tests.
- **Version history and co-authoring:** hand-over exists; shared editing and undo do not.
- **Reviewer thread:** only a one-way note on submit exists; a two-way thread is a bigger feature.
- **Expiry windows** for time-bound test series, and stats for Brain Hacks and decks.
- **Background video upload:** needs a device test before deciding.

## Admin: needs a decision
- **Refunds:** move real money through Razorpay; needs policy (when, who approves, partial or full) and a gateway-side design.
- **Audit writes** for wellness and Home banner changes; a scheduled digest for review pushes; a dedicated suspended-account screen with a support contact.

## Backend cleanup (proposal, nothing changed)
Fold **Practice into Q Bank**: they behave identically in `be/`. Order if approved: migrate `module_type='practice'` to `qbank`; keep accepting `practice` from old app builds for a release or two; then remove the constant, validation and swagger entries; teacher create-test already dropped the option. Decide whether to fold question `source_type` "practice" into "qbank" too (it describes where a question came from, so you may want to keep it).
