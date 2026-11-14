# Student: product gaps and flaws (2026-11-14)

A product review of the student side from the code (screens, API layer) and the backend routes behind it. **Status: most of this was built on 2026-11-14; see "Status after the fixes" at the end.** "Verified" means I found the code that proves it; "to check" means likely but not confirmed. "BE" means the fix needs backend work.

## What already works well (so we don't break it)

- **Taking a test survives bad networks:** answers go into a persisted queue that retries with backoff, flushes on foreground and before submit, and shows "N answers not saved yet". Expiry and "taken over on another device" are handled.
- **Weak-area guidance:** progress detail, mastery buckets, recommendations that open the custom builder pre-filled, and "practise my mistakes".
- **Spaced-repetition flashcards**, bookmarks across questions, flashcards and content, report-a-problem with a status screen, and share-your-result.
- **Device management, account deletion in the app, and screen-capture protection.**

## P0: trust, measurement and store readiness

| # | Gap | Evidence |
|---|---|---|
| 1 | **No analytics are collected.** Every screen calls `track()`, but the app never registers a sink, so every event is dropped. There is no funnel, retention or revenue picture at all. | Verified: `setSink` is defined and never called. |
| 2 | **No crash or error reporting, and no minimum-version or force-update mechanism.** A bad release can't be seen or switched off, and old app versions can't be told to update. | Verified: no Sentry/Crashlytics or version gate in the app or in `appconfig`. |
| 3 | **Terms of Service and Privacy Policy go nowhere.** The rows in Settings do nothing, and the sign-in screen shows them as styled text with no link. Both stores require a privacy policy link. | Verified in `settings.tsx` and `phone-entry.tsx`. |
| 4 | **No help or contact.** There is no FAQ, no support contact, no "I paid but don't have access" path. The only outlet is Give feedback, which until this week nobody could read. | Verified: no help/FAQ/contact screens. |
| 5 | **A student can never see what they paid.** There is no payment history and no receipt or GST invoice after the success screen. | Verified: the only student billing endpoint is `GET /me/subscription`. BE. |
| 6 | **"NEET UG Pro" is hardcoded** in the locked-content sheet and the checkout summary, so a 9th or 10th standard student is told they're buying NEET UG Pro. | Verified in `LockedSheet.tsx` and `checkout.tsx`. |

## P1: the learning loop

| # | Gap | Evidence |
|---|---|---|
| 7 | **Videos don't resume.** The player sends progress to the server but never reads it back, so "Continue now" starts the lecture from 0:00 while the card says "63% completed". | Verified: no seek on open; no last-position field in the content API. BE for the field, then FE. |
| 8 | **A test result has no context.** Only your own score. No rank, percentile or class average, which is the first thing a competitive-exam student looks for. The backend already computes per-question cohort percentages. | Verified: result screen has score and breakdown only. BE for a test-level distribution. |
| 9 | **No exam goal.** There is no exam date, countdown, target score or study plan. The daily goal is a number stored on the phone. Onboarding asks only for name and course. | Verified: no exam-date field anywhere. BE for the field. |
| 10 | **No way to ask a doubt.** There is a bookmark collection called "Doubts", but nobody to ask. Teachers can't see or answer anything from students except reports on question errors. | Verified: no doubt feature in app or backend. BE. |
| 11 | **No global search.** Search only filters subjects and chapters (and decks by title). A student can't find a test, a lecture or a note by name. | Verified in `CurriculumTree`. BE for server search. |
| 12 | **Nothing works offline except taking a started test.** Videos and notes can't be saved; the lecture PDFs can be downloaded and shared, but not the lecture. | Verified. |
| 13 | **First run is thin.** The onboarding screen is a dead redirect. After profile setup the only guidance is the Start here card on Home. | Verified. |
| 14 | **"What should I do next?" depends on a feature flag.** Up next on Home only shows when custom tests are on. Without it, a returning student with no unfinished test sees only Today and Brain Hack. | Verified. |

## P1: money

