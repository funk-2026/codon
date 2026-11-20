import type { SchemaChapter, SchemaOverview, SchemaStatus, SchemaSubject, SchemaTopic } from '@/src/api/study';

/** Pulse and Flashcards open to All / Physics / Chemistry / Biology. Everything else uses Biology / Chemistry / Physics. */
export const LOCAL_SUBJECTS = ['All', 'Physics', 'Chemistry', 'Biology'] as const;
export type LocalSubject = (typeof LOCAL_SUBJECTS)[number];

export type ChapterItem = { chapter_id: string; chapter_name: string; chapter_order: number; subject_name: string };
export type ChapterGroup<T> = { id: string; name: string; subject: string; items: T[] };

/** Groups rows under their chapter in syllabus order. A subject filter of "All" keeps every subject; subjects then appear in the local order. */
export function groupByChapter<T extends ChapterItem>(items: T[], subject: LocalSubject, chapterIds: string[] = []): ChapterGroup<T>[] {
  const rank = (s: string) => {
    const i = LOCAL_SUBJECTS.indexOf(s as LocalSubject);
    return i < 0 ? 99 : i;
  };
  const keep = items.filter((i) => (subject === 'All' || i.subject_name === subject) && (chapterIds.length === 0 || chapterIds.includes(i.chapter_id)));
  const m = new Map<string, ChapterGroup<T> & { order: number }>();
  for (const it of keep) {
    const g = m.get(it.chapter_id) ?? { id: it.chapter_id, name: it.chapter_name, subject: it.subject_name, items: [], order: it.chapter_order };
    g.items.push(it);
    m.set(it.chapter_id, g);
  }
  return [...m.values()].sort((a, b) => rank(a.subject) - rank(b.subject) || a.order - b.order || a.name.localeCompare(b.name)).map(({ order: _o, ...g }) => g);
}

/** Counts per subject for the landing rows. */
export const countBySubject = (items: ChapterItem[], subject: LocalSubject) => items.filter((i) => subject === 'All' || i.subject_name === subject).length;

/** What the search box looks for: the item title or its chapter. */
export const searchMatch = (title: string, chapter: string, q: string) => {
  const s = q.trim().toLowerCase();
  return !s || title.toLowerCase().includes(s) || chapter.toLowerCase().includes(s);
};

/** One minute per Pulse item, then the next. Returns the index after `i`, or null on the last item (the reader returns to the list). */
export const nextPulseIndex = (i: number, total: number): number | null => (i + 1 < total ? i + 1 : null);
export const PULSE_SECONDS = 60;

// ── Schema ───────────────────────────────────────────────────────────────────
export const STATUS_ORDER: SchemaStatus[] = ['yet_to_read', 'yet_to_revise', 'confident'];
export const STATUS_LABEL: Record<SchemaStatus, string> = { yet_to_read: 'Yet to read', yet_to_revise: 'Yet to revise', confident: 'Confident' };
export const STATUS_TONE: Record<SchemaStatus, 'semantic/danger' | 'semantic/warning' | 'semantic/success'> = {
  yet_to_read: 'semantic/danger', yet_to_revise: 'semantic/warning', confident: 'semantic/success',
};

export type Progress = { confident: number; total: number };
export const topicsOf = (c: SchemaChapter) => c.topics;
export const chapterProgress = (c: SchemaChapter): Progress => ({ total: c.topics.length, confident: c.topics.filter((t) => t.status === 'confident').length });
export const subjectProgress = (s: SchemaSubject): Progress =>
  s.chapters.reduce<Progress>((p, c) => { const x = chapterProgress(c); return { total: p.total + x.total, confident: p.confident + x.confident }; }, { confident: 0, total: 0 });
/** How many topics sit in each status, for the chapter and subject bars. */
export type StatusCounts = Record<SchemaStatus, number>;
export const statusCounts = (topics: SchemaTopic[]): StatusCounts =>
  topics.reduce<StatusCounts>((n, t) => ({ ...n, [t.status]: n[t.status] + 1 }), { yet_to_read: 0, yet_to_revise: 0, confident: 0 });
export const subjectStatusCounts = (s: SchemaSubject): StatusCounts => statusCounts(s.chapters.flatMap((c) => c.topics));
/** The topics a status filter lets through. `all` lets every topic through. */
export type StatusFilter = 'all' | SchemaStatus;
export const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [{ key: 'all', label: 'All' }, ...STATUS_ORDER.map((k) => ({ key: k, label: STATUS_LABEL[k] }))];
export const matchesStatus = (t: SchemaTopic, f: StatusFilter) => f === 'all' || t.status === f;
export const progressText = (p: Progress) => `${p.confident}/${p.total} confident`;

export type SchemaSort = 'idx' | 'frq';
/** Questions asked on a topic, limited to the chosen years when there are any. */
export const topicCount = (t: SchemaTopic, years: string[]) => (years.length === 0 ? t.total : years.reduce((n, y) => n + (t.by_year[y] ?? 0), 0));
/** Idx keeps syllabus order; Frq puts the most-asked topics first, ties keeping syllabus order. */
export function sortTopics<T extends { topic: SchemaTopic }>(rows: T[], sort: SchemaSort, years: string[] = []): T[] {
  if (sort === 'idx') return rows;
  return rows.map((r, i) => ({ r, i })).sort((a, b) => topicCount(b.r.topic, years) - topicCount(a.r.topic, years) || a.i - b.i).map((x) => x.r);
}

