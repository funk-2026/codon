import { useQuery } from '@tanstack/react-query';
import { adminListContent, adminListKYC, adminListTests } from '@/src/api/admin';
import { adminListBrainHacks, adminListDecks } from '@/src/api/contentReview';
import { listAdminCorrections, listAdminReports } from '@/src/api/moderation';
import { allPages } from '@/src/api/paginate';
import { getModule } from '@/src/modules/registry';
import { buildReviewItems } from './reviewItems';

/** How many rows the Reports and Edits segments count before reading "20+". */
export const COUNT_CAP = 20;

/**
 * Everything waiting on the admin: the pending items to approve (tests, lessons, Brain Hacks,
 * decks, every page of each) and counts for KYC, open question reports and pending corrections.
 * One query so the Review tab, its badge and Home all agree. A failing source counts as empty.
 */
export const useAdminInbox = () =>
  useQuery({
    queryKey: ['admin', 'inbox'],
    queryFn: async () => {
      const [tests, content, hacks, decks, kyc, reports, edits] = await Promise.all([
        allPages((cursor) => adminListTests('pending_review', { cursor, limit: 200 }).then((r) => ({ items: r.tests, next: r.next_cursor }))).catch(() => ({ items: [], complete: true })),
        allPages((cursor) => adminListContent('pending_review', { cursor, limit: 200 }).then((r) => ({ items: r.content, next: r.next_cursor }))).catch(() => ({ items: [], complete: true })),
        allPages((cursor) => adminListBrainHacks('pending_review', cursor).then((r) => ({ items: r.brain_hacks, next: r.next_cursor }))).catch(() => ({ items: [], complete: true })),
        allPages((cursor) => adminListDecks('pending_review', cursor).then((r) => ({ items: r.decks, next: r.next_cursor }))).catch(() => ({ items: [], complete: true })),
        adminListKYC('pending').catch(() => ({ records: [] })),
        listAdminReports({ status: 'open', limit: COUNT_CAP }).catch(() => ({ items: [], next_cursor: null })),
        listAdminCorrections({ status: 'pending', limit: COUNT_CAP }).catch(() => ({ items: [], next_cursor: null })),
      ]);
      const items = buildReviewItems({
        tests: tests.items.map((t) => ({ ...t, module_label: getModule(t.module_type).label })),
        content: content.items,
        hacks: hacks.items,
        decks: decks.items,
      });
      return {
        items,
        kyc: (kyc.records ?? []).length,
        reports: (reports.items ?? []).length,
        reportsMore: !!(reports as { next_cursor?: string | null }).next_cursor,
        edits: (edits.items ?? []).length,
        editsMore: !!(edits as { next_cursor?: string | null }).next_cursor,
      };
    },
  });

export const totalWaiting = (d?: { items: unknown[]; kyc: number; reports: number; edits: number }) =>
  d ? d.items.length + d.kyc + d.reports + d.edits : 0;
