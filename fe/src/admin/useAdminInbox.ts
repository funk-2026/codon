import { useQuery } from '@tanstack/react-query';
import { adminListContent, adminListKYC, adminListTests } from '@/src/api/admin';
import { adminListBrainHacks, adminListDecks } from '@/src/api/contentReview';
import { listAdminCorrections, listAdminReports } from '@/src/api/moderation';
import { getModule } from '@/src/modules/registry';
import { buildReviewItems } from './reviewItems';

const CAP = 20;

/**
 * Everything waiting on the admin: the pending items to approve (tests, lessons, Brain Hacks,
 * decks) and counts for KYC, open question reports and pending corrections. One query so the
 * Review tab, its badge and Home all agree. A failing source counts as empty, not as an error.
 */
export const useAdminInbox = () =>
  useQuery({
    queryKey: ['admin', 'inbox'],
    queryFn: async () => {
      const [tests, content, hacks, decks, kyc, reports, edits] = await Promise.all([
        adminListTests('pending_review').catch(() => ({ tests: [] })),
        adminListContent('pending_review').catch(() => ({ content: [] })),
        adminListBrainHacks().catch(() => ({ brain_hacks: [] })),
        adminListDecks().catch(() => ({ decks: [] })),
        adminListKYC('pending').catch(() => ({ records: [] })),
        listAdminReports({ status: 'open', limit: CAP }).catch(() => ({ items: [] })),
        listAdminCorrections({ status: 'pending', limit: CAP }).catch(() => ({ items: [] })),
      ]);
      const items = buildReviewItems({
        tests: tests.tests.map((t) => ({ ...t, module_label: getModule(t.module_type).label })),
        content: content.content,
        hacks: hacks.brain_hacks,
        decks: decks.decks,
      });
      return {
        items,
        kyc: (kyc.records ?? []).length,
        reports: (reports.items ?? []).length,
        edits: (edits.items ?? []).length,
      };
    },
  });

export const totalWaiting = (d?: { items: unknown[]; kyc: number; reports: number; edits: number }) =>
  d ? d.items.length + d.kyc + d.reports + d.edits : 0;
