import { apiFetch } from './client';
import type { UserProfile } from './profile';
import type { Course, Chapter } from './courses';

export type ContentItem = {
  id: string;
  title: string;
  course_id: string;
  course?: Course;
  content_type: 'video' | 'document';
  requires_subscription: boolean;
  chapter_id: string;
  chapter?: Chapter;
  file_key: string;
  video_status?: string;
  hls_playlist_url?: string;
  status: string;
  rejection_reason?: string;
  reviewed_at?: string;
  uploader?: UserProfile;
  created_at?: string;
};

export type ListContentResponse = {
  content: ContentItem[];
};

/** GET /api/v1/chapters/:id/content (Student - Requires BE implementation) */
export function getChapterContent(chapterId: string): Promise<ListContentResponse> {
  return apiFetch<ListContentResponse>(`/chapters/${chapterId}/content`, { method: 'GET' });
}

export type GetContentResponse = {
  content: ContentItem;
  url?: string; // Pre-signed URL for document, or HLS URL for video
};

/** GET /api/v1/content/:id (Student - Requires BE implementation) */
export function getContentItem(id: string): Promise<GetContentResponse> {
  return apiFetch<GetContentResponse>(`/content/${id}`, { method: 'GET' });
}

/** POST /api/v1/content/:id/heartbeat (Student) */
export function sendHeartbeat(id: string, progressSeconds: number, isCompleted: boolean): Promise<{status: string}> {
  return apiFetch<{status: string}>(`/content/${id}/heartbeat`, {
    method: 'POST',
    body: JSON.stringify({ progress_seconds: progressSeconds, is_completed: isCompleted })
  });
}
