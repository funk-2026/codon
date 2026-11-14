# Codon FE: screen inventory and tap counts

Built from the current code in `fe/app` and `fe/src` (after the navigation refactor).
Taps are counted from the Home tab of each role, one tap per button or row, and don't include typing or answering questions.

**Totals:** 8 entry/auth screens, 37 student files, teacher reworked (see its section), 26 admin (5 tabs). Plus 3 layout-only files.

## Entry and auth (8)

`index` (router only, no UI), `phone-entry`, `otp-verify`, `profile-setup`, `course-selection`, `role-picker` (admins), `preview-mode` (dev builds only), `onboarding` (dead: only redirects to phone-entry, nothing links to it). Deep link: `custom-test/shared/[code]` opens the custom builder pre-filled.

Flow: Launch → Phone entry → OTP → (first time) Profile setup → Home.

## Student (37 files: 5 tabs, 2 redirects, 30 screens)

Tabs: **Home, Practice, Learn, Support, Profile.** Status: reworked 2026-11-14 so each destination has one owner. Home, Practice and Learn were redesigned the same day.

### Tab screens
| Tab | Owns | Buttons that lead out |
|---|---|---|
| Home | What to do now | Bell (Notifications), avatar (Profile), **Continue** card (unfinished test, else last video or notes), **Start here** (new students: first test, first lesson) or **Up next** (top recommendation, opens the custom builder; needs Custom Tests on), **Today** (daily goal ring, streak, 7-day dots, "Your progress →"), plan banner (only if no plan or expiring), Brain Hack of the Day (+ See all) |
| Practice | All tests | Segmented **Q Bank \| Test Series \| Custom**; a toolbar (search, Newest/Top rated) shared by Q Bank and Test Series; each shows a subject → chapter → test accordion that stays mounted when you switch; Custom shows Build a custom test and My custom tests; resume test, recent tests, **View all →** (Test History) |
| Learn | All learning content | Segmented **Videos \| Notes \| Flashcards**; the same search toolbar on all three (text clears when you switch); Videos and Notes show the accordion; **Flashcards** shows a Quick review hero (due count and time), then decks with a progress bar, due badge and Study or Revise button (due decks first); Recently watched |
| Support | Wellness | Featured article, categories, About MMM card |
| Profile | Account only | Edit profile, Subscription plans, KYC (if required), Bookmarks, My reports, Settings, Manage devices, Give feedback, Switch role (admins) |

### Other screens
- **Test:** `test-pre-start`, `test-question`, `test-result`, `test-review`, `test-history`
- **Custom test:** `custom-builder`, `custom-tests`
- **Learn:** `video-player`, `content-reader`, `flashcard-study` (study queue or revise-all, flip and swipe, three ratings), `brain-hacks`, `brain-hack-detail`
- **Money:** `subscription-plans`, `checkout`, `payment-success`, `payment-failed`
- **Account:** `edit-profile`, `settings`, `notifications`, `manage-devices`, `give-feedback`, `my-reports`, `bookmarks`, `progress-detail`, `kyc-status`, `kyc-submission`
- **Support:** `wellness-category`, `wellness-article`, `about-mmm`
- **Redirects (old links only):** `practice-hierarchy` → Practice tab, `learn-hierarchy` and `flashcards` → Learn tab. The Explore screen was deleted.

### Where everything lives (one owner each)
| Item | Only reachable from |
|---|---|
| Q Bank, Test Series, Custom | Practice tab |
| Videos, Notes, Flashcards | Learn tab |
| Test History | Practice → View all |
| Progress detail | Home → Today → Your progress |
| Notifications inbox | Home bell |
| About MMM | Support |
| Manage devices, Give feedback, Switch role | Profile |
| Brain Hacks | Home → Brain Hack of the Day (+ See all) |

