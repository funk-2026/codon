import { apiFetch, qs } from './client';
import { UserProfile } from './profile';
import { Test, AuthoredQuestion } from './tests';
import type { MediaMap } from '@/src/rich/ast';
import { ContentItem } from './content';
import { SubscriptionPlan } from './profile';
import { KYCRecord } from './kyc';
import { WellnessContent } from './wellness';
import { Subject, Chapter } from './courses';

export type AdminDashboardSummary = {
  total_users: number;
  active_subscriptions: number;
  pending_kyc: number;
  pending_test_reviews: number;
  pending_content_reviews: number;
};

/** GET /api/v1/admin/dashboard/summary */
export function getAdminDashboardSummary(): Promise<AdminDashboardSummary> {
  return apiFetch<AdminDashboardSummary>('/admin/dashboard/summary', { method: 'GET' });
}

/** GET /api/v1/admin/analytics */
export function adminAnalyticsOverview(range: string = '7D'): Promise<any> {
  return apiFetch<any>(`/admin/analytics?range=${encodeURIComponent(range)}`, { method: 'GET' });
}

/** GET /api/v1/admin/users */
export function listUsers(): Promise<{ users: UserProfile[] }> {
  return apiFetch<{ users: UserProfile[] }>('/admin/users', { method: 'GET' });
}

/** One page of users, filtered on the server (role, name or phone). */
export function listUsersPage(p: { role?: string; search?: string; cursor?: string | null; limit?: number } = {}) {
  return apiFetch<{ users: UserProfile[]; next_cursor: string | null }>(`/admin/users${qs({ ...p, cursor: p.cursor ?? undefined })}`, { method: 'GET' }).then((r) => ({ users: r.users ?? [], next_cursor: r.next_cursor ?? null }));
}

/** GET /api/v1/admin/users/:id — backend returns the raw user object, not wrapped */
export function getUser(id: string): Promise<UserProfile> {
  return apiFetch<UserProfile>(`/admin/users/${id}`, { method: 'GET' });
}

/** GET /api/v1/admin/users/:id/subscription — the user's active subscription, or null. */
export function getUserSubscription(id: string): Promise<{ subscription: import('./profile').Subscription | null }> {
  return apiFetch(`/admin/users/${id}/subscription`, { method: 'GET' });
}

export type AdminUserSession = { id: string; device_id: string; device_info?: string | null; created_at: string; last_used_at: string; expires_at: string };

/** GET /api/v1/admin/users/:id/sessions — active device sessions (read-only; there is no admin sign-out). */
export function getUserSessions(id: string): Promise<{ sessions: AdminUserSession[]; active_count: number }> {
  return apiFetch(`/admin/users/${id}/sessions`, { method: 'GET' });
}

/** PATCH /api/v1/admin/users/:id/role */
export function updateUserRole(id: string, role: string): Promise<{ message: string }> {
  return apiFetch<{ message: string }>(`/admin/users/${id}/role`, {
    method: 'PATCH',
    body: JSON.stringify({ role }),
  });
}

/** PATCH /api/v1/admin/users/:id/teacher-permissions */
export function updateTeacherPermissions(id: string, canManageAllContent: boolean): Promise<{ message: string }> {
  return apiFetch<{ message: string }>(`/admin/users/${id}/teacher-permissions`, {
    method: 'PATCH',
    body: JSON.stringify({ can_manage_all_content: canManageAllContent }),
  });
}

/** GET /api/v1/admin/payments */
export function listPayments(): Promise<any> {
  return apiFetch<any>('/admin/payments', { method: 'GET' });
}

export type AdminPaymentRow = {
  id: string;
  user_id: string;
  user?: { name?: string | null; phone_number?: string | null };
  subscription?: { plan?: { name: string } };
  razorpay_order_id?: string;
  amount_paise: number;
  status: 'created' | 'captured' | 'failed' | 'refunded';
  created_at: string;
};

/** One page of payments, filtered on the server (status, user, name, phone or order id). */
export function listPaymentsPage(p: { status?: string; user_id?: string; search?: string; cursor?: string | null; limit?: number } = {}) {
  return apiFetch<{ payments: AdminPaymentRow[]; next_cursor: string | null }>(`/admin/payments${qs({ ...p, cursor: p.cursor ?? undefined })}`, { method: 'GET' }).then((r) => ({ payments: r.payments ?? [], next_cursor: r.next_cursor ?? null }));
}

/** Totals over every payment, not just the loaded page. */
export function getPaymentsSummary() {
  return apiFetch<{ captured_paise: number; captured_count: number; failed_count: number; refunded_count: number }>('/admin/payments/summary', { method: 'GET' });
}

/** GET /api/v1/admin/payments/:id */
export function getPayment(id: string): Promise<any> {
  return apiFetch<any>(`/admin/payments/${id}`, { method: 'GET' });
}

