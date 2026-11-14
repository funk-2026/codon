# Student: what is not built yet, and what I need to know first

Written 2026-11-14 alongside the student gap fixes (see `student-product-gaps.md`). Everything below was **not** built, either because it needs a business decision, an account or credentials, content I don't have, or work I can't test here. Each item says what was missing so you can answer once and we can build it.

> **Backend warning.** The backend changes from this round (migrations `0006` and `0007`, new endpoints, router tests) were written without a Go toolchain and have **never been compiled or run**. Before deploying: `go build ./...`, `go vet ./...`, `go test ./internal/router/...`.

## Switches and settings (all off or blank by default)

| Where | Name | What it does |
|---|---|---|
| App build | `EXPO_PUBLIC_ANALYTICS_ENABLED=true` | Lets the app send usage events and crash events to our own backend. Off unless set. |
| Admin → Platform settings → App, links and support | Collect app usage events (`analytics.events`) | The server discards events unless this is on, so you can switch collection on or off without a release. Both switches must be on. |
| same | Minimum app version, Play Store and App Store links | Older versions see an "Update the app" screen. Blank = no gate. If the setting can't be fetched the app opens normally. |
| same | Terms and Privacy links | Open from Settings and the sign-in screen. Hidden or plain text until set. **Stores require a privacy policy link.** |
| same | Support email and WhatsApp | Shown on Help and support. |
| same | Students needed before rank shows (default 10) | Test Series results show rank and top percent once this many students have finished the test. |

## Needs a decision, or an account

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

## Small things I noticed and left alone
- **Sign-in asks only for name and course.** The exam date is optional and lives in Edit profile; I did not add it to first-time setup.
- **Subscribe screen:** the plan list shows what each plan includes only as free-text benefits; there is no comparison table or "what you get" breakdown.
- **Notifications screen** only lives under the bell on Home and has no filters or "mark all as read"; fine at today's volume.

## What was built this round (for reference)
Analytics collector (off by default), crash events, minimum-version gate, Terms and Privacy links, Help and support, payment history and receipts, correct plan naming, video resume, rank and percentile for Test Series, exam date and countdown, global search, one-time intro, Home fallback suggestion, data export, subscription-ending reminders, correct "not charged" wording, retry returns to the same plan, a stable device id with a fixed two-device limit, and an admin section to set all the links.
