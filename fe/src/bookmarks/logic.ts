// Pure rules for the Bookmarks screen, so they are unit-tested.

export type TypeKey = 'revise_later' | 'doubts' | 'important';
/** Icon order and colours the PM chose: blue ribbon, yellow exclamation, red flag. */
export const TYPE_ORDER: TypeKey[] = ['revise_later', 'doubts', 'important'];
export const TYPE_TONE: Record<TypeKey, 'accent/default' | 'highlight/default' | 'semantic/danger'> = {
  revise_later: 'accent/default',
  doubts: 'highlight/default',
  important: 'semantic/danger',
};

export type Range = { index: number; from: number; to: number; label: string };

/** Ranges of ten: 34 items become 1-10, 11-20, 21-30, 31-34. */
export function rangesOf(total: number, size = 10): Range[] {
  const out: Range[] = [];
  for (let from = 1; from <= total; from += size) {
    const to = Math.min(total, from + size - 1);
    out.push({ index: out.length, from, to, label: `${from}-${to}` });
  }
  return out;
}

/** Selecting specific items replaces "All"; clearing every choice goes back to All (an empty list). */
export function toggleChoice(chosen: string[], id: string): string[] {
  return chosen.includes(id) ? chosen.filter((x) => x !== id) : [...chosen, id];
}

/** Tapping the one type icon filters to it; tapping it again clears the filter. */
export const toggleSingleType = (chosen: string[], id: string): string[] => (chosen.length === 1 && chosen[0] === id ? [] : [id]);

/** The rows on screen for a range tab, numbered from the start of the whole list. */
export function pageRows<T>(rows: T[], range: Range | undefined): { n: number; row: T }[] {
  if (!range) return [];
  return rows.slice(range.from - 1, range.to).map((row, i) => ({ n: range.from + i, row }));
}

/** Biology, Chemistry, Physics first, whatever order the server sent. */
export function subjectOrder<T extends { name: string }>(subjects: T[]): T[] {
  const rank = (n: string) => ['biology', 'chemistry', 'physics'].indexOf(n.trim().toLowerCase());
  return [...subjects].sort((a, b) => {
    const ra = rank(a.name) < 0 ? 9 : rank(a.name);
    const rb = rank(b.name) < 0 ? 9 : rank(b.name);
    return ra - rb || a.name.localeCompare(b.name);
  });
}
