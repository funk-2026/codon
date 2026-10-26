import { apiFetch } from './client';
import type { UserProfile } from './profile';
import type { Course, Chapter } from './courses';

export type ContentItem = {
  id: string;
  notes_pdf_key?: string;
  annotated_pdf_key?: string;
  rating_avg?: number;
  rating_count?: number;
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

/**
 * A lecture's PDFs. Students: notes are linked straight away; the annotated PDF
 * (what was written during the lecture) is linked only after they've watched it —
 * until then `annotated_pdf_locked` is true. Authors/reviewers always get both.
 */
export type LecturePDFs = {
  has_notes_pdf: boolean;
  notes_pdf_url?: string;
  has_annotated_pdf: boolean;
  annotated_pdf_url?: string;
  annotated_pdf_locked?: boolean;
};

export type GetContentResponse = LecturePDFs & {
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
