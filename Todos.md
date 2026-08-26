# Codon — Todos

## FE

### P0
#### UI
- Fallback for APi status errors, we should not show cached data or something, we need to indicated some error state after failed api call.
- Shimmers for the entire app. that indicate loading state.
- In settings the UI for notitifications, sound effects is broken, 
- when moving from one screen to another forward, like clicking on settings tab is smooth, but when moving back the old screen is getting completely removed immediately, need to check that
- The initial animation that comes right when we open the app, feels like the app got stuck, there is no aniiation, need to think of an animation there or remove it completely 
- Remove dummy data from Admin analytics page. 
- The approval Sections in Admin like the Test approvals, conteent approvals, KYC review and all can be moved to a seperate tab (Like remove one tablike the review or something and keep a generic approval section that contains all the approvals) instead of the home page.. -> This is recommmended because we can group all of them and also another workaround can be fix the navigations there.. they are not properly working.. -> Can refer to the main branch for reference (for grouping tabs approach)
- Back navigation is breaking at many places for admin please fix.
- Also admin cant go beyond adding the subjects, there should be UI supporting for him to see all the content present from the course structure. Reviews section is completely different.
- After signing in to the Dashboard, if user tries to go back, then he is getting redirected to the login page.. that should not happen.. authenticated user should not be able to see the signin page

#### Functionality 
- Test series preview is mocked currently, implement that from the backend
- Upload a CSV for teacher is mocked currently, also teacher should be able to add video content .. implement that Upload CSV feature, also the download CSV is not working.. please check
- Razorpay integration from FE is pending.

### P1
- Need to persist user account after loggin out, so that he can login again without otp.

---

## BE


### P0
- Prod sanity pass pending — need at least a week:
  - OTP delivery
  - Payments
  - Redis
  - Subscription-gated access for users
  - S3 / video playback from S3
  - Teacher content upload — working end to end?
- The worker need to download the csv file from S3 and then process and store it in the DB
- Need to change the OTP service. 


### P1
- Check what happens to sessions when the app is uninstalled.
- Need to add coupouns for users 

### P2
- Move to an ORM instead of raw SQL queries.

