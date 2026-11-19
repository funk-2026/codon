import { apiFetch, arr } from './client';

export type UserProfile = {
  id: string;
  phone_number: string;
  name: string | null;
  role: 'student' | 'teacher' | 'admin';
  profile_photo_key: string | null;
  selected_course_id: string | null;
  selected_course?: Course;
  can_manage_all_content: boolean;
  kyc_status: string;
  created_at: string;
  last_login_at?: string;
  exam_date?: string | null;
  /** Indian state or union territory, from a fixed list. */
  state?: string | null;
  photo_media_id?: string | null;
  /** Hide my name on public leaderboards. */
  leaderboard_opt_out?: boolean;
  suspended_at?: string | null;
  suspended_reason?: string | null;
};

export type SubscriptionPlan = {
  id: string;
  name: string;
  course_id: string;
  duration_days: number;
  price_paise: number;
  currency: string;
  benefits: string[];
  is_active: boolean;
};

export type Course = {
  id: string;
  name: string;
  slug: string;
  description?: string;
  is_active: boolean;
};

export type Subscription = {
  id: string;
  user_id: string;
  plan_id: string;
  plan?: SubscriptionPlan;
  course_id: string;
  course?: Course;
  status: string;
  start_date: string;
  end_date: string;
  auto_renew: boolean;
};

export type GetMeResponse = {
  user: UserProfile;
  kyc_required: boolean;
  active_subscription?: Subscription;
  /** Pictures to show, by media id (the profile photo). */
  media?: Record<string, import('@/src/rich/ast').MediaView>;
};

/** GET /api/v1/me */
export function getMe(): Promise<GetMeResponse> {
  return apiFetch<GetMeResponse>('/me', { method: 'GET' });
}

export type UpdateMeRequest = {
  name?: string;
  profile_photo_key?: string;
  selected_course_id?: string;
  /** YYYY-MM-DD; an empty string clears it. */
  exam_date?: string;
  /** One of INDIAN_STATES; an empty string clears it. */
  state?: string;
  /** A ready `profile_photo` media asset of mine; an empty string removes it. */
  photo_media_id?: string;
  leaderboard_opt_out?: boolean;
};

/** PATCH /api/v1/me */
export function updateMe(data: UpdateMeRequest): Promise<UserProfile> {
  return apiFetch<UserProfile>('/me', {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

/** DELETE /api/v1/me */
export function deleteAccount(): Promise<{ message: string }> {
  return apiFetch<{ message: string }>('/me', { method: 'DELETE' });
}

export type ProgressResponse = {
  attempted_count: number;
  avg_score: number;
};

/** GET /api/v1/me/progress */
export function getProgress(): Promise<ProgressResponse> {
  return apiFetch<ProgressResponse>('/me/progress', { method: 'GET' });
}

export type GetAttemptsResponse = {
  attempts: any[];
};

/** GET /api/v1/me/attempts */
export function getAttempts(): Promise<GetAttemptsResponse> {
  return apiFetch<GetAttemptsResponse>('/me/attempts', { method: 'GET' }).then((r) => ({ attempts: arr(r.attempts) }));
}

export type ProgressSubject = {
  name: string;
  accuracy: number;
};

export type ProgressBreakdownResponse = {
  trend: number[];
  subjects: ProgressSubject[];
  day_streak: number;
  last_7_days: boolean[];
};

/** GET /api/v1/me/progress/breakdown */
export function getProgressBreakdown(): Promise<ProgressBreakdownResponse> {
  return apiFetch<ProgressBreakdownResponse>('/me/progress/breakdown', { method: 'GET' }).then((r) => ({
    ...r,
    trend: arr(r.trend),
    subjects: arr(r.subjects),
    last_7_days: arr(r.last_7_days),
  }));
}

export type RecentContentResponse = {
  recent: any[];
};

/** GET /api/v1/me/recent-content */
export function getRecentContent(): Promise<RecentContentResponse> {
  return apiFetch<RecentContentResponse>('/me/recent-content', { method: 'GET' }).then((r) => ({ recent: arr(r.recent) }));
}

export const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh',
  'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha',
  'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Jammu and Kashmir',
  'Ladakh', 'Lakshadweep', 'Puducherry',
] as const;

export type ResetScope = 'bookmarks' | 'qbank' | 'flashcards' | 'pulse';
export type ResetStatus = { scope: ResetScope; last_reset_at?: string; next_allowed_at?: string; can_reset: boolean };
/** GET /me/resets: when each kind of study data was last cleared and may be cleared again. */
export const getResets = () => apiFetch<{ resets: ResetStatus[] }>('/me/resets').then((r) => arr(r.resets));
/** POST /me/resets/:scope: clears it. 409 `reset_cooldown` if it was cleared within the last three months. */
export const resetContent = (scope: ResetScope) => apiFetch<{ removed: number; resets: ResetStatus[] }>(`/me/resets/${scope}`, { method: 'POST' });
