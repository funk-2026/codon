import { apiFetch } from './client';

export type RatingItemType = 'test' | 'content' | 'brain_hack' | 'flashcard_deck' | 'question';

/** Closed vocabulary — ratings carry no free text. */
export const RATING_TAGS: { key: string; label: string }[] = [
  { key: 'helpful', label: 'Helpful' },
  { key: 'clear', label: 'Clear' },
  { key: 'great_explanation', label: 'Great explanation' },
  { key: 'too_easy', label: 'Too easy' },
  { key: 'too_hard', label: 'Too hard' },
  { key: 'confusing', label: 'Confusing' },
];

export type RatingAggregate = { rating_avg?: number; rating_count?: number };

/** PUT /ratings — stars 1–5 (or thumbs -1/+1 for a question's explanation). 403 `not_eligible` until the student did the thing. */
export const putRating = (r: { item_type: RatingItemType; item_id: string; value: number; tags?: string[] }) =>
  apiFetch<{ rating: { value: number; tags?: string[] }; aggregate: RatingAggregate }>('/ratings', {
    method: 'PUT',
    body: JSON.stringify(r),
  });

/** DELETE /ratings/:type/:id */
export const deleteRating = (type: RatingItemType, id: string) =>
  apiFetch<{ message: string }>(`/ratings/${type}/${id}`, { method: 'DELETE' });
