# Codon — Todos

## FE

### Blocked on BE
- **P0** — User Detail: subscription plan and active-device count aren't shown (real course + last login are; see BE-1 / BE-2 below).
- **P0** — Content/Test review screen: no full question list, video playback, or document body preview — approve/reject work on the real item, but reviewers only see summary metadata (see BE-3 below).

### Open
- None right now — everything else is done or waiting on the backend items above.

### Done
- Store the access token from the backend in secure storage.
- Fix `ThemeProvider`'s color func being used directly in reanimated in many places.
- Fix screen transitions — no `Stack` set an `animation` option anywhere; added a shared `stackAnimation` constant (`src/components/ThemedStack.tsx`, `slide_from_right` native / `fade` web) via `useStackScreenOptions()`. *Native feel not visually verified — no device/simulator in this environment, only web.*
- Navigation fix.
- Course structure rework: Admin creates **Subjects** only (`(admin)/(home)/manage-subjects.tsx`); Teacher creates **Chapters/Topics** under a Subject and uploads content under them (`(teacher)/(home)/course-structure-manager.tsx`). No approval step on structure — only content/tests keep the existing review workflow.
- Location picker (course → subject → topic) for Test/Content creation now actually saves the picked chapter — it used to only show a label, `chapter_id` was never sent to the backend.
- Admin dashboard summary — was reading a `pending_reviews` field the backend doesn't send (real fields are `pending_test_reviews` + `pending_content_reviews`); Pending Reviews tile, review banner, and Test/Content Approval badges were all stuck at 0.
- Admin → User Detail blank page — `getUser()` expected a `{ user }` wrapper the backend doesn't send.
- KYC status values — code checked for `verified`/`action_needed`, backend only ever sends `pending`/`approved`/`rejected` (User Detail badge, Users list dot color). Fixing this also cleared a pre-existing `tsc` error.
- Payments always showing "Unknown Plan" — read `plan.title`, backend field is `plan.name` (`payment-detail.tsx`, `(payments)/index.tsx`).
- Same `.title`/`.name` mismatch in `moderation-tests.tsx` / `moderation-videos-docs.tsx` breadcrumbs — this was the other pre-existing `tsc` error. `tsc --noEmit` is now fully clean.
- KYC review detail screen was 100% mock data with fake Approve/Reject — now fetches the real record and calls `adminApproveKYC`/`adminRejectKYC`.
- Broken KYC deep-link from User Detail (navigated with no id) — now looks up the student's real record first.
- Admin + Teacher "Give Feedback" screens faked success and discarded input — now call the real `submitFeedback()` API (Student's version already did this correctly).
- User Detail "Can manage all content" switch was a hardcoded placeholder — added `updateTeacherPermissions()`, switch now reads/persists the real value.
- User Detail Course + "Last login" — both were hardcoded; `GetUser` already returns `selected_course` and `last_login_at`, just wasn't being used.
- Content/Test review screen — title, breadcrumb, teacher, submitted date, module type, question count, duration, and marking are now the real values passed from the review-queue list (which already had them). Removed the fake "queue position" counter and replaced the dead fake video-player/question-list with an honest "not available yet" notice.
- Toasts for errors — already fully wired via `ToastProvider`/`useToast` across ~20 screens, nothing to do.

---

## BE

### New asks from FE
_Found while wiring the Admin panel to real data — everything else there is done, these are the last gaps._

- **BE-1** — `GET /admin/users/:id/subscription`: a student's active subscription (plan name, status, start/end date). `GET /me/subscription` exists but is self-service only.
- **BE-2** — `GET /admin/users/:id/sessions`: a user's active device sessions, or at least a count. `GET /auth/sessions` exists but is self-service only.
- **BE-3** — `GET /admin/tests/:id` and `GET /admin/content/:id`: full detail for a single pending-review item (questions with options/answers; document body / video URL), admin-role accessible. The frontend already has client stubs for these (`adminGetTest`/`adminGetContent` in `src/api/admin.ts`, marked "Requires BE implementation") — just needs the routes registered in `main.go`. Note: `GET /tests/:id/questions` and `GET /content/:id` already exist but are gated to `RoleStudent` only — admins get a 403 today.

### Open

**P0**
- Prod sanity pass pending — need at least a week:
  - OTP delivery
  - Payments
  - Redis
  - Subscription-gated access for users
  - S3 / video playback from S3
  - Teacher content upload — working end to end?

**P1**
- Check what happens to sessions when the app is uninstalled.

**P2**
- Move to an ORM instead of raw SQL queries.

### Done
- Figured out how to call the APIs from the backend running locally.
- Checked access control on subject/chapter creation.
