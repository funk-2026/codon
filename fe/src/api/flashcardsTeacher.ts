import { apiFetch, arr } from './client';
import type { MediaMap } from '@/src/rich/ast';

/** Teacher authoring of flashcard decks (draft → pending_review → approved → published). */

export type DeckStatus = 'draft' | 'pending_review' | 'approved' | 'published' | 'rejected';

export type TeacherDeck = {
  id: string;
  title: string;
  description: string;
  course_id: string;
  subject_id?: string;
  chapter_id?: string;
  status: DeckStatus;
  requires_subscription: boolean;
  rejection_reason?: string;
  card_count: number;
  rating_avg: number;
  rating_count: number;
  created_at: string;
  updated_at: string;
};

export type TeacherCard = { id: string; deck_id: string; front: string; back: string; content_format: string; position: number };

export type DeckInput = {
  title?: string;
  description?: string;
  course_id?: string;
  /** "" clears it (and clearing the subject clears the chapter). The course is fixed after creation. */
  subject_id?: string;
  chapter_id?: string;
  requires_subscription?: boolean;
};

/** Decks can only be changed while draft or rejected (server returns 409 `locked` otherwise). */
export const isDeckEditable = (s: DeckStatus) => s === 'draft' || s === 'rejected';

export const listTeacherDecks = () =>
  apiFetch<{ decks: TeacherDeck[] }>('/teacher/flashcard-decks').then((r) => ({ decks: arr(r.decks) }));

export const getTeacherDeck = (id: string) =>
  apiFetch<{ deck: TeacherDeck; cards: TeacherCard[]; media: MediaMap }>(`/teacher/flashcard-decks/${id}`).then((r) => ({
    ...r,
    cards: arr(r.cards),
    media: r.media ?? {},
  }));

export const createDeck = (d: DeckInput & { title: string; course_id: string }) =>
  apiFetch<TeacherDeck>('/teacher/flashcard-decks', { method: 'POST', body: JSON.stringify(d) });

export const updateDeck = (id: string, d: DeckInput) =>
  apiFetch<TeacherDeck>(`/teacher/flashcard-decks/${id}`, { method: 'PATCH', body: JSON.stringify(d) });

export const deleteDeck = (id: string) => apiFetch<{ message: string }>(`/teacher/flashcard-decks/${id}`, { method: 'DELETE' });

export const addCard = (deckId: string, c: { front: string; back: string }) =>
  apiFetch<{ card: TeacherCard; media: MediaMap }>(`/teacher/flashcard-decks/${deckId}/cards`, { method: 'POST', body: JSON.stringify(c) });

export const updateCard = (id: string, c: { front?: string; back?: string }) =>
  apiFetch<{ card: TeacherCard; media: MediaMap }>(`/teacher/flashcards/${id}`, { method: 'PATCH', body: JSON.stringify(c) });

export const deleteCard = (id: string) => apiFetch<{ message: string }>(`/teacher/flashcards/${id}`, { method: 'DELETE' });

export const reorderCards = (deckId: string, ids: string[]) =>
  apiFetch<{ message: string }>(`/teacher/flashcard-decks/${deckId}/reorder`, { method: 'POST', body: JSON.stringify({ ids }) });

export const submitDeck = (id: string) => apiFetch<{ message: string }>(`/teacher/flashcard-decks/${id}/submit-for-review`, { method: 'POST' });
export const publishDeck = (id: string) => apiFetch<{ message: string }>(`/teacher/flashcard-decks/${id}/publish`, { method: 'POST' });
