import { apiFetch, arr, qs } from './client';
import type { MediaMap } from '@/src/rich/ast';

export type WellnessCategory = 'guidance' | 'motivation' | 'reflection_prompt';

export type WellnessContent = {
  id: string;
  title: string;
  category: WellnessCategory;
  body_text: string;
  /** `rich_v1` bodies may contain images and formatting; legacy rows are `plain`. */
  content_format?: 'plain' | 'rich_v1';
  media_id?: string;
  media_url?: string;
  is_active: boolean;
  created_at?: string;
};

/** GET /wellness/content — active items only (optionally one category). */
export const listWellness = (category?: WellnessCategory) =>
  apiFetch<{ content: WellnessContent[]; media: MediaMap }>(`/wellness/content${qs({ category })}`).then((r) => ({
    content: arr(r.content),
    media: r.media ?? {},
  }));

/** GET /wellness/content/:id */
export const getWellnessItem = (id: string) =>
  apiFetch<{ content: WellnessContent; media: MediaMap }>(`/wellness/content/${id}`).then((r) => ({ ...r, media: r.media ?? {} }));

// ── Admin authoring ─────────────────────────────────────────────────────────
export type WellnessInput = { title: string; category: WellnessCategory; body_text: string; content_format: 'rich_v1' };

export const adminCreateWellness = (w: WellnessInput) =>
  apiFetch<WellnessContent>('/admin/wellness-content', { method: 'POST', body: JSON.stringify(w) });
export const adminUpdateWellness = (id: string, w: Partial<WellnessInput> & { is_active?: boolean }) =>
  apiFetch<WellnessContent>(`/admin/wellness-content/${id}`, { method: 'PATCH', body: JSON.stringify(w) });
export const adminDeleteWellness = (id: string) => apiFetch<{ message: string }>(`/admin/wellness-content/${id}`, { method: 'DELETE' });
