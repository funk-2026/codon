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
  /** Document lessons written in the app. */
  body_text?: string;
  author_name?: string;
  publish_at?: string;
  submitted_at?: string;
  submit_note?: string;
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
  has_fourth_book_pdf?: boolean;
  fourth_book_pdf_url?: string;
  has_board_questions_pdf?: boolean;
  board_questions_pdf_url?: string;
};

export type GetContentResponse = LecturePDFs & {
  /** Where this student left off (seconds). Absent when never watched or already finished. */
  progress_seconds?: number;
  /** Where the lecture sits, whether I marked it complete, and the QBank module of the same chapter. */
  subject_id?: string;
  subject_name?: string;
  chapter_name?: string;
  is_completed?: boolean;
  related_qbank_test_id?: string;
  /** The chapter's cover image, shown while the lecture loads. */
  chapter_cover?: import('@/src/rich/ast').MediaView;
  content: ContentItem;
  url?: string; // Pre-signed URL for document, or HLS URL for video
};

/** GET /api/v1/content/:id (Student - Requires BE implementation) */
export function getContentItem(id: string): Promise<GetContentResponse> {
  return apiFetch<GetContentResponse>(`/content/${id}`, { method: 'GET' });
}

/** POST /api/v1/content/:id/heartbeat (Student) */
export function sendHeartbeat(id: string, progressSeconds: number, isCompleted: boolean, durationSeconds?: number): Promise<{status: string}> {
  return apiFetch<{status: string}>(`/content/${id}/heartbeat`, {
    method: 'POST',
    body: JSON.stringify({ progress_seconds: progressSeconds, is_completed: isCompleted, ...(durationSeconds ? { duration_seconds: Math.round(durationSeconds) } : {}) })
  });
}

export type SubjectVideo = {
  id: string;
  title: string;
  chapter_id: string;
  chapter_name: string;
  chapter_order: number;
  duration_seconds: number;
  requires_subscription: boolean;
  progress_seconds: number;
  is_completed: boolean;
  locked: boolean;
};
/** GET /subjects/:id/videos: the subject's video lectures by chapter, with my progress. */
export type SubjectVideos = { videos: SubjectVideo[]; covers: Record<string, string>; media: import('@/src/rich/ast').MediaMap };
export const listSubjectVideos = (subjectId: string) =>
  apiFetch<{ videos: SubjectVideo[]; covers?: Record<string, string>; media?: import('@/src/rich/ast').MediaMap }>(`/subjects/${subjectId}/videos`).then((r): SubjectVideos => ({ videos: r.videos ?? [], covers: r.covers ?? {}, media: r.media ?? {} }));

export type FreeVideo = { id: string; title: string; subject_name: string; chapter_name: string; duration_seconds: number; is_completed: boolean };
/** GET /videos/free: lectures anyone can watch without a plan. */
export const listFreeVideos = (courseId?: string) => apiFetch<{ videos: FreeVideo[] }>(`/videos/free${courseId ? `?course_id=${courseId}` : ''}`).then((r) => r.videos ?? []);

/** POST /content/:id/complete: mark a lecture complete, or not complete again. */
export const setLectureCompleted = (id: string, completed: boolean) =>
  apiFetch<{ completed: boolean }>(`/content/${id}/complete`, { method: 'POST', body: JSON.stringify({ completed }) });

export type VideoCompletion = { id: string; title: string; subject: string; chapter: string; completed_at: string };
/** GET /me/video-completions: lectures I completed, newest first. */
export const listVideoCompletions = () => apiFetch<{ completions: VideoCompletion[] }>('/me/video-completions').then((r) => r.completions ?? []);
