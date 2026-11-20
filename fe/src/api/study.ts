import { apiFetch, qs } from './client';

export type PulseItem = {
  id: string;
  title: string;
  body: string;
  subject_id: string;
  subject_name: string;
  chapter_id: string;
  chapter_name: string;
  chapter_order: number;
  order_index: number;
  read: boolean;
};
export const listPulse = (courseId?: string) => apiFetch<{ items: PulseItem[] }>(`/pulse${qs({ course_id: courseId })}`).then((r) => r.items ?? []);
export const markPulseRead = (id: string) => apiFetch<{ read: boolean }>(`/pulse/${id}/read`, { method: 'POST' });

export type DoneRow = { id: string; name: string; subject: string; chapter: string; at: string };
export const listPulseReads = () =>
  apiFetch<{ items: { id: string; title: string; subject: string; chapter: string; read_at: string }[] }>('/me/pulse/reads').then((r) =>
    (r.items ?? []).map((x): DoneRow => ({ id: x.id, name: x.title, subject: x.subject, chapter: x.chapter, at: x.read_at })),
  );
export const listFlashcardActivity = () => apiFetch<{ items: DoneRow[] }>('/me/flashcards/activity').then((r) => r.items ?? []);

export type SchemaStatus = 'yet_to_read' | 'yet_to_revise' | 'confident';
export type SchemaTopic = { id: string; name: string; total: number; by_year: Record<string, number>; status: SchemaStatus };
export type SchemaChapter = { id: string; name: string; topics: SchemaTopic[] };
export type SchemaSubject = { id: string; name: string; chapters: SchemaChapter[] };
export type SchemaOverview = { subjects: SchemaSubject[]; years: string[] };
export const getSchema = (courseId?: string) => apiFetch<SchemaOverview>(`/schema${qs({ course_id: courseId })}`).then((r) => ({ subjects: r.subjects ?? [], years: r.years ?? [] }));
export type SchemaTopicDetail = { id: string; name: string; subject: string; chapter: string; total: number; rows: { year: string; subtopic: string; questions: number }[] };
export const getSchemaTopic = (id: string) => apiFetch<SchemaTopicDetail>(`/schema/topics/${id}`);
export const setSchemaStatus = (id: string, status: SchemaStatus) => apiFetch<{ status: string }>(`/schema/topics/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) });
export const listSchemaCompletions = () => apiFetch<{ items: DoneRow[] }>('/me/schema/completions').then((r) => r.items ?? []);

// ── Teacher / admin ────────────────────────────────────────────────────────
export const createPulse = (b: { course_id: string; subject_id: string; chapter_id: string; title: string; body: string }) =>
  apiFetch<{ id: string }>('/teacher/pulse', { method: 'POST', body: JSON.stringify(b) });
export const listTeacherPulse = (courseId?: string) => apiFetch<{ items: PulseItem[] }>(`/teacher/pulse${qs({ course_id: courseId })}`).then((r) => r.items ?? []);
export const deletePulse = (id: string) => apiFetch<{ deleted: boolean }>(`/teacher/pulse/${id}`, { method: 'DELETE' });

export type SchemaImportRow = { subject: string; chapter: string; topic: string; year: string; subtopic: string; questions: number };
export const importSchema = (courseId: string, rows: SchemaImportRow[]) =>
  apiFetch<{ rows: number; topics: number; new_topics: number }>('/admin/schema/import', { method: 'POST', body: JSON.stringify({ course_id: courseId, rows }) });

export const updatePulse = (id: string, b: { title?: string; body?: string }) => apiFetch<{ id: string }>(`/teacher/pulse/${id}`, { method: 'PATCH', body: JSON.stringify(b) });
export const movePulse = (id: string, direction: 'up' | 'down') => apiFetch<{ moved: boolean }>(`/teacher/pulse/${id}/move`, { method: 'POST', body: JSON.stringify({ direction }) });

export type ManagedTopic = { id: string; name: string; subject_id: string; subject: string; chapter_id: string; chapter: string; total: number; rows: number };
export const listManagedTopics = (courseId?: string) => apiFetch<{ topics: ManagedTopic[] }>(`/teacher/schema/topics${qs({ course_id: courseId })}`).then((r) => r.topics ?? []);
export const createManagedTopic = (b: { course_id: string; subject_id: string; chapter_id: string; name: string }) => apiFetch<{ id: string }>('/teacher/schema/topics', { method: 'POST', body: JSON.stringify(b) });
export const renameManagedTopic = (id: string, name: string) => apiFetch<{ id: string }>(`/teacher/schema/topics/${id}`, { method: 'PATCH', body: JSON.stringify({ name }) });
export const deleteManagedTopic = (id: string) => apiFetch<{ deleted: boolean }>(`/teacher/schema/topics/${id}`, { method: 'DELETE' });
export const saveTopicYears = (id: string, rows: { year: string; subtopic: string; questions: number }[]) =>
  apiFetch<{ rows: number }>(`/teacher/schema/topics/${id}/years`, { method: 'PUT', body: JSON.stringify({ rows }) });
