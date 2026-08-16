# FE 

## P0
- ~~Need to store the accessToken got from the backend in secure storage on FE~~ ✅
- ~~Color func from themeProvider is used directly in reanimated, in many places - need to fix that.~~ ✅
- Need to fix the transition of the screens when navigating
- ~~Navigation Fix~~ ✅
- ~~Admin course structure (includes courses, subjects, topics)~~ ✅ — revised flow: Admin creates Subjects only (Manage Subjects screen on Admin home). Teacher creates Chapters/Topics under an existing Subject and uploads content under them (Course Structure Manager on Teacher home). No approval step for structure, only content/tests keep their existing review workflow.
- ~~UI for creatint a subjects for each of the course, topics for each of the subject. in admin panel.~~ ✅ — Subjects UI is in the Admin panel; Topics (Chapters) UI ended up on the Teacher side per the flow above, not the admin panel.
- ~~Location picker (course/subject/topic) when creating Test/Content didn't actually save the picked topic — it only showed a label, chapter_id was never sent to the backend.~~ ✅ fixed
- Navigation and dashboard fix for Admin. 
- ~~When clicking on user in Admin Panel, getting a blank page~~ ✅ — `getUser` in `src/api/admin.ts` now expects the raw user object (matching what the backend actually returns) instead of `{ user: ... }`.
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

