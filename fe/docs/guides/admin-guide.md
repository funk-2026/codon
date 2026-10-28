# Codon — Admin guide

Admins run the platform: approve content, manage people and payments, and switch features on. Admins can also use every teacher screen (the **role picker** after sign-in lets you choose).

## Home
- **Manage Subjects / Course Structure:** courses → subjects → chapters that everything hangs off.
- **Platform Settings:** e.g. **KYC required** (students must have approved ID before paid content).
- **Analytics:** platform overview (users, subscriptions, activity).
- **Custom Tests & Pool** — the control room for the custom test module:
  - **Health (last 24 h):** tests generated, auto-submitted attempts, rejected uploads, open reports, questions held for review, active tests.
  - **Feature switches** (off by default, each asks to confirm): **Custom tests**, **Tutor mode**, **Question-status filters**. Students see changes within about a minute (after reopening the app).
    The **Bookmarks / Question reports / Ratings / Math rendering** switches are shown but currently do nothing — those features are always on.
  - **Limits:** min/max questions and minutes, free plan (questions per test, tests per day), templates, rate limits — each with **Reset to default**.
  - **Question pool:** chapters below the minimum pool size.
  - **Presets shown in the builder:** **+ New preset** / **Edit** (questions, timing, marking, selection strategy, order, difficulty, previous-year only) with a live "Students will see" line; switch on/off; delete. Long-press-to-build and "Start from" chips use these.
  - **Bookmark lists:** rename *Revise later / Doubts / Important*.
- **Tags & Topics:** tags — search, see usage, **rename**, **merge into** another (questions move over), delete unused; topics — pick course/subject/chapter → add, rename, delete (refused while questions use it).
- **Wellness articles:** write the Support-tab articles (Guidance / Motivation / Reflection Prompts) with formatting and images; edit, **hide**, delete. They go live on save. Until any exist, students see built-in starter articles. Note: hidden articles disappear from this list.

## Review tab (approval queues)
- **KYC Review:** approve / reject ID submissions (reason required).
- **Test Approvals:** filter by module, open, **Approve** or **Reject** with a reason. The teacher then publishes.
- **Content Approvals:** videos and documents.
- **Question Reports:** student reports across all teachers — resolve, dismiss, or reassign.
- **Corrections:** edits to live questions — side-by-side *Now* vs *Proposed* (images included). **Approve** applies it for students; **Reject** needs a reason.
- **Hacks & Flashcards:** pending Brain Hacks and flashcard decks — expand to read every word / card, then **Approve** or **Reject** (reason sent to the author).

## Users tab
Search users → profile, subscription, sessions/devices. Change **role** (student / teacher / admin). For teachers: **Can manage all content** — lets them edit and moderate everyone's content (they see a "Platform-wide access" banner).

## Payments tab
Payments list and details (Razorpay order / payment ids), **subscription plans** — create and edit price, duration and course.

## Launch checklist for the custom test module
1. Make sure teachers have tagged questions (subject, chapter, difficulty) — check **Question pool**.
2. Create a few **presets**.
3. Turn on **Custom tests** (and optionally Tutor mode / status filters).
4. Watch **Health** for the first days.