// ── Weightage: how often a topic, chapter or subject has been asked ──────────
/** 0 to 1: this much against the biggest in its group, eased so mid-sized topics still show a visible shade. */
export const heat = (value: number, max: number): number => (max > 0 && value > 0 ? Math.pow(Math.min(1, value / max), 0.7) : 0);
/** Questions asked in a chapter (limited to the chosen years when there are any). */
export const chapterAsked = (c: SchemaChapter, years: string[] = []) => c.topics.reduce((n, t) => n + topicCount(t, years), 0);
export const subjectAsked = (s: SchemaSubject, years: string[] = []) => s.chapters.reduce((n, c) => n + chapterAsked(c, years), 0);
/** A subject's share of all questions asked, as a whole percentage. */
export const shareOf = (value: number, total: number) => (total > 0 ? Math.round((value * 100) / total) : 0);

export type SchemaFilter = { years: string[]; subjectIds: string[]; chapterIds: string[]; statuses: SchemaStatus[] };
export const EMPTY_FILTER: SchemaFilter = { years: [], subjectIds: [], chapterIds: [], statuses: [] };
export const filterActive = (f: SchemaFilter) => f.years.length + f.subjectIds.length + f.chapterIds.length + f.statuses.length > 0;

export type FlatTopic = { topic: SchemaTopic; subject: string; subjectId: string; chapter: string; chapterId: string };
export const flattenSchema = (o: SchemaOverview): FlatTopic[] =>
  o.subjects.flatMap((s) => s.chapters.flatMap((c) => c.topics.map((topic) => ({ topic, subject: s.name, subjectId: s.id, chapter: c.name, chapterId: c.id }))));

/**
 * Topic-level rows across the chosen subjects and chapters. An empty group means All. With years chosen, only topics asked in those
 * years remain. Chapters apply inside their ticked subject only.
 */
export function applySchemaFilter(rows: FlatTopic[], f: SchemaFilter): FlatTopic[] {
  return rows.filter((r) => {
    if (f.subjectIds.length && !f.subjectIds.includes(r.subjectId)) return false;
    if (f.chapterIds.length && !f.chapterIds.includes(r.chapterId)) return false;
    if (f.statuses.length && !f.statuses.includes(r.topic.status)) return false;
    if (f.years.length && topicCount(r.topic, f.years) === 0) return false;
    return true;
  });
}

export function filterSummary(f: SchemaFilter, o: SchemaOverview): string {
  const parts: string[] = [];
  if (f.years.length) parts.push(f.years.join(', '));
  if (f.subjectIds.length) parts.push(o.subjects.filter((s) => f.subjectIds.includes(s.id)).map((s) => s.name).join(', '));
  if (f.chapterIds.length) parts.push(`${f.chapterIds.length} chapter${f.chapterIds.length === 1 ? '' : 's'}`);
  if (f.statuses.length) parts.push(f.statuses.map((s) => STATUS_LABEL[s]).join(', '));
  return parts.join(' · ');
}

/** Toggles one value in a multi-select group; an empty group means All. */
export const toggle = <T,>(list: T[], v: T): T[] => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

/** Replaces one topic's status inside a cached overview, so a change in one place shows in the others at once. */
export function withStatus(o: SchemaOverview, topicId: string, status: SchemaStatus): SchemaOverview {
  return { ...o, subjects: o.subjects.map((s) => ({ ...s, chapters: s.chapters.map((c) => ({ ...c, topics: c.topics.map((t) => (t.id === topicId ? { ...t, status } : t)) })) })) };
}

// ── Admin import ─────────────────────────────────────────────────────────────
/** Reads pasted CSV text: subject,chapter,topic,year,subtopic,questions. Quotes may hold commas. */
export function parseSchemaCsv(text: string): { rows: import('@/src/api/study').SchemaImportRow[]; errors: string[] } {
  const rows: import('@/src/api/study').SchemaImportRow[] = [];
  const errors: string[] = [];
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  lines.forEach((line, idx) => {
    const cells: string[] = [];
    let cur = '';
    let q = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (q && line[i + 1] === '"') { cur += '"'; i++; } else q = !q;
      } else if (ch === ',' && !q) { cells.push(cur.trim()); cur = ''; } else cur += ch;
    }
    cells.push(cur.trim());
    if (idx === 0 && /^subject$/i.test(cells[0])) return;
    if (cells.length < 6) { errors.push(`Line ${idx + 1}: needs 6 columns (subject, chapter, topic, year, subtopic, questions)`); return; }
    const questions = Number(cells[5]);
    if (!Number.isInteger(questions) || questions < 0) { errors.push(`Line ${idx + 1}: questions must be a whole number`); return; }
    rows.push({ subject: cells[0], chapter: cells[1], topic: cells[2], year: cells[3], subtopic: cells[4], questions });
  });
  return { rows, errors };
}
