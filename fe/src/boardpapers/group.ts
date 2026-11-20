import type { ReferenceDoc } from '@/src/api/reference';

export type SubjectGroup = { subject: string; docs: ReferenceDoc[] };
export type BoardGroup = { board: string; subjects: SubjectGroup[] };

const byText = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });

/**
 * Board > subject > documents. Documents inside a subject are newest year first, so the years read down the list.
 * Only what has been uploaded appears; a board, subject or year with no document is simply absent.
 */
export function groupBoardDocs(docs: ReferenceDoc[]): BoardGroup[] {
  const boards = new Map<string, Map<string, ReferenceDoc[]>>();
  for (const d of docs) {
    const b = d.board?.trim() || 'Other';
    const s = d.subject?.trim() || 'General';
    const subjects = boards.get(b) ?? new Map<string, ReferenceDoc[]>();
    subjects.set(s, [...(subjects.get(s) ?? []), d]);
    boards.set(b, subjects);
  }
  return [...boards.entries()]
    .sort(([a], [b]) => byText(a, b))
    .map(([board, subjects]) => ({
      board,
      subjects: [...subjects.entries()]
        .sort(([a], [b]) => byText(a, b))
        .map(([subject, list]) => ({ subject, docs: [...list].sort((x, y) => (y.year ?? 0) - (x.year ?? 0) || byText(x.title, y.title)) })),
    }));
}
