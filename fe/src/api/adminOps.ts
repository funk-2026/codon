import { apiFetch, qs } from './client';
import type { Subscription } from './profile';

/** Admin actions beyond lists and approvals. See `be/internal/handlers/admin_ops.go`. */

export const suspendUser = (id: string, reason: string) =>
  apiFetch<{ message: string }>(`/admin/users/${id}/suspend`, { method: 'POST', body: JSON.stringify({ reason }) });

export const reactivateUser = (id: string) => apiFetch<{ message: string }>(`/admin/users/${id}/reactivate`, { method: 'POST' });

export const revokeUserSession = (userId: string, sessionId: string) =>
  apiFetch<{ message: string }>(`/admin/users/${userId}/sessions/${sessionId}`, { method: 'DELETE' });

export const revokeAllUserSessions = (userId: string) => apiFetch<{ message: string }>(`/admin/users/${userId}/sessions`, { method: 'DELETE' });

export const grantAccess = (userId: string, p: { plan_id: string; days?: number; reason: string }) =>
  apiFetch<{ subscription: Subscription | null }>(`/admin/users/${userId}/subscription/grant`, { method: 'POST', body: JSON.stringify(p) });

export type UserActivity = {
  last_login_at?: string | null;
  last_attempt_at?: string | null;
  tests_started: number;
  tests_submitted: number;
  avg_score_pct?: number | null;
};
export const getUserActivity = (userId: string) => apiFetch<UserActivity>(`/admin/users/${userId}/activity`);

/** Erases a user's personal data (privacy request). Existing endpoint. */
export const purgePersonalData = (userId: string) => apiFetch<unknown>(`/admin/users/${userId}/purge-personal-data`, { method: 'POST' });

export type TakedownKind = 'tests' | 'content' | 'brain-hacks' | 'flashcard-decks';
export const takedown = (kind: TakedownKind, id: string, reason: string) =>
  apiFetch<{ message: string }>(`/admin/takedown/${kind}/${id}`, { method: 'POST', body: JSON.stringify({ reason }) });

export type AuditEntry = {
  id: string;
  actor_id: string;
  actor_name?: string | null;
  actor_phone?: string | null;
  action: string;
  target?: string;
  before?: unknown;
  after?: unknown;
  created_at: string;
};
export const listAuditLog = (p: { action?: string; actor_id?: string; target?: string; cursor?: string | null; limit?: number } = {}) =>
  apiFetch<{ items: AuditEntry[]; next_cursor: string | null }>(`/admin/audit-log${qs({ ...p, cursor: p.cursor ?? undefined })}`);

export type FeedbackStatus = 'new' | 'in_progress' | 'resolved';
export type FeedbackEntry = {
  id: string;
  user_id: string;
  user_name?: string | null;
  user_phone?: string;
  user_role?: string;
  category: string;
  message: string;
  app_version?: string | null;
  device_os?: string | null;
  status: FeedbackStatus;
  admin_note?: string | null;
  created_at: string;
};
export const listFeedback = (p: { status?: FeedbackStatus; category?: string; cursor?: string | null; limit?: number } = {}) =>
  apiFetch<{ items: FeedbackEntry[]; next_cursor: string | null }>(`/admin/feedback${qs({ ...p, cursor: p.cursor ?? undefined })}`);
export const updateFeedback = (id: string, status: FeedbackStatus, note?: string) =>
  apiFetch<{ message: string }>(`/admin/feedback/${id}`, { method: 'PATCH', body: JSON.stringify({ status, note: note || null }) });

/** Home banner carousel. Existing endpoints, previously unused by the app. */
export type AdminHomeUpdate = {
  id: string;
  title: string;
  body?: string;
  cta_label?: string;
  cta_route?: string;
  order_index: number;
  is_active: boolean;
  starts_at?: string | null;
  ends_at?: string | null;
};
export type HomeUpdateInput = Partial<{ title: string; body: string; cta_label: string; cta_route: string; order_index: number; is_active: boolean; starts_at: string | null; ends_at: string | null }>;
export const adminListHomeUpdates = () => apiFetch<{ updates: AdminHomeUpdate[] }>('/admin/home-updates');
export const adminCreateHomeUpdate = (b: HomeUpdateInput) => apiFetch<AdminHomeUpdate>('/admin/home-updates', { method: 'POST', body: JSON.stringify(b) });
export const adminUpdateHomeUpdate = (id: string, b: HomeUpdateInput) => apiFetch<AdminHomeUpdate>(`/admin/home-updates/${id}`, { method: 'PATCH', body: JSON.stringify(b) });
export const adminDeleteHomeUpdate = (id: string) => apiFetch<{ message: string }>(`/admin/home-updates/${id}`, { method: 'DELETE' });

/** Hand an open question report to a teacher (or admin). Existing endpoint. */
export const reassignReport = (id: string, assigneeId: string) =>
  apiFetch<unknown>(`/admin/reports/${id}/reassign`, { method: 'POST', body: JSON.stringify({ assignee_id: assigneeId }) });

// ── Courses, teachers, announcements, exports ───────────────────────────────

export const createCourse = (name: string) => apiFetch<{ id: string; name: string }>('/admin/courses', { method: 'POST', body: JSON.stringify({ name }) });
export const deleteSubject = (id: string) => apiFetch<{ message: string }>(`/admin/subjects/${id}`, { method: 'DELETE' });
export const deleteChapter = (id: string) => apiFetch<{ message: string }>(`/admin/chapters/${id}`, { method: 'DELETE' });

/** Create a teacher before they have signed in. A 409 `user_exists` carries the existing user's id in `details.user_id`. */
export const inviteTeacher = (p: { phone_number: string; name?: string }) =>
  apiFetch<{ id: string; phone_number: string }>('/admin/users/invite', { method: 'POST', body: JSON.stringify(p) });

export type Audience = 'students' | 'teachers' | 'all';
export const announcementAudience = (audience: Audience) => apiFetch<{ count: number }>(`/admin/announcements/audience${qs({ audience })}`);
export const sendAnnouncement = (p: { audience: Audience; title: string; body?: string; route?: string }) =>
  apiFetch<{ sent: number }>('/admin/announcements', { method: 'POST', body: JSON.stringify(p) });
