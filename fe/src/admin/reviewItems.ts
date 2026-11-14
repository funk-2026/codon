/**
 * Everything waiting on an admin's approval, in one shape: tests, videos, documents, Brain Hacks
 * and flashcard decks. Pure logic so it can be tested; the screens and fetching live elsewhere.
 */

export type ReviewType = 'Test' | 'Video' | 'Document' | 'Brain Hack' | 'Deck';
export type ReviewFilter = 'all' | 'tests' | 'lessons' | 'hacks' | 'decks';

export type ReviewItem = {
  id: string;
  type: ReviewType;
  title: string;
  /** Where it lives (course, subject, chapter) or a short description. */
  meta: string;
  author: string;
  /** Display date. */
  submitted: string;
  /** ISO time used for ordering; oldest waiting first. */
  at?: string;
  /** Test-only details passed on to the review screen. */
  test?: { moduleType: string; questionCount: number; durationMinutes?: number; marksCorrect: number; marksWrong: number };
};

export const FILTER_OF: Record<ReviewType, Exclude<ReviewFilter, 'all'>> = {
  Test: 'tests',
  Video: 'lessons',
  Document: 'lessons',
  'Brain Hack': 'hacks',
  Deck: 'decks',
};

/** The `type` param the review screen understands (kept as before for tests and lessons). */
export const DETAIL_TYPE: Record<ReviewType, string> = {
  Test: 'test',
  Video: 'Videos',
  Document: 'Documents',
  'Brain Hack': 'Brain Hacks',
  Deck: 'Decks',
};

type Person = { name?: string | null; phone_number?: string | null } | undefined;
const who = (p: Person, fallback = 'Unknown teacher') => p?.name || p?.phone_number || fallback;
const day = (iso?: string) => new Date(iso || Date.now()).toLocaleDateString();
const join = (...parts: (string | undefined)[]) => parts.filter(Boolean).join(' · ');

export function buildReviewItems(src: {
  tests?: { id: string; title: string; created_at?: string; total_questions?: number; module_label?: string; duration_minutes?: number; marks_per_correct: number; marks_per_wrong: number; course?: { name?: string }; subject?: { name?: string }; creator?: Person }[];
  content?: { id: string; title: string; created_at?: string; content_type?: string; course?: { name?: string }; chapter?: { name?: string }; uploader?: Person }[];
  hacks?: { id: string; title: string; created_at?: string; category?: string; read_minutes?: number }[];
  decks?: { id: string; title: string; created_at?: string; card_count?: number; description?: string }[];
}): ReviewItem[] {
  const out: ReviewItem[] = [];
  for (const t of src.tests ?? []) {
    out.push({
      id: t.id, type: 'Test', title: t.title, meta: join(t.course?.name, t.subject?.name) || 'Test', author: who(t.creator), submitted: day(t.created_at), at: t.created_at,
      test: { moduleType: t.module_label ?? '', questionCount: t.total_questions ?? 0, durationMinutes: t.duration_minutes, marksCorrect: t.marks_per_correct, marksWrong: t.marks_per_wrong },
    });
  }
  for (const c of src.content ?? []) {
    out.push({ id: c.id, type: c.content_type === 'video' ? 'Video' : 'Document', title: c.title, meta: join(c.course?.name, c.chapter?.name) || (c.content_type === 'video' ? 'Video' : 'Document'), author: who(c.uploader), submitted: day(c.created_at), at: c.created_at });
  }
  for (const h of src.hacks ?? []) {
    out.push({ id: h.id, type: 'Brain Hack', title: h.title, meta: join(h.category, h.read_minutes ? `${h.read_minutes} min read` : undefined) || 'Brain Hack', author: 'Teacher', submitted: day(h.created_at), at: h.created_at });
  }
  for (const d of src.decks ?? []) {
    out.push({ id: d.id, type: 'Deck', title: d.title, meta: `${d.card_count ?? 0} card${d.card_count === 1 ? '' : 's'}`, author: 'Teacher', submitted: day(d.created_at), at: d.created_at });
  }
  return out;
}

/** Oldest first: whatever has waited longest gets reviewed first. */
export const byWaiting = (a: ReviewItem, b: ReviewItem) => (a.at ?? '').localeCompare(b.at ?? '');

export function filterReview(items: ReviewItem[], filter: ReviewFilter, query: string): ReviewItem[] {
  const q = query.trim().toLowerCase();
  return items
    .filter((i) => (filter === 'all' || FILTER_OF[i.type] === filter) && (!q || i.title.toLowerCase().includes(q) || i.author.toLowerCase().includes(q)))
    .sort(byWaiting);
}

export function countByFilter(items: ReviewItem[]): Record<ReviewFilter, number> {
  const c: Record<ReviewFilter, number> = { all: items.length, tests: 0, lessons: 0, hacks: 0, decks: 0 };
  for (const i of items) c[FILTER_OF[i.type]]++;
  return c;
}
