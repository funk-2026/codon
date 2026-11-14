# Gaps closed so far: one reference (2026-11-14)

Everything we reviewed and fixed across the student, teacher and admin apps, plus what is still open. Detail for each lives in the per-role docs named at the top of each section. "Backend, uncompiled" means it was written without a Go toolchain: it needs `go build ./...`, `go vet ./...`, `go test ./internal/router/...` and migrations 0006, 0007 and 0008 before release.

## 1. Navigation and UX rework (all three roles)

What is still open and the release checklist: `open-decisions.md`. The screen map: `screen-inventory.md`.

| Problem | Fixed by |
|---|---|
| Screens reachable several ways, no single place for each thing | One deterministic route per screen; duplicate entry points removed in all three apps |
| Deep drill-downs for Q Bank, Test Series, Practice, Videos, Notes | Segmented controls with one nested tree and one shared toolbar (search plus chips), so Practice, Learn and Support behave the same |
| Search bar vanished when switching to Custom; flash of unstyled text | Same container for all three Practice segments; search kept across segments |
| Flashcards looked poor, the review screen was ugly, width inconsistent with Videos and Notes | Rebuilt deck list, study and review screens at the same width as the other lists, with search |
| Revise-all crashed the app | A colour lookup was running inside an animation worklet; moved to the JS thread |
| Home header and Support tab looked inconsistent | Minimal header shared by all tabs; Support rebuilt with real, consistent containers |
| Test history and progress lived oddly inside Profile; Brain Hacks hard to find | Given a defined home and entry points |
| Teacher Questions section hard to use; red banner stayed after "mark as fixed"; tag field confusing | Questions tab rebuilt, banner fixed, tag placeholder written |
| Admin had scattered queues | Tabs reorganised (Home, Review, Users, Payments) with one inbox for everything waiting |
| Gesture handler crash in Quick tag | App wrapped in the gesture root |

## 2. Student

**Closed:** analytics (own backend, double-gated, off by default); crash events and a minimum-version screen; Terms and Privacy links; help and contact; payment history and receipts; "NEET UG Pro" hardcoding; video resume; rank and percentile (Test Series only, once enough students finished); exam date and countdown; global search; first-run intro; "Up next" without custom tests; renewal reminder; data export; profile fake initials and dead camera button removed; a stable device id (signing in twice on one phone no longer signs the other phone out); the failure screen no longer says "not charged" after the gateway took the money.

**Not closed (details in `open-decisions.md`):** doubts, real crash tool vendor, analytics vendor, GST invoices, refunds/auto-renew/coupons/trial/referrals, payment recovery after the app is closed, languages, dark theme, changing phone or adding email, profile photo, offline videos and notes, retention features, more push types.

## 3. Admin

**Closed (frontend):** every list reads all pages (Users and Payments use server search and filters; correct totals); status bug that hid everything except pending items; user detail (activity, sign-out of devices, give or extend access, suspend, history, erase personal data); Audit log, User feedback and Home banners screens; rename subjects and chapters; reassign reports; plan edit confirmations and price rounding; Live content screen with take-down; create a course; delete empty subjects and chapters; add a teacher by phone; CSV exports; announcements.

**Closed (backend, uncompiled):** role-change safeguards and audit rows; suspend and reactivate enforced at sign-in and on every request; sign-out of one or all devices; grant access; take-down of all four content types; audit log and feedback read routes; status and owner filters; payments search and summary; admin notified (and pushed) when something is submitted for review.

**Not closed:** refunds (real money; needs a gateway design), an in-app admin notifications inbox (would repeat push and the Review badge), audit writes for wellness and home banners, a scheduled digest, a dedicated suspended-account screen.

## 4. Teacher

**Closed:** edit a test's details after creation; delete lessons and edit their details; stats on live tests and lessons and "Your impact" on Home; document lessons store real text (fake toolbar and fake "Saved" removed); teacher notification inbox with push taps; a note to the reviewer when sending or resending; review turnaround shown; duplicate a test; scheduled publishing for tests, lessons, Brain Hacks and decks; bulk "send all drafts for review"; instructions and per-question sections on tests; "By <name>" shown to students; hand over a test or lesson to another teacher; Teacher guide screen; the duplicate "My Content" row removed from Profile; the reviewer sees the teacher's note.

**Not closed:** earnings and recognition (undecided), version history, co-authoring (hand-over only), shuffling, passage and multi-answer questions, a full reviewer thread, expiry windows, Brain Hack and deck stats, background video upload (needs a device test), student doubts, other languages.

## 5. Correctness bugs found and fixed along the way

- Admin lists page at 200 rows, not 25 (my first note was wrong); an audit log already existed.
- Admin tests and content lists silently defaulted to pending-review only, so counts elsewhere were wrong.
- Teacher "live" counts were wrong until fixed.
- Price floating-point rounding in plan edit (`Math.round(parseFloat(price) * 100)`).
- A notification-route test was deliberately changed: push taps may now open exactly the admin Review tab and the teacher inbox, nothing else in those roles.
- A formula preview and an authoring help sheet already existed, so those two teacher gaps were mis-stated in the first review.

## 6. Before any release

See the checklist at the top of `open-decisions.md`.