### Taps to reach each thing (from Home)
| Goal | Path | Taps |
|---|---|---|
| Resume test or last video | Continue card | 1 |
| Q Bank or Test Series test, to Start | Practice → subject → chapter → test (→ Start) | 4 (5 with Start) |
| Video lesson | Learn → subject → chapter → video | 4 |
| Notes | Learn → Notes → subject → chapter → note | 5 |
| Flashcards study | Learn → Flashcards → deck (Study or Revise) | 3 |
| Custom test | Practice → Custom → Build | 3 |
| Brain hack | Home card | 1 |
| Wellness article | Support → article | 2 to 3 |
| Subscribe | Plan banner → plan → Pay | 3 |
| Progress detail | Today → Your progress | 1 |
| Test history | Practice → View all | 2 |
| Notifications | Bell | 1 |
| Bookmarks, My reports, Edit profile, KYC, Devices, Feedback | Profile → item | 2 |
| Settings, Log out | Profile → Settings → action | 2 to 3 |

### Business decisions made
- **Flashcards stay available.** A deck with nothing due opens revise-all, so cards never run out. The study screen has three ratings (Again, Good, Easy); Hard is hidden but the backend still accepts it.
- **Practice folded into Q Bank (student side).** Practice sets list under Q Bank, and history and the pre-start screen call them Q Bank. Stored data is unchanged.

### Open gaps
- The old Home stat tiles (Tests Taken, Avg. Score) now live only in Progress detail.
- Explore's **Recommended**, **Quick start presets** and **Practise a chapter** have no screen yet.
- Terms of Service and Privacy Policy rows in Settings do nothing.
- Segment doesn't switch if an old link opens an already-mounted tab with a different `kind`.

## Teacher (reworked 2026-11-14)

Tabs: **Home, Content, Questions, Profile.**

| Tab | What it does |
|---|---|
| Home | Greeting, **Create** (sheet: test, lesson, Brain Hack, deck), **Needs you** (changes needed, approved to publish, student reports, untagged questions), status summary (tap opens Content filtered), recent items, chapters that need questions |
| Content | Segmented **Tests \| Lessons \| Hacks \| Decks**, status chips, search, a + that creates the current kind; every row opens one detail screen (decks open the deck editor) |
| Questions | Segmented **Bank \| Tags \| Reports \| Edits**; badges on Reports and Tags (a count) |
| Profile | Name, sound, switch role (admins), devices, feedback, log out |

Other screens: `create-test`, `create-content`, `create-brain-hack`, `flashcard-deck`, `csv-upload`, `csv-import-report`, `question-builder`, `question-editor`, `quick-tag`, `content-preview` (the one detail screen), `preview-run`, `give-feedback`, `manage-devices`.
Redirects for old links: `brain-hack-detail`, `rejected-content-detail`, `question-bank`, `completeness`, `corrections`, `reports`, `flashcard-decks`.

## Admin (reworked 2026-11-14)

Tabs: **Home, Users, Review, Payments, Profile.**

| Tab | What it does |
|---|---|
| Home | Tappable numbers (Users, Active plans, Waiting on you); tools grouped into Course, Content, Platform |
| Users | Search, role chips, user list → user detail |
| Review | Segmented **Content \| KYC \| Reports \| Edits** with count badges; the tab itself shows the total; every content row opens one review screen |
| Payments | Segmented **Payments \| Plans**; payments open payment detail, plans open plan edit |
| Profile | Name, devices, feedback, log out |

Other screens: `content-preview-detail` (the one review screen), `kyc-review-detail`, `user-detail`, `payment-detail`, `subscription-plan-edit`, `course-structure`, `taxonomy`, `wellness`, `platform-settings` (General \| Custom tests), `analytics-overview`.
Redirects for old links: `moderation-tests`, `moderation-videos-docs`, `content-queue`, `corrections-queue`, `reports-queue`, `kyc-queue`, `manage-subjects`, `custom-test-admin`, `subscription-plan-list`.

## Open questions for admin

- The admin review screen and the teacher CSV screen still label Practice tests as "Practice" (students see them as Q Bank).

## Backend redundancy: Practice

See the Practice cleanup proposal in [future-gaps.md](future-gaps.md).
