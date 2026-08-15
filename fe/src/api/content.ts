import { apiFetch } from './client';

export type ContentItem = {
  id: string;
  title: string;
  course_id: string;
  content_type: 'video' | 'document';
  requires_subscription: boolean;
  chapter_id: string;
  file_key: string;
  video_status?: string;
  hls_playlist_url?: string;
  status: string;
  rejection_reason?: string;
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
