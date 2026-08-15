import { apiFetch } from './client';

export type UserProfile = {
  id: string;
  phone_number: string;
  name: string | null;
  role: 'student' | 'teacher' | 'admin';
  profile_photo_key: string | null;
  selected_course_id: string | null;
  kyc_status: string;
  created_at: string;
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
};

/** GET /api/v1/me */
export function getMe(): Promise<GetMeResponse> {
  return apiFetch<GetMeResponse>('/me', { method: 'GET' });
}

export type UpdateMeRequest = {
  name?: string;
  profile_photo_key?: string;
  selected_course_id?: string;
};

/** PATCH /api/v1/me */
export function updateMe(data: UpdateMeRequest): Promise<UserProfile> {
  return apiFetch<UserProfile>('/me', {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
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
  return apiFetch<GetAttemptsResponse>('/me/attempts', { method: 'GET' });
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
  return apiFetch<ProgressBreakdownResponse>('/me/progress/breakdown', { method: 'GET' });
}

export type RecentContentResponse = {
  recent: any[];
};

/** GET /api/v1/me/recent-content */
export function getRecentContent(): Promise<RecentContentResponse> {
  return apiFetch<RecentContentResponse>('/me/recent-content', { method: 'GET' });
}
