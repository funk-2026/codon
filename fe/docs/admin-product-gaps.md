# Admin: product gaps and flaws (2026-11-14)

A product review of the admin role after the UX rework, from the frontend code and the backend route list. **Nothing here has been fixed yet.** "Verified" means I read the code that proves it; "to check" means it is likely but I haven't confirmed it.

## P0: things that are wrong today

| # | Gap | Evidence | Effect |
|---|---|---|---|
| 1 | **Every admin list shows only its first page.** The backend pages all lists at 25 rows (KYC at 200) and returns a `next_cursor`. The app never sends a cursor, so it only ever sees the newest 25. | Verified: `pagination.DefaultLimit = 25`; `listUsers`, `listPayments`, `adminListTests`, `adminListContent`, `adminListBrainHacks`, `adminListDecks` ignore `next_cursor`. | **Users:** from the 26th user on, an admin can't find anyone, because search only filters the 25 loaded rows (the backend supports `?search=&role=` but it is unused). **Payments:** list and the "Captured" total cover only 25 payments, so the total is wrong. **Review:** at most 25 tests, 25 lessons, 25 hacks and 25 decks are visible, so the counts and badges are capped and older submissions can't be reached. **Course structure** can show "Nothing here yet" for a chapter that has content. **User detail** teacher counts and payment history are capped too. |
| 2 | **Role change has no safeguards in the backend.** | Verified: `UpdateUserRole` ignores who is calling (`_ = middleware.GetUser(c)`), so an admin can demote themselves or the last admin through the API; no audit record. The app blocks changing your own role, but that is a UI check only. | Lock-out risk and no trail of who made whom an admin. |
| 3 | **User feedback goes nowhere.** | Verified: students, teachers and admins can send feedback (`POST /feedback` saves it) but there is no admin route or screen that reads it. | Every "Give feedback" button, in all three roles, collects messages nobody can see. |

## P1: the backend can already do it, the app doesn't offer it

| # | Gap | Evidence |
|---|---|---|
| 4 | **Manage the Home updates carousel** (the banner on every student's Home). | Backend has full create, edit and delete (`/admin/home-updates`); no admin screen. |
| 5 | **Erase a user's personal data** (privacy requests). | Backend has `POST /admin/users/:id/purge-personal-data`; the app never calls it. |
| 6 | **Reassign a question report** to another teacher. | Backend has `/admin/reports/:id/reassign`; the Reports segment only resolves or dismisses. |
| 7 | **Delete a plan.** | Backend has `DELETE /admin/subscription-plans/:id`; the plan editor only toggles active. |
| 8 | **Rename, reorder or delete subjects and chapters.** | Backend has `PATCH` for both; Course structure can only add. |
| 9 | **Server-side search and filters on Users** (role, search). | Backend already supports them; the app filters locally (see #1). |

## P2: needs backend work (also listed in `admin-users-backend-gaps.md`)

| # | Gap | Why it matters |
|---|---|---|
| 10 | Suspend or reactivate an account | Abuse, chargebacks, leaked accounts |
| 11 | Admin sign-out of a user's devices | Lost phone, shared account |
| 12 | Grant or extend access without a payment | The most common support request |
| 13 | **Take down live content** (unpublish a test, lesson, hack or deck) | Admin can approve or reject submissions but cannot pull something already live (wrong answer key, copyright). |
| 14 | **Audit log** (role changes, approvals, access grants, setting changes) | Accountability, and needed before #2, #10 to #12 |
| 15 | **Notify admins when something is waiting** (push or a daily digest) | The Review queue is only discovered by opening the app. |
| 16 | **Announcements** to students or teachers | Only the Home carousel exists; nothing for a one-off message. |
| 17 | Refunds and payment reconciliation, plus **export** (payments, users) | Finance and support; there is no way to get data out. |
| 18 | Create a course | Only subjects and chapters can be added to existing courses. |
| 19 | Per-user activity (last active, tests, score), and `?user_id=` / `?creator_id=` filters | Support view and teacher oversight |
| 20 | Invite a teacher by phone | Today the person must sign in first, then be promoted. |

## UX flaws still in the admin flows

- **KYC from a user:** there is no "KYC record by user" endpoint, so the app downloads all three KYC lists to find one record (and that list is capped too).
- **Plans:** price or duration edits don't say what happens to people already subscribed, and the active toggle has no confirmation.
- **Analytics:** three ranges (7 days, 30 days, all time), no export, no drill-down. It repeats "Pending review", which Review already shows.
- **Admin profile** has "Sound effects" and "Give feedback", which are student-style settings; there is nothing admin-specific (for example notification preferences).
- **Tags and topics, wellness and the KYC detail screen** were not part of this pass and were not reviewed in depth.
- **No search inside the Review inbox beyond title and author;** no sort or bulk approve for a long queue.

## Suggested order

1. **P0 #1: paginate every admin list** (cursor, "Load more", and use the backend search and role filters). It fixes wrong numbers and unreachable users. This is frontend only.
2. **P0 #2 and #14: role safeguards and an audit log** (backend), then **#3: a feedback inbox** (small backend route plus a screen).
3. **P1 #4 to #9** in the app, starting with Home updates and plan delete.
4. **P2 #11, #12, #10, #13** (sign-out, grant access, suspend, take down) as one backend batch, each recorded in the audit log.
