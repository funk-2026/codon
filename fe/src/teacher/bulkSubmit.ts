// Send many drafts for review in one go. Pure (the submit call is injected) so it is unit-tested.
import type { TeacherItem } from './items';

export type BulkResult = { sent: number; failed: { id: string; title: string; reason: string }[] };

/** Submits one at a time (never in parallel, so the reviewer queue keeps their order); one failure never stops the rest. */
export async function submitAll(
  items: Pick<TeacherItem, 'id' | 'title' | 'type'>[],
  submit: (item: Pick<TeacherItem, 'id' | 'title' | 'type'>) => Promise<unknown>,
  reasonOf: (err: unknown) => string = (e) => (e instanceof Error ? e.message : 'Could not be sent'),
): Promise<BulkResult> {
  const out: BulkResult = { sent: 0, failed: [] };
  for (const it of items) {
    try {
      await submit(it);
      out.sent += 1;
    } catch (e) {
      out.failed.push({ id: it.id, title: it.title, reason: reasonOf(e) });
    }
  }
  return out;
}

export function bulkSummary(r: BulkResult): string {
  if (r.failed.length === 0) return `Sent ${r.sent} for review`;
  const first = r.failed[0];
  return `${r.sent} sent. ${r.failed.length} couldn’t be sent (“${first.title}”: ${first.reason})`;
}
