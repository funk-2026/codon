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
