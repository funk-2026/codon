# Admin Users: what the screen needs from the backend

Status: **a list for you to decide on; nothing here has been built in `be/`.** The user detail screen was rebuilt on 2026-11-14 as a support view using only what exists today.

## What the screen shows now (frontend only)

- Who they are, and their role.
- **Student:** subscription (plan, status, end date, auto-renew) from `GET /admin/users/:id/subscription`, their payments (filtered from the admin payments list, opening payment detail), course, and identity verification.
- **Teacher:** how many tests and lessons they have made, how many are live or waiting, and the "can manage all content" switch.
- **Everyone:** active devices from `GET /admin/users/:id/sessions` (read-only).
- **Advanced:** change role, with a description of each role, a stronger warning for admin, and no changing your own role.

## What an admin would reasonably want, and isn't possible yet

| Need | Why | Backend work |
|---|---|---|
| Sign a user out of a device | A lost phone or a shared account. The session list is shown, but only the user can revoke their own (`DELETE /auth/sessions/:id`). | An admin revoke endpoint, e.g. `DELETE /admin/users/:id/sessions/:sessionId` and "sign out everywhere". |
| Suspend and reactivate an account | Abuse, chargebacks, a leaked account. | A status on the user, enforced at sign-in and on tokens. |
| Give or extend access | The most common support request ("my payment failed but I paid", goodwill extension). | An endpoint to create or extend a subscription without a payment, with a reason recorded. |
| Activity for a user | Last active, tests taken, average score: "are they actually using it?" | A per-user activity summary endpoint. |
| Content by teacher | Counting a teacher's work is done in the app from two large lists. | A filter on the admin tests and content lists, `?creator_id=`. |
| Audit trail | Who changed this role or gave this access, and when. | An audit log written by the role, permission and access endpoints. |
| Payments for a user | Done in the app by filtering every payment. | A filter on the admin payments list, `?user_id=`. |

## Suggested order

1. **Admin session revoke** and **grant or extend access**: both are daily support work.
2. **Suspend**.
3. **Audit trail** (do it together with 1 and 2, so the new actions are recorded from the start).
4. The two list filters and the activity summary, to take work off the phone.