/** POST /api/v1/admin/subscription-plans */
export function createSubscriptionPlan(data: Partial<SubscriptionPlan>): Promise<SubscriptionPlan> {
  return apiFetch<SubscriptionPlan>('/admin/subscription-plans', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/** PATCH /api/v1/admin/subscription-plans/:id */
export function updateSubscriptionPlan(id: string, data: Partial<SubscriptionPlan>): Promise<SubscriptionPlan> {
  return apiFetch<SubscriptionPlan>(`/admin/subscription-plans/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

/** GET /api/v1/admin/subscription-plans */
export function adminListSubscriptionPlans(): Promise<{ plans: SubscriptionPlan[] }> {
  return apiFetch<{ plans: SubscriptionPlan[] }>('/admin/subscription-plans', { method: 'GET' });
}

/** DELETE /api/v1/admin/subscription-plans/:id */
export function deleteSubscriptionPlan(id: string): Promise<{ message: string }> {
  return apiFetch<{ message: string }>(`/admin/subscription-plans/${id}`, { method: 'DELETE' });
}

/** GET /api/v1/admin/tests */
export function adminListTests(status?: string, p: { cursor?: string | null; limit?: number; chapter_id?: string; creator_id?: string } = {}): Promise<{ tests: Test[]; next_cursor?: string | null }> {
  return apiFetch<{ tests: Test[]; next_cursor?: string | null }>(`/admin/tests${qs({ status, ...p, cursor: p.cursor ?? undefined })}`, { method: 'GET' });
}

/** GET /api/v1/admin/tests/:id */
export function adminGetTest(id: string): Promise<{ test: Test; questions: AuthoredQuestion[]; media: MediaMap }> {
  return apiFetch<{ test: Test; questions: AuthoredQuestion[]; media: MediaMap }>(`/admin/tests/${id}`, { method: 'GET' });
}

/** POST /api/v1/admin/tests/:id/approve */
export function adminApproveTest(id: string): Promise<{ message: string }> {
  return apiFetch<{ message: string }>(`/admin/tests/${id}/approve`, { method: 'POST' });
}

/** POST /api/v1/admin/tests/:id/reject */
export function adminRejectTest(id: string, reason: string): Promise<{ message: string }> {
  return apiFetch<{ message: string }>(`/admin/tests/${id}/reject`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

/** GET /api/v1/admin/content */
export function adminListContent(status?: string, p: { cursor?: string | null; limit?: number; chapter_id?: string; uploader_id?: string } = {}): Promise<{ content: ContentItem[]; next_cursor?: string | null }> {
  return apiFetch<{ content: ContentItem[]; next_cursor?: string | null }>(`/admin/content${qs({ status, ...p, cursor: p.cursor ?? undefined })}`, { method: 'GET' });
}

/** GET /api/v1/admin/content/:id */
export function adminGetContent(id: string): Promise<{ content: ContentItem; url?: string }> {
  return apiFetch<{ content: ContentItem; url?: string }>(`/admin/content/${id}`, { method: 'GET' });
}

/** POST /api/v1/admin/content/:id/approve */
export function adminApproveContent(id: string): Promise<{ message: string }> {
  return apiFetch<{ message: string }>(`/admin/content/${id}/approve`, { method: 'POST' });
}

/** POST /api/v1/admin/content/:id/reject */
export function adminRejectContent(id: string, reason: string): Promise<{ message: string }> {
  return apiFetch<{ message: string }>(`/admin/content/${id}/reject`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

/** GET /api/v1/admin/kyc */
export function adminListKYC(status?: string): Promise<{ records: KYCRecord[] }> {
  const qs = status ? `?status=${status}` : '';
  return apiFetch<{ records: KYCRecord[] }>(`/admin/kyc${qs}`, { method: 'GET' });
}

/** GET /api/v1/admin/kyc/:id (Requires BE implementation) */
export function adminGetKYC(id: string): Promise<{ record: KYCRecord }> {
  return apiFetch<{ record: KYCRecord }>(`/admin/kyc/${id}`, { method: 'GET' });
}

/** POST /api/v1/admin/kyc/:id/approve */
export function adminApproveKYC(id: string): Promise<{ message: string }> {
  return apiFetch<{ message: string }>(`/admin/kyc/${id}/approve`, { method: 'POST' });
}

/** POST /api/v1/admin/kyc/:id/reject */
export function adminRejectKYC(id: string, reason: string): Promise<{ message: string }> {
  return apiFetch<{ message: string }>(`/admin/kyc/${id}/reject`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

/** POST /api/v1/admin/wellness-content */
export function createWellnessContent(data: Partial<WellnessContent>): Promise<WellnessContent> {
  return apiFetch<WellnessContent>('/admin/wellness-content', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/** PATCH /api/v1/admin/settings/kyc-required */
export function setKYCRequired(required: boolean): Promise<{ message: string }> {
  return apiFetch<{ message: string }>('/admin/settings/kyc-required', {
    method: 'PATCH',
    body: JSON.stringify({ required }),
  });
}

/** GET /api/v1/platform-settings/kyc-required */
export function getPlatformSettingsKYC(): Promise<{ required: boolean }> {
  return apiFetch<{ required: boolean }>('/platform-settings/kyc-required', { method: 'GET' });
}

/** POST /api/v1/admin/courses/:course_id/subjects */
export function createSubject(courseId: string, name: string, description: string): Promise<Subject> {
  return apiFetch<Subject>(`/admin/courses/${courseId}/subjects`, {
    method: 'POST',
    body: JSON.stringify({ name, description }),
  });
}

/** PATCH /api/v1/admin/subjects/:id */
export function updateSubject(
  id: string,
  fields: Partial<Pick<Subject, 'name' | 'description' | 'order_index'>>
): Promise<Subject> {
  return apiFetch<Subject>(`/admin/subjects/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(fields),
  });
}

/** POST /api/v1/admin/subjects/:subject_id/chapters */
export function createChapter(subjectId: string, name: string, description: string): Promise<Chapter> {
  return apiFetch<Chapter>(`/admin/subjects/${subjectId}/chapters`, {
    method: 'POST',
    body: JSON.stringify({ name, description }),
  });
}

/** PATCH /api/v1/admin/chapters/:id */
export function updateChapter(
  id: string,
  fields: Partial<Pick<Chapter, 'name' | 'description' | 'order_index'>>
): Promise<Chapter> {
  return apiFetch<Chapter>(`/admin/chapters/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(fields),
  });
}
