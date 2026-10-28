import { apiFetch, arr, qs } from './client';
import type { MediaMap } from '@/src/rich/ast';
import type { BrainHack } from './discover';
import type { TeacherDeck, TeacherCard } from './flashcardsTeacher';

/** Admin moderation of Brain Hacks and flashcard decks (pending_review → approved | rejected). */

export type ReviewStatus = 'pending_review' | 'approved' | 'rejected' | 'published';

export type AdminBrainHack = BrainHack & { status: ReviewStatus; author_id?: string; rejection_reason?: string; created_at?: string };

export const adminListBrainHacks = (status: ReviewStatus = 'pending_review') =>
  apiFetch<{ brain_hacks: AdminBrainHack[]; media: MediaMap }>(`/admin/brain-hacks${qs({ status })}`).then((r) => ({
    brain_hacks: arr(r.brain_hacks),
    media: r.media ?? {},
  }));

export const adminApproveBrainHack = (id: string) => apiFetch<{ message: string }>(`/admin/brain-hacks/${id}/approve`, { method: 'POST' });
export const adminRejectBrainHack = (id: string, reason: string) =>
  apiFetch<{ message: string }>(`/admin/brain-hacks/${id}/reject`, { method: 'POST', body: JSON.stringify({ reason }) });

export const adminListDecks = (status: ReviewStatus = 'pending_review') =>
  apiFetch<{ decks: TeacherDeck[] }>(`/admin/flashcard-decks${qs({ status })}`).then((r) => ({ decks: arr(r.decks) }));

export const adminGetDeck = (id: string) =>
  apiFetch<{ deck: TeacherDeck; cards: TeacherCard[]; media: MediaMap }>(`/admin/flashcard-decks/${id}`).then((r) => ({
    ...r,
    cards: arr(r.cards),
    media: r.media ?? {},
  }));

export const adminApproveDeck = (id: string) => apiFetch<{ message: string }>(`/admin/flashcard-decks/${id}/approve`, { method: 'POST' });
export const adminRejectDeck = (id: string, reason: string) =>
  apiFetch<{ message: string }>(`/admin/flashcard-decks/${id}/reject`, { method: 'POST', body: JSON.stringify({ reason }) });
