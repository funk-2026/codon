# Codon app: screen flows by user

Generated from the code in `fe/app`. "Goes to" lists every screen that screen navigates to (some links are built dynamically, so treat as the main paths). Line counts are the size of each screen file.

**100 screens, 25,028 lines.**

## Entry and shared screens

Launch, sign-in, role choice. Every user passes through these. 9 screens, 1,450 lines.

**Main journeys**

- Launch → (signed in?) → role home. Not signed in → Phone entry → OTP verify → (first time? Profile setup) → role home.
- Admin → Role picker → Admin, Teacher or Student home. Choice is remembered.
- Developer builds only: Phone entry → Preview mode → signs in as a fake student, teacher or admin.

| Screen | What the user does | Goes to | Lines |
|---|---|---|---|
| `course-selection.tsx` | Pick the course (NEET UG and others). | [home tab] | 226 |
| `custom-test/shared/[code].tsx` | Deep link that opens the custom test builder pre-filled. | custom-builder | 8 |
| `index.tsx` | Decides where to send you: signed in goes to your role home, otherwise phone entry. | phone-entry, role-picker | 51 |
| `onboarding.tsx` | Only redirects to phone entry. No intro slides exist; nothing links here. | phone-entry | 6 |
| `otp-verify.tsx` | Enter OTP, resend, change number. Routes by role and first-time status. | [home tab], phone-entry, profile-setup, role-picker | 295 |
| `phone-entry.tsx` | Enter phone number, request OTP, or browse in preview mode. | otp-verify, preview-mode | 318 |
| `preview-mode.tsx` | Developer-only: sign in as a fake student, teacher or admin. Redirects away in production builds. | [home tab], phone-entry, profile-setup | 72 |
| `profile-setup.tsx` | First-time name and course; also reused to edit setup from Settings. | [home tab] | 229 |
| `role-picker.tsx` | Admins choose Admin, Teacher or Student view. | — | 245 |

## Student

Bottom tabs: Home, Practice, Learn, Support, Profile. 38 screens, 10,727 lines.

**Main journeys**

- Take a test: Practice or Home → module hub (hierarchy) → Test pre-start → Test question → Test result → Test review (or Retake, Practise my mistakes).
- Custom test: Practice → Custom builder → (Start now) Test pre-start → Test question → Test result. Saved tests live in Custom tests.
- Learn: Learn → Browse (hierarchy) → Video player or Notes reader. No plan → Subscription plans.
- Revise: Learn or Practice → Flashcard decks → Flashcard study.
- Pay: Subscription plans → Checkout → Payment success → Home, or Payment failed → Checkout.
- Verify: Profile → KYC status ↔ KYC submission.
- Wellness: Support → Wellness category or article, About MMM.
- Progress: Home or Profile → Progress detail → Custom builder (practise weak topics).

