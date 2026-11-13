# Admin role: screen audit (2026-11-14)

From the code in `fe/app/(admin)`. Nothing has been changed yet. Taps are counted from the Home tab.

## Screens (26 files)

**Tabs (5):** Home, Users, Review (headed "Approvals"), Payments, Profile.

| Group | Screens |
|---|---|
| Review queues (6, each its own screen) | KYC (inline in the Review tab and again in `kyc-queue`), `moderation-tests` (tests), `moderation-videos-docs` (lessons), `content-queue` (Brain Hacks and flashcard decks, switchable), `reports-queue` (question reports), `corrections-queue` |
| Review detail | `content-preview-detail` (tests and lessons), `kyc-review-detail` |
| People and money | `user-detail`, `payment-detail`, `subscription-plan-list`, `subscription-plan-edit` |
| Course and content setup | `manage-subjects` (add subjects and chapters), `course-structure` (browse content by course), `taxonomy` (tags and topics), `wellness` (articles) |
| Settings and insight | `platform-settings` (KYC on or off), `custom-test-admin` (custom test settings, presets, pool health), `analytics-overview` |
| Account | `give-feedback`, `manage-devices` (one-line wrappers) |

## Taps to reach each thing

| Goal | Path | Taps |
|---|---|---|
| Approve a KYC | Review tab → Approve (inline) | 2 |
| Approve a test | Review → Test Approvals → item → approve | 4 |
| Approve a lesson | Review → Content Approvals → item → approve | 4 |
| Approve a Brain Hack or deck | Review → Hacks & Flashcards → (pick kind) → item | 3 to 4 |
| Resolve a question report | Review → Question Reports → report | 3 |
| Review a correction | Review → Corrections → item | 3 |
| A user's details | Users → user | 2 |
| A payment | Payments → payment | 2 |
| Edit a plan | Payments → Plans → plan | 3 |
| Add a subject or chapter | Home → Manage Subjects | 2 |
| Platform setting | Home → Platform Settings, or Custom Tests & Pool | 2 |

## Duplication

1. **KYC is reviewed in two places:** inline in the Review tab, and again in the standalone `kyc-queue` screen.
2. **Six queues on six screens, three of them for content.** Tests, lessons, and Brain Hacks plus decks are separate screens (and a toggle inside the last one) for the same job: review something a teacher made. The teacher side was already merged into one Content list.
3. **Two screens for course structure:** `manage-subjects` (add) and `course-structure` (browse). Both sit on Home.
4. **Two screens for settings:** `platform-settings` (a single KYC switch) and `custom-test-admin` (more settings, presets, pool health).
5. **The Pending KYC and Pending Reviews tiles on Home look tappable but don't open anything,** so Home repeats numbers that Review already shows.
6. **Payments has a "Plans" link to a separate list** instead of living inside the tab.

## What's off

- **A real bug:** the Payments summary shows **"Captured" and "All Time" as the same number** (both use the captured total).
- **No badges.** The Review tab doesn't show how much is waiting, so you have to open it. Only the cards inside it have counts, and only for some queues.
- **Home is a tool launcher with a header of numbers.** Two tool tiles use the same gear icon, and the grid mixes setup tasks (subjects, tags) with settings and analytics with no grouping.
- **The Review tab is titled "Approvals"** while its tab label says Review.
- **Inconsistent filters:** Users has a search plus role chips, Payments has its own chips, queues have status chips in different styles.
- **Each queue screen has its own header, empty state and approve/reject sheet,** so the same action looks slightly different in each.

## Proposal (not started)

**Tabs stay: Home · Review · Users · Payments · Profile** (admin's mental model is already these five). The Review tab gets a badge with the total waiting.

- **Review = one inbox.** Segmented **Content | KYC | Reports | Edits**, each with a count badge.
  - **Content** merges the three content queues into one list with type chips (All, Tests, Lessons, Hacks, Decks), like the teacher's Content tab. A row opens one review screen with the teacher's submission and Approve and Reject.
  - **KYC** is the inline list you have now. The duplicate `kyc-queue` screen goes.
  - **Reports** and **Edits** are the existing queues embedded.
- **Home = the state of the platform.** The four numbers become tappable (KYC and Reviews open Review, Users and Subscriptions open those tabs). Below, tools in three groups: **Course** (subjects and chapters, with the structure view merged into one screen), **Content** (tags and topics, wellness), **Platform** (settings, custom tests and pool, analytics).
- **Settings in one place:** `platform-settings` and `custom-test-admin` become one **Platform settings** screen with sections.
- **Payments:** a **Payments | Plans** segmented control inside the tab (no separate Plans screen to go to), and the summary fixed (Captured, and Payments count).
- **Users and Payments** use the same search toolbar and chips as the rest of the app.

## Staging

1. **Review tab as one inbox** (segments, badge, one content queue, drop `kyc-queue`).
2. **Home and tools:** tappable numbers, grouping, merge subjects and structure, merge settings.
3. **Payments and Users:** Payments | Plans segments, fix the summary, shared toolbar.
