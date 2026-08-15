import { apiFetch } from './client';

export type SubmitFeedbackRequest = {
  category: string;
  message: string;
  app_version?: string;
  device_os?: string;
};

export type UserFeedback = {
  id: string;
  user_id: string;
  category: string;
  message: string;
  app_version?: string;
  device_os?: string;
  created_at: string;
};

/** POST /api/v1/feedback */
export function submitFeedback(data: SubmitFeedbackRequest): Promise<UserFeedback> {
  return apiFetch<UserFeedback>('/feedback', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}