| Screen | What the user does | Goes to | Lines |
|---|---|---|---|
| `(student)/(home)/brain-hack-detail.tsx` | Read one brain hack. | brain-hacks | 83 |
| `(student)/(home)/brain-hacks.tsx` | List brain hacks, filter by category, load more. | home/brain-hack-detail | 145 |
| `(student)/(home)/explore.tsx` | Browse all modules and shelves. | brain-hacks, custom-builder, flashcard-study, home/brain-hack-detail, test-pre-start | 195 |
| `(student)/(home)/index.tsx` | Greeting, streak, resume last item, explore shortcuts, daily goal, stats, brain hacks. | [learn tab], [profile tab], [support tab], custom-builder, explore, flashcards, practice/hierarchy, progress-detail, subscription-plans, video-player | 536 |
| `(student)/(learn)/content-reader.tsx` | Read notes, next and previous in the chapter. | subscription-plans | 263 |
| `(student)/(learn)/flashcard-study.tsx` | Flip cards and rate again, hard, good, easy. | subscription-plans | 165 |
| `(student)/(learn)/flashcards.tsx` | List flashcard decks, search, load more. | flashcard-study, subscription-plans | 123 |
| `(student)/(learn)/hierarchy.tsx` | Browse course, subject, chapter to find videos or notes. | content-reader, learn/hierarchy, subscription-plans, video-player | 487 |
| `(student)/(learn)/index.tsx` | Continue watching, video classes and notes entry, recent items. | learn/hierarchy, video-player | 405 |
| `(student)/(learn)/video-player.tsx` | Play video: quality, speed, picture-in-picture, PDFs, progress heartbeat. | subscription-plans | 493 |
| `(student)/(practice)/custom-builder.tsx` | Build a custom test: topics, count, timing, marking, AI suggestions, templates, share code. | course-selection, custom-tests, subscription-plans, test-pre-start | 778 |
| `(student)/(practice)/custom-tests.tsx` | My custom tests and templates: rename, share, delete. | custom-builder, test-pre-start, test-result | 328 |
| `(student)/(practice)/hierarchy.tsx` | Browse tests by subject and chapter for a module. | content-reader, practice/hierarchy, subscription-plans, test-pre-start, video-player | 560 |
| `(student)/(practice)/index.tsx` | Resume test, module hubs, recent attempts, stats. | flashcards, test-history, test-pre-start, test-question, test-result | 404 |
| `(student)/(practice)/test-history.tsx` | All attempts with filters. | [practice tab], test-question, test-result | 255 |
| `(student)/(practice)/test-pre-start.tsx` | Test summary, then start or resume. | test-question | 311 |
| `(student)/(practice)/test-question.tsx` | Take the test: answer, mark, strike, confidence, palette, report, submit. | [practice tab], test-result | 555 |
| `(student)/(practice)/test-result.tsx` | Score, breakdown, insights, rate, share, practise mistakes. | [practice tab], test-pre-start, test-review | 367 |
| `(student)/(practice)/test-review.tsx` | Review answers and explanations, notes, report, bookmark. | — | 467 |
| `(student)/(profile)/bookmarks.tsx` | Search and organise bookmarks into collections. | custom-builder | 179 |
| `(student)/(profile)/checkout.tsx` | Pay with Razorpay and verify. | payment-failed, payment-success | 224 |
| `(student)/(profile)/edit-profile.tsx` | Edit name. | profile-setup | 178 |
| `(student)/(profile)/give-feedback.tsx` | Send feedback with category and attachment. | — | 212 |
| `(student)/(profile)/index.tsx` | Profile hub: plan, stats, verification, links to everything below. | about-mmm, bookmarks, edit-profile, my-reports, profile/give-feedback, profile/manage-devices, progress-detail, role-picker, settings, subscription-plans, test-history | 423 |
| `(student)/(profile)/kyc-status.tsx` | Verification status. | [profile tab], kyc-submission | 173 |
| `(student)/(profile)/kyc-submission.tsx` | Submit ID for verification. | kyc-status | 185 |
| `(student)/(profile)/manage-devices.tsx` | See signed-in devices, sign one out. | — | 198 |
| `(student)/(profile)/my-reports.tsx` | Reports I sent on questions. | — | 96 |
| `(student)/(profile)/notifications.tsx` | Notification inbox and preferences. | — | 100 |
| `(student)/(profile)/payment-failed.tsx` | Retry or pick another plan. | checkout, subscription-plans | 78 |
| `(student)/(profile)/payment-success.tsx` | Payment confirmation. | [home tab] | 131 |
| `(student)/(profile)/progress-detail.tsx` | Trend, mastery, weak areas, coverage, recommendations. | custom-builder | 306 |
| `(student)/(profile)/settings.tsx` | Notifications, sound, edit setup, log out, delete account. | notifications, phone-entry, profile-setup, profile/give-feedback, profile/manage-devices, role-picker | 310 |
| `(student)/(profile)/subscription-plans.tsx` | Compare plans. | checkout | 239 |
| `(student)/(support)/about-mmm.tsx` | About the wellness programme. | — | 138 |
| `(student)/(support)/index.tsx` | Wellness home: today, shelves, about MMM. | about-mmm, wellness-article, wellness-category | 255 |
| `(student)/(support)/wellness-article.tsx` | Read an article. | [support tab] | 237 |
| `(student)/(support)/wellness-category.tsx` | List articles in a category. | wellness-article | 145 |

## Teacher

Bottom tabs: Home, My Content, Upload, Profile. About 18 task screens sit outside the tabs. 25 screens, 6,076 lines.

**Main journeys**

- Create a test: Upload or My content → Create test → CSV upload → CSV import report → Question builder → Question editor → submit for review.
- Create content: Upload or Home → Create content → Content preview → submit or publish.
- Fix rejected content: Home or My content → Rejected content detail → Create content, Create brain hack or Question builder.
- Question bank: Home → Question bank → Completeness → Quick tag → Question editor.
- Brain hack: Upload → Create brain hack → My content → Brain hack detail.
- Flashcards: Upload → Flashcard decks → Flashcard deck.

