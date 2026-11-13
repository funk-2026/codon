/**
 * One shape for everything a teacher authors (tests, videos, notes, Brain Hacks, flashcard decks),
 * so Home and Content count, filter and open them the same way. Pure logic: no React Native here.
 */

export type ItemType = 'Test' | 'Video' | 'Document' | 'Brain Hack' | 'Deck';
export type ItemStatus = 'draft' | 'pending' | 'approved' | 'rejected' | 'published';
export type Segment = 'tests' | 'lessons' | 'hacks' | 'decks';

export type TeacherItem = {
  id: string;
  title: string;
  breadcrumb: string;
  type: ItemType;
  status: ItemStatus;
  rating?: { avg: number; count: number };
  /** ISO time used to order "recent"; falls back through reviewed → created. */
  at?: string;
  rejectionReason?: string;
};

export const SEGMENT_OF: Record<ItemType, Segment> = {
  Test: 'tests',
  Video: 'lessons',
  Document: 'lessons',
  'Brain Hack': 'hacks',
  Deck: 'decks',
};

export const STATUS_LABEL: Record<ItemStatus, string> = {
  draft: 'Draft',
  pending: 'In review',
  approved: 'Approved',
  published: 'Live',
  rejected: 'Changes needed',
};

/** The backend spells "in review" two ways across endpoints; anything unknown reads as a draft. */
export function normalizeStatus(raw: string | undefined): ItemStatus {
  if (raw === 'pending_review') return 'pending';
  const known: ItemStatus[] = ['draft', 'pending', 'approved', 'rejected', 'published'];
  return (known as string[]).includes(raw ?? '') ? (raw as ItemStatus) : 'draft';
}

const rating = (avg?: number, count?: number) => (count && count > 0 ? { avg: avg ?? 0, count } : undefined);

type Loose = { id: string; title: string; status?: string; rating_avg?: number; rating_count?: number; created_at?: string; updated_at?: string; reviewed_at?: string; rejection_reason?: string };

export function buildItems(src: {
  tests?: (Loose & { chapter?: { name?: string }; module_type?: string })[];
  content?: (Loose & { content_type?: string; chapter?: { name?: string } })[];
  hacks?: (Loose & { category?: string })[];
  decks?: (Loose & { card_count?: number })[];
}): TeacherItem[] {
  const at = (x: Loose) => x.updated_at ?? x.reviewed_at ?? x.created_at;
  const out: TeacherItem[] = [];
  for (const t of src.tests ?? []) {
    out.push({ id: t.id, title: t.title, breadcrumb: t.chapter?.name ?? 'Test', type: 'Test', status: normalizeStatus(t.status), rating: rating(t.rating_avg, t.rating_count), at: at(t), rejectionReason: t.rejection_reason });
  }
  for (const c of src.content ?? []) {
    out.push({ id: c.id, title: c.title, breadcrumb: c.chapter?.name ?? (c.content_type === 'video' ? 'Video' : 'Notes'), type: c.content_type === 'video' ? 'Video' : 'Document', status: normalizeStatus(c.status), rating: rating(c.rating_avg, c.rating_count), at: at(c), rejectionReason: c.rejection_reason });
  }
  for (const h of src.hacks ?? []) {
    out.push({ id: h.id, title: h.title, breadcrumb: `Brain Hack${h.category ? ` · ${h.category}` : ''}`, type: 'Brain Hack', status: normalizeStatus(h.status), rating: rating(h.rating_avg, h.rating_count), at: at(h), rejectionReason: h.rejection_reason });
  }
  for (const d of src.decks ?? []) {
    out.push({ id: d.id, title: d.title, breadcrumb: `${d.card_count ?? 0} card${d.card_count === 1 ? '' : 's'}`, type: 'Deck', status: normalizeStatus(d.status), rating: rating(d.rating_avg, d.rating_count), at: at(d), rejectionReason: d.rejection_reason });
  }
  return out;
}

export function statusCounts(items: TeacherItem[]): Record<ItemStatus, number> {
  const counts: Record<ItemStatus, number> = { draft: 0, pending: 0, approved: 0, rejected: 0, published: 0 };
  for (const i of items) counts[i.status]++;
  return counts;
}

/** Newest first. Items without a date sort last. */
export const byRecent = (a: TeacherItem, b: TeacherItem) => (b.at ?? '').localeCompare(a.at ?? '');

export function filterItems(items: TeacherItem[], opts: { segment: Segment; status: ItemStatus | 'all'; query: string }): TeacherItem[] {
  const q = opts.query.trim().toLowerCase();
  return items
    .filter((i) => SEGMENT_OF[i.type] === opts.segment && (opts.status === 'all' || i.status === opts.status) && (!q || i.title.toLowerCase().includes(q)))
    .sort(byRecent);
}
