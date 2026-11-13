/**
 * Follow a cursor-paged endpoint to the end. Admin queues need the whole list (counts, badges,
 * oldest-first ordering), and the backend returns at most 200 rows per page.
 * Capped so a runaway list can't loop forever.
 */
export async function allPages<T>(
  fetchPage: (cursor?: string) => Promise<{ items: T[]; next?: string | null }>,
  maxPages = 10,
): Promise<{ items: T[]; complete: boolean }> {
  const items: T[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < maxPages; page++) {
    const r = await fetchPage(cursor);
    items.push(...r.items);
    if (!r.next) return { items, complete: true };
    cursor = r.next;
  }
  return { items, complete: false };
}