| # | Gap | Evidence |
|---|---|---|
| 15 | **Nobody is reminded to renew.** The only signal is a banner in the last 7 days. The backend sends no expiry push, only streak nudges. | Verified. BE. |
| 16 | **One-time plans only.** No auto-renew or UPI AutoPay, no coupon or promo codes, no free trial, no referral. | Verified: no such fields or screens. BE. |
| 17 | **Payment problems have no recovery path** beyond Retry (see #4, #5). If the app is killed after paying but before verifying, the student's only recourse is to write feedback. | To check against the verify flow. |

## P2: reach, retention and polish

| # | Gap | Evidence |
|---|---|---|
| 18 | **English only.** There is no translation layer, though questions already carry a language field. A large part of this audience reads Hindi or a regional language. | Verified: no i18n. |
| 19 | **Light theme only** (`userInterfaceStyle: light`). Night-time study is the norm for this audience. | Verified. |
| 20 | **Phone number is the only identity.** No email, no change-number flow, no recovery if the SIM is lost. | Verified: OTP only. BE. |
| 21 | **Profile editing is name only.** The backend has a profile photo field the app never uses. | Verified. |
| 22 | **Retention features are minimal:** streak and daily goal only. No streak recovery, weekly summary, leaderboard, badges or invite-a-friend. | Verified. |
| 23 | **Push is narrow.** Only streak nudges and workflow updates; nothing for "a new test in your chapter", "your plan ends soon", or "you haven't practised in 3 days". | Verified. BE. |
| 24 | **No data export** (deletion exists, a copy of your data does not). | Verified. BE. |

## Suggested order

1. **Measure and protect first (P0 #1, #2, #3):** register an analytics sink and a crash reporter, add a minimum-version check to app config, and link the legal pages. Mostly frontend plus one small config field.
2. **Fix the visible lies (P0 #6, P1 #7):** the hardcoded plan name, and video resume (field in the backend, seek in the app).
3. **Build trust (P0 #4, #5):** a Help screen (FAQ, contact, "payment problem") and a payment history with receipts.
4. **Give results meaning (P1 #8, #9):** a test-level percentile and an exam date with a countdown.
5. **Then the larger bets:** doubts, global search, expiry reminders, auto-renew, offline.

## Questions for discussion

1. Which analytics and crash vendors do you already use or prefer?
2. Is there a support channel (WhatsApp number, email, helpdesk) the Help screen should point at, and a published Terms and Privacy URL?
3. Should results show a rank and percentile across all students, or only within a test series?
4. Are doubts something teachers have time to answer, or should they go to a community or a daily live session instead?
5. Is auto-renew (UPI AutoPay) on the roadmap, and are coupons or referrals part of the growth plan?
6. Is Hindi (or another language) a launch need or a later one?

## Status after the fixes

| # | Item | Status |
|---|---|---|
| 1 | Analytics | **Built, off by default.** Our own backend collects events; needs the build flag and the server switch. |
| 2 | Crash reporting and version gate | **Partly built.** Crash events go through the same collector; a minimum-version screen is built. A real crash tool needs a vendor (open decision 2). |
| 3 | Terms and Privacy | **Built.** Links are set by an admin; hidden until set. |
| 4 | Help and contact | **Built.** FAQ, contact buttons from admin-set links, report a payment problem. |
| 5 | Payment history and receipts | **Built** (receipt, not a GST invoice; open decision 4). |
| 6 | "NEET UG Pro" hardcoded | **Fixed.** |
| 7 | Video resume | **Built** (backend returns the saved position; the player seeks to it). |
| 8 | Rank and percentile | **Built for Test Series only**, once enough students have finished. |
| 9 | Exam date and countdown | **Built** (Edit profile, Home countdown). |
| 10 | Doubts | **Not built.** Needs decisions (open decision 1). |
| 11 | Global search | **Built** (tests, lessons, flashcards, Brain Hacks by title). |
| 12 | Offline videos and notes | **Not built** (open decision 11). |
| 13 | First run | **Built** (a three-slide intro, once). |
| 14 | "Up next" without custom tests | **Built** (a "Practise a chapter" card). |
| 15 | Renewal reminders | **Built** (once, three days before a plan ends). |
| 16 | Auto-renew, coupons, trial, referral | **Not built** (open decision 5). |
| 17 | Payment recovery | **Mostly already covered** by the webhook and an idempotent confirm; plus a failure screen that no longer says "not charged" after the gateway took the money (open decision 6). |
| 18 | Languages | **Not built** (open decision 7). |
| 19 | Dark theme | **Not built** (open decision 8). |
| 20 | Change phone or add email | **Not built** (open decision 9). |
| 21 | Profile editing | **Partly.** Exam date added and the fake initials and dead camera button removed; photo is open decision 10. |
| 22 | Retention features | **Not built** (open decision 12). |
| 23 | Push | **Partly** (expiry and admin-review reminders; open decision 13). |
| 24 | Data export | **Built** (Settings → Download my data). |

Found while fixing: the app sent a new device id on every sign-in and the server's two-device limit ignored device ids, so signing in twice on one phone could sign the other phone out. Both are fixed.
