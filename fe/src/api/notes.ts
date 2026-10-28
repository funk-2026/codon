import { apiFetch } from './client';

export type QuestionNote = { question_id: string; body: string; updated_at?: string };

/** PUT /me/question-notes/:question_id — private, ≤4000 chars, only for questions the student was shown. */
export const putQuestionNote = (questionId: string, body: string) =>
  apiFetch<QuestionNote>(`/me/question-notes/${questionId}`, { method: 'PUT', body: JSON.stringify({ body }) });

export const deleteQuestionNote = (questionId: string) =>
  apiFetch<{ message: string }>(`/me/question-notes/${questionId}`, { method: 'DELETE' });

export const listQuestionNotes = () => apiFetch<{ notes: QuestionNote[] }>('/me/question-notes');

export const NOTE_MAX = 4000;
