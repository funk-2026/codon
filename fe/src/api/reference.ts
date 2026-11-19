import { apiFetch, arr, qs } from './client';
import type { MediaMap } from '@/src/rich/ast';

export type RefKind = 'howto' | 'policy' | 'pattern' | 'past_paper' | 'practice_paper' | 'weightage' | 'schema';

export type ReferenceDoc = {
  id: string;
  kind: RefKind;
  title: string;
  class?: string;
  board?: string;
  subject?: string;
  year?: number;
  slug?: string;
  language?: string;
  file_name?: string;
  size_bytes: number;
  is_active: boolean;
};

/** GET /reference-docs: metadata only. Open one with `getReferenceDoc`. */
export const listReferenceDocs = (f: { kind?: RefKind; class?: string; board?: string; subject?: string; year?: number; slug?: string } = {}) =>
  apiFetch<{ docs: ReferenceDoc[] }>(`/reference-docs${qs(f)}`).then((r) => arr(r.docs));

/** GET /reference-docs/:id: the document and a link that works for two hours. `can_download` is false for paper patterns. */
export const getReferenceDoc = (id: string) => apiFetch<{ doc: ReferenceDoc; url: string; can_download: boolean }>(`/reference-docs/${id}`);

export type Faculty = { id: string; name: string; title?: string; summary?: string; about?: string; media_id?: string; order_index: number; is_active: boolean };
/** GET /faculty: empty until an admin adds people. */
export const listFaculty = () => apiFetch<{ faculty: Faculty[]; media: MediaMap }>('/faculty').then((r) => ({ faculty: arr(r.faculty), media: r.media ?? {} }));

// ── Admin ──────────────────────────────────────────────────────────────────
export type RefDocInput = Partial<Omit<ReferenceDoc, 'id'>> & { file_key?: string; clear_year?: boolean };
export const adminListReferenceDocs = (kind?: RefKind) => apiFetch<{ docs: ReferenceDoc[] }>(`/admin/reference-docs${qs({ kind })}`).then((r) => arr(r.docs));
export const adminCreateReferenceDoc = (b: RefDocInput) => apiFetch<ReferenceDoc>('/admin/reference-docs', { method: 'POST', body: JSON.stringify(b) });
export const adminUpdateReferenceDoc = (id: string, b: RefDocInput) => apiFetch<ReferenceDoc>(`/admin/reference-docs/${id}`, { method: 'PATCH', body: JSON.stringify(b) });
export const adminDeleteReferenceDoc = (id: string) => apiFetch<{ message: string }>(`/admin/reference-docs/${id}`, { method: 'DELETE' });

export type FacultyInput = { name?: string; title?: string; summary?: string; about?: string; media_id?: string; order_index?: number; is_active?: boolean };
export const adminListFaculty = () => apiFetch<{ faculty: Faculty[]; media: MediaMap }>('/admin/faculty').then((r) => ({ faculty: arr(r.faculty), media: r.media ?? {} }));
export const adminAddFaculty = (b: FacultyInput) => apiFetch<Faculty>('/admin/faculty', { method: 'POST', body: JSON.stringify(b) });
export const adminUpdateFaculty = (id: string, b: FacultyInput) => apiFetch<Faculty>(`/admin/faculty/${id}`, { method: 'PATCH', body: JSON.stringify(b) });
export const adminDeleteFaculty = (id: string) => apiFetch<{ message: string }>(`/admin/faculty/${id}`, { method: 'DELETE' });