| Screen | What the user does | Goes to | Lines |
|---|---|---|---|
| `(teacher)/(tabs)/(content)/index.tsx` | My content: search, filter by type and status, create. | content-preview, create-brain-hack, create-content, create-test, rejected-content-detail, teacher/brain-hack-detail | 439 |
| `(teacher)/(tabs)/(home)/course-structure-manager.tsx` | View subjects and chapters. | — | 238 |
| `(teacher)/(tabs)/(home)/index.tsx` | Stats, recent activity, quick actions. | content-preview, corrections, create-brain-hack, create-content, create-test, question-bank, rejected-content-detail, reports | 350 |
| `(teacher)/(tabs)/(profile)/give-feedback.tsx` | Send feedback. | — | 212 |
| `(teacher)/(tabs)/(profile)/index.tsx` | Profile, content count, switch role, log out. | [content tab], phone-entry, profile/give-feedback, profile/manage-devices, role-picker | 239 |
| `(teacher)/(tabs)/(profile)/manage-devices.tsx` | See signed-in devices. | — | 198 |
| `(teacher)/(tabs)/(upload)/index.tsx` | Choose what to create. | create-brain-hack, create-content, create-test, flashcard-decks | 113 |
| `(teacher)/brain-hack-detail.tsx` | Edit, submit, publish or delete a brain hack. | create-brain-hack | 154 |
| `(teacher)/completeness.tsx` | Find untagged or incomplete questions. | quick-tag | 106 |
| `(teacher)/content-preview.tsx` | Preview, edit, delete, submit for review or publish. | preview-run, question-builder, question-editor | 534 |
| `(teacher)/corrections.tsx` | See correction requests. | — | 75 |
| `(teacher)/create-brain-hack.tsx` | Write a brain hack. | [content tab] | 117 |
| `(teacher)/create-content.tsx` | Create video or PDF notes: upload, choose location, save draft. | content-preview, course-structure-manager | 477 |
| `(teacher)/create-test.tsx` | Create a test: name, type, timing, location. | content-preview, course-structure-manager, csv-upload, question-builder | 385 |
| `(teacher)/csv-import-report.tsx` | Check rows, commit the import. | question-builder | 213 |
| `(teacher)/csv-upload.tsx` | Download template, upload CSV and images. | csv-import-report | 231 |
| `(teacher)/flashcard-deck.tsx` | Edit deck and cards, submit or publish. | — | 394 |
| `(teacher)/flashcard-decks.tsx` | My flashcard decks. | flashcard-deck | 94 |
| `(teacher)/preview-run.tsx` | Take the test as a student would. | — | 189 |
| `(teacher)/question-bank.tsx` | Search, filter, select and bulk edit questions. | completeness, question-editor | 301 |
| `(teacher)/question-builder.tsx` | List questions, add, delete, submit test for review. | [content tab], csv-upload, question-editor | 215 |
| `(teacher)/question-editor.tsx` | Write question, options, media, tags; autosave; submit correction. | — | 418 |
| `(teacher)/quick-tag.tsx` | Tag many questions fast. | question-editor | 188 |
| `(teacher)/rejected-content-detail.tsx` | See why content was rejected and fix it. | create-brain-hack, create-content, question-builder | 190 |
| `(teacher)/reports.tsx` | Student reports on my questions. | — | 6 |

## Admin

Bottom tabs: Home, Users, Review, Payments, Profile. 28 screens, 6,775 lines.

**Main journeys**

- Review: Review → Content queue → Content preview detail → approve or reject. Also Corrections queue, Reports queue, KYC queue → KYC review detail.
- Users: Users → User detail → change role, permissions, open KYC.
- Payments: Payments → Payment detail → User detail. Plans → Plan edit.
- Setup: Home → Manage subjects, Course structure, Tags and topics, Wellness, Platform settings, Custom tests, Analytics.

