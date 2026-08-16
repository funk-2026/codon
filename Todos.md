# FE 

## P0
- ~~Need to store the accessToken got from the backend in secure storage on FE~~ ✅
- ~~Color func from themeProvider is used directly in reanimated, in many places - need to fix that.~~ ✅
- ~~Need to fix the transition of the screens when navigating~~ ✅ — no Stack anywhere set an `animation` option, so every navigator fell back to react-native-screens' default (an unanimated cut on web, inconsistent on Android). Added a shared `stackAnimation` constant (`src/components/ThemedStack.tsx`) — `slide_from_right` on native, `fade` on web — applied via `useStackScreenOptions()` everywhere, plus the root stack in `app/_layout.tsx`. Native (iOS/Android) transition feel not visually verified in this environment — no device/simulator available, only the web preview.
- ~~Navigation Fix~~ ✅
- ~~Admin course structure (includes courses, subjects, topics)~~ ✅ — revised flow: Admin creates Subjects only (Manage Subjects screen on Admin home). Teacher creates Chapters/Topics under an existing Subject and uploads content under them (Course Structure Manager on Teacher home). No approval step for structure, only content/tests keep their existing review workflow.
- ~~UI for creatint a subjects for each of the course, topics for each of the subject. in admin panel.~~ ✅ — Subjects UI is in the Admin panel; Topics (Chapters) UI ended up on the Teacher side per the flow above, not the admin panel.
- ~~Location picker (course/subject/topic) when creating Test/Content didn't actually save the picked topic — it only showed a label, chapter_id was never sent to the backend.~~ ✅ fixed
- ~~Navigation and dashboard fix for Admin.~~ ✅ — dashboard was reading a `pending_reviews` field that doesn't exist on the backend response (it actually returns `pending_test_reviews` + `pending_content_reviews` separately), so the "Pending Reviews" tile, the "items need review" banner, and the Test Approvals badge were always stuck at 0. Fixed field mapping in `src/api/admin.ts`/`(admin)/(home)/index.tsx`, and gave the Content Approvals card its own badge (it had none before).
- ~~When clicking on user in Admin Panel, getting a blank page~~ ✅ — `getUser` in `src/api/admin.ts` now expects the raw user object (matching what the backend actually returns) instead of `{ user: ... }`.
- ~~User Detail screen: type error — `StatusBadge status` gets passed `'error'` for KYC action-needed state, but `BadgeStatus` type doesn't include `'error'`~~ ✅ — backend only ever sends `pending`/`approved`/`rejected`, which are already valid `BadgeStatus` values directly. Also fixed the same wrong status names (`verified`/`action_needed`) in the Users list KYC dot color.
- ~~Payments always show "Unknown Plan"~~ ✅ — `payment-detail.tsx`/`(payments)/index.tsx` read `plan.title`, backend field is `plan.name`.
- ~~Admin "Test/Content Approvals" location breadcrumb showed nothing~~ ✅ — same `.title` vs `.name` bug in `moderation-tests.tsx`/`moderation-videos-docs.tsx` (this was the pre-existing tsc error). `tsc --noEmit` is now fully clean, 0 errors.
- ~~KYC review detail screen was fully mock data, Approve/Reject didn't call the real endpoints~~ ✅ — now fetches the real record (across pending/approved/rejected, since there's no get-by-id endpoint) and calls `adminApproveKYC`/`adminRejectKYC` for real.
- ~~Broken KYC deep-link from User Detail (no id passed)~~ ✅ — now looks up the student's KYC record and navigates with a real id.
- ~~Admin (and Teacher) Give Feedback screens faked success and discarded what was typed~~ ✅ — now call the real `submitFeedback()` API (Student's version was already correct; Admin and Teacher were not).
- User Detail screen: "Can manage all content" switch and the student's subscription/device info are hardcoded placeholders, not wired to real data. Backend endpoint for the switch (`PATCH /admin/users/:id/teacher-permissions`) already exists but has no frontend wrapper yet.
- Content/Test review screen (`content-preview-detail.tsx`) shows fake sample content while Approve/Reject act on the real item — backend has no `GET /admin/{tests,content}/:id` route to fetch the real detail, so this is backend-blocked.
- 


## P2
- ~~Errors can be shown in form of Toasts~~ ✅ — already wired via `ToastProvider`/`useToast`, used across ~20 screens.



# BE 

## P0
- ~~Need to figure out how to call the APis from the backend that is running on my computer~~ ✅
- ~~Need to check the access of the creating the subjects, etc..~~ ✅

- Prod sanity pending - Need atleast a week to do that 
    - Need to Do OTP delivering
    - Payments
    - Redis working
    - Subscription based access to users 
    - S3 working or not, playing videos from S3 ??
    - Uploading content by teachers working or not ??

## P1
- Need to check what happens to sessions when the app is uninstalled.


## P2
- Need to move to an ORM instead of SQL queries.

