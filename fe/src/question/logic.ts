// Pure helpers shared by every screen that shows a question.

/** "MCQ ID: 5f3a91c2" from the full id: short enough to quote to support. */
export const mcqId = (id: string) => `MCQ ID: ${id.replace(/-/g, '').slice(0, 8)}`;

/** "#ImageBased" for a tag label. */
export const tagChip = (tag: string) => `#${tag.replace(/\s+/g, '')}`;

/** "Sample Textbook, 8th edition" and "Page nos 142-144"; null when the question has no reference. */
export function referenceLines(r: { book?: string | null; edition?: string | null; pages?: string | null }): { title: string; pages?: string } | null {
  const book = r.book?.trim();
  if (!book) return null;
  const edition = r.edition?.trim();
  const pages = r.pages?.trim();
  return { title: edition ? `${book}, ${edition} edition` : book, pages: pages ? `Page nos ${pages}` : undefined };
}

/** What leaves the app when a question is shared: the question and its options, nothing else. */
export function questionShareText(q: { text: string; a: string; b: string; c: string; d: string }): string {
  return `${q.text.trim()}\n\nA. ${q.a}\nB. ${q.b}\nC. ${q.c}\nD. ${q.d}`;
}

/** 120 seconds as "2:00", clamped at 0:00. */
export const timerLabel = (seconds: number) => {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