| Screen | What the user does | Goes to | Lines |
|---|---|---|---|
| `(admin)/(home)/analytics-overview.tsx` | Platform analytics by date range. | — | 286 |
| `(admin)/(home)/course-structure.tsx` | Browse content by course. | — | 401 |
| `(admin)/(home)/custom-test-admin.tsx` | Custom test settings, presets, collections, pool health. | — | 255 |
| `(admin)/(home)/index.tsx` | Platform summary and shortcuts. | analytics-overview, course-structure, custom-test-admin, manage-subjects, platform-settings, taxonomy, wellness | 230 |
| `(admin)/(home)/manage-subjects.tsx` | Add subjects and chapters. | — | 351 |
| `(admin)/(home)/platform-settings.tsx` | Turn verification on or off. | — | 173 |
| `(admin)/(home)/taxonomy.tsx` | Create, merge and browse tags and topics. | — | 309 |
| `(admin)/(home)/wellness.tsx` | Create, edit, delete wellness articles. | — | 179 |
| `(admin)/(payments)/index.tsx` | Payments, filter, open detail. | payment-detail, subscription-plan-list | 248 |
| `(admin)/(payments)/payment-detail.tsx` | One payment, open the user. | user-detail | 238 |
| `(admin)/(payments)/payments-list.tsx` | Payments list (overlaps with the one above). | payment-detail | 228 |
| `(admin)/(payments)/subscription-plan-edit.tsx` | Name, price, days, benefits. | subscription-plan-list | 301 |
| `(admin)/(payments)/subscription-plan-list.tsx` | Plans: activate or deactivate. | subscription-plan-edit | 178 |
| `(admin)/(profile)/give-feedback.tsx` | Send feedback. | — | 212 |
| `(admin)/(profile)/index.tsx` | Profile, edit name, switch role, log out. | phone-entry, profile/give-feedback, profile/manage-devices, role-picker | 200 |
| `(admin)/(profile)/manage-devices.tsx` | See signed-in devices. | — | 198 |
| `(admin)/(review)/content-preview-detail.tsx` | Inspect one item before deciding. | — | 336 |
| `(admin)/(review)/content-queue.tsx` | Videos, notes, decks, brain hacks: approve or reject with reason. | — | 249 |
| `(admin)/(review)/corrections-queue.tsx` | Approve or reject corrections. | — | 162 |
| `(admin)/(review)/index.tsx` | Pending counts and quick approve or reject. | content-queue, corrections-queue, kyc-review-detail, moderation-tests, moderation-videos-docs, reports-queue | 337 |
| `(admin)/(review)/kyc-queue.tsx` | Pending verifications. | kyc-review-detail | 223 |
| `(admin)/(review)/kyc-review-detail.tsx` | Zoom ID, approve or reject. | kyc-queue | 280 |
| `(admin)/(review)/moderation-tests.tsx` | Moderate tests. | content-preview-detail | 205 |
| `(admin)/(review)/moderation-videos-docs.tsx` | Moderate videos and documents. | content-preview-detail | 209 |
| `(admin)/(review)/reports-queue.tsx` | Handle student reports. | — | 6 |
| `(admin)/(users)/index.tsx` | Users, filter by role. | user-detail | 226 |
| `(admin)/(users)/user-detail.tsx` | Change role, teacher permissions, open verification. | kyc-review-detail | 335 |
| `(admin)/(users)/users-list.tsx` | Users list (overlaps with the one above). | user-detail | 220 |

## What the code shows (input for the architecture decisions)

**Size**
- 100 screens, 25,028 lines. Student 38 screens (10.7k lines), Admin 28 (6.8k), Teacher 25 (6.1k), entry and shared 9 (1.5k).
- Biggest screens: custom-builder 778 lines, practice hierarchy 560, test-question 555, student home 536, teacher content-preview 534. Each mixes data loading, state, layout and styling in one file.

**Copy-paste between roles**
- `manage-devices` exists 3 times (student, teacher, admin): 197 lines each, 12 lines differ.
- `give-feedback` exists 3 times: 211 lines each, 4 lines differ.
- The three profile screens (student, teacher, admin) repeat the same name edit, role switch and log out.
- Student `learn/hierarchy` and `practice/hierarchy` are 486 and 559 lines of the same course, subject, chapter browser.
- Admin has both `users/index` and `users/users-list`, and both `payments/index` and `payments/payments-list`, doing nearly the same job.

**Repeated small things (each is defined again in many files)**
- A local `shadow()` helper: 46 files.
- A local fade-in "Stagger" animation: 12 files.
- A local modal scrim style: 15 files.
- The same load, loading-flag, error-flag, retry pattern written by hand: about 40 to 54 screens (no shared data hook).
- A paywall jump to subscription plans: 13 places.
- Helper components declared inside screen files: 81.
- Inline style objects: 887. 69 screen files have their own `StyleSheet`.

**Shared components**
- 17 shared components exist in `src/components`. Most used: SkeletonBlock (72 screens), TextButton (66), EmptyState (58), PrimaryButton (52), useToast (46), SecondaryButton (43).
- Missing common pieces: screen shell (header, safe area, scroll, loading and error states), list row, section header, stat tile, modal and confirm dialog, segmented control.
- 8 screens use no shared component at all.

**Structure**
- Teacher: about 18 task screens (question editor, CSV upload and so on) sit in one flat folder beside the tabs.
- Domain logic is split between `src/` folders (attempt, custom, teacher, rich, wellness and others), which is good, but screens still hold a lot of it.
- `onboarding` is a redirect only. `preview-mode` is developer-only.

**Quality**
- 30 `any` casts, 14 `console.error` calls in screens, 18 test files (none cover screens).
- Types for API data live next to the API files; there is no shared screen-state type.
