import { apiFetch } from './client';

export type Session = {
  id: string;
  device_id: string;
  device_info?: string;
  created_at: string;
  last_used_at: string;
};

export type ListSessionsResponse = {
  sessions: Session[];
};

/** GET /api/v1/auth/sessions */
export function listSessions(): Promise<ListSessionsResponse> {
  return apiFetch<ListSessionsResponse>('/auth/sessions', { method: 'GET' });
}

/** DELETE /api/v1/auth/sessions/:id */
export function revokeSession(id: string): Promise<{ message: string }> {
  return apiFetch<{ message: string }>(`/auth/sessions/${id}`, { method: 'DELETE' });
}

/** POST /api/v1/auth/logout */
export function logout(): Promise<{ message: string }> {
  return apiFetch<{ message: string }>('/auth/logout', { method: 'POST' });
}
