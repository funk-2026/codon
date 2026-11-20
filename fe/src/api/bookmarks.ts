import { apiFetch, qs, type Paginated } from './client';
import type { MediaMap } from '@/src/rich/ast';

export type BookmarkItemType = 'question' | 'flashcard' | 'content';

export type BookmarkCollection = {
  id: string;
  key: string;
  label: string;
  order_index: number;
  is_system: boolean;
  count: number;
};

export type Bookmark = {
  id: string;
  item_type: BookmarkItemType;
  item_id: string;
  collection_id: string;
  note?: string;
  created_at: string;
};

export type BookmarkedQuestion = {
  id: string;
  content_format: string;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  /** Only present for questions the student has finished or revealed. */
  correct_option?: 'A' | 'B' | 'C' | 'D';
  explanation?: string;
  subject_id?: string;
  chapter_id?: string;
  difficulty?: string;
  tags?: string[];
  ref_book?: string;
  ref_edition?: string;
  ref_pages?: string;
};

export type BookmarkRow = Bookmark & {
  question?: BookmarkedQuestion;
  content?: Record<string, unknown>;
  flashcard?: Record<string, unknown>;
};

/** GET /me/bookmark-collections */
export const listBookmarkCollections = () =>
  apiFetch<{ collections: BookmarkCollection[] }>('/me/bookmark-collections');

/** PUT /me/bookmarks — idempotent create-or-move. 403 `not_exposed` if the question was never seen. */
export const putBookmark = (b: { item_type: BookmarkItemType; item_id: string; collection_id?: string; note?: string }) =>
  apiFetch<Bookmark>('/me/bookmarks', { method: 'PUT', body: JSON.stringify(b) });

/** DELETE /me/bookmarks/:type/:id — idempotent. */
export const deleteBookmark = (type: BookmarkItemType, id: string) =>
  apiFetch<{ message: string }>(`/me/bookmarks/${type}/${id}`, { method: 'DELETE' });

export type BookmarkIds = { item_type: BookmarkItemType; ids: string[]; by_collection: Record<string, string[]> };

/** GET /me/bookmarks/ids — the whole set, for instant bookmark state everywhere. */
export const getBookmarkIds = (type: BookmarkItemType = 'question') =>
  apiFetch<BookmarkIds>(`/me/bookmarks/ids${qs({ item_type: type })}`);

export type BookmarkListParams = {
  collection_id?: string;
  /** Comma-separated ids: several bookmark types, subjects or chapters at once. */
  collection_ids?: string;
  subject_ids?: string;
  chapter_ids?: string;
  item_type?: BookmarkItemType;
  subject_id?: string;
  chapter_id?: string;
  q?: string;
  cursor?: string | null;
  limit?: number;
};

/** GET /me/bookmarks */
export const listBookmarks = (p: BookmarkListParams = {}) =>
  apiFetch<Paginated<BookmarkRow> & { media?: MediaMap }>(`/me/bookmarks${qs({ ...p, cursor: p.cursor ?? undefined })}`);

export type BookmarkSummary = {
  total: number;
  by_collection: { collection_id: string; count: number }[];
  by_subject: { subject_id: string; name: string; count: number }[];
};
/** GET /me/bookmarks/summary: totals per bookmark type and per subject (Biology, Chemistry, Physics order). */
export const getBookmarkSummary = (item_type: 'question' | 'flashcard' = 'question') => apiFetch<BookmarkSummary>(`/me/bookmarks/summary${qs({ item_type })}`);

export type BookmarkCheck = {
  is_correct: boolean;
  correct_option: 'A' | 'B' | 'C' | 'D';
  explanation?: string | null;
  content_format: string;
  media: MediaMap;
  tags?: string[];
  ref_book?: string;
  ref_edition?: string;
  ref_pages?: string;
  option_shares?: Record<string, number>;
  percent_correct?: number;
};
/** POST /me/bookmarks/questions/:id/check: answer a bookmarked question again. Nothing is saved. An empty option means no answer. */
export const checkBookmarkedQuestion = (id: string, option: '' | 'A' | 'B' | 'C' | 'D') =>
  apiFetch<BookmarkCheck>(`/me/bookmarks/questions/${id}/check`, { method: 'POST', body: JSON.stringify({ option }) });
