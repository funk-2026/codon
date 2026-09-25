import { apiFetch, qs, type Paginated } from './client';
import type { MediaView } from '@/src/rich/ast';

export type MediaPurpose =
  | 'question_image' | 'explanation_image' | 'brain_hack_image' | 'wellness_image'
  | 'flashcard_image' | 'home_update_image' | 'note_image' | 'import_bundle';

export type PresignInput = {
  purpose: MediaPurpose;
  file_name: string;
  content_type: string;
  /** Exact byte size — the signed URL only accepts this many bytes. */
  bytes: number;
  sha256?: string;
};

export type PresignResult = {
  /** Absent for `import_bundle` (a zip has no media row). */
  media_id?: string;
  file_key: string;
  upload_url: string;
  headers: Record<string, string>;
  expires_in: number;
};

/** POST /media/presign */
export const presignMedia = (b: PresignInput) => apiFetch<PresignResult>('/media/presign', { method: 'POST', body: JSON.stringify(b) });

export type MediaAsset = {
  id: string;
  owner_id: string;
  status: 'pending' | 'ready' | 'failed';
  width?: number;
  height?: number;
  alt?: string;
  created_at: string;
};

/** POST /media/:id/complete — server verifies bytes, strips EXIF, makes display + thumb variants. */
export const completeMedia = (id: string) => apiFetch<{ media: MediaAsset; view: MediaView }>(`/media/${id}/complete`, { method: 'POST' });

export const getMedia = (id: string) => apiFetch<{ media: MediaAsset; view: MediaView }>(`/media/${id}`);

export const listMyMedia = (p: { unreferenced?: boolean; cursor?: string | null; limit?: number } = {}) =>
  apiFetch<Paginated<MediaAsset> & { media: Record<string, MediaView> }>(`/teacher/media${qs({ ...p, cursor: p.cursor ?? undefined })}`);

export const updateMediaAlt = (id: string, alt: string) =>
  apiFetch<MediaAsset>(`/teacher/media/${id}`, { method: 'PATCH', body: JSON.stringify({ alt }) });

/** 409 `media_in_use` if any content still references it. */
export const deleteMedia = (id: string) => apiFetch<{ message: string }>(`/teacher/media/${id}`, { method: 'DELETE' });
