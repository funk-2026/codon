import type { BadgeStatus } from '@/src/components';
import type { DeckStatus } from '@/src/api/flashcardsTeacher';

/** How each deck status is shown to its author. */
export const DECK_BADGE: Record<DeckStatus, { status: BadgeStatus; label: string }> = {
  draft: { status: 'draft', label: 'Draft' },
  pending_review: { status: 'pending', label: 'In review' },
  approved: { status: 'approved', label: 'Approved — publish it' },
  published: { status: 'published', label: 'Live' },
  rejected: { status: 'rejected', label: 'Needs changes' },
};
