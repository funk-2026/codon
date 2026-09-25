import type { Blueprint, BlueprintFilters, BlueprintIssue, Difficulty } from '@/src/api/customTests';

/**
 * Blueprint state, defaults and validation for the custom-test builder.
 *
 * `validateBlueprint` mirrors the server's `blueprint.Normalize` and is tested
 * against the shared golden vectors (contracts/blueprint-v1/vectors.json), so
 * the builder can show field errors instantly and the two sides can't drift
 * apart unnoticed. The server stays the authority: it re-validates everything.
 */

export const CURRENT_SCHEMA_VERSION = 1;

export type Limits = {
  min_questions: number;
  max_questions: number;
  min_duration: number;
  max_duration: number;
  allowed_sources: string[];
  tutor_enabled: boolean;
  status_filters_enabled: boolean;
};

const DIFFICULTIES = ['easy', 'medium', 'hard'];
const STATUSES = ['unattempted', 'incorrect', 'correct', 'bookmarked'];
const ORDERS = ['random', 'syllabus', 'easy_first', 'hard_first', 'unattempted_first'];
const STRATEGIES = ['random', 'weak_first', 'unseen_first', 'spaced'];
const FILTER_KEYS = new Set([
  'subject_ids', 'chapter_ids', 'topic_ids', 'difficulty', 'status', 'bookmark_collection_ids', 'tag_ids',
  'exclude_tag_ids', 'source_types', 'ncert', 'exclude_attempted_within_days',
]);
const SOURCES = ['qbank', 'practice', 'pyq', 'test_series', 'other'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function defaultBlueprint(courseId: string, count = 20): Blueprint {
  return {
    schema_version: CURRENT_SCHEMA_VERSION,
    course_id: courseId,
    filters: {},
    count,
    mode: 'exam',
    timing: { timed: false },
    marking: { preset: 'neet' },
  };
}

/** Returns the issues the server would raise (same `field`/`code`). Empty = valid. */
export function validateBlueprint(input: any, lim: Limits): BlueprintIssue[] {
  const is: BlueprintIssue[] = [];
  const add = (field: string, code: string, message: string) => is.push({ field, code, message });
  const bp = input ?? {};

  if (bp.schema_version != null && bp.schema_version > CURRENT_SCHEMA_VERSION) {
    return [{ field: 'schema_version', code: 'unsupported_schema_version', message: `blueprint version ${bp.schema_version} is newer than this app understands` }];
  }
  if (bp.filters && typeof bp.filters === 'object') {
    for (const k of Object.keys(bp.filters)) {
      if (!FILTER_KEYS.has(k)) return [{ field: 'filters', code: 'unknown_filter', message: `unsupported filter: ${k}` }];
    }
  }

  if (!bp.course_id || bp.course_id === '00000000-0000-0000-0000-000000000000') add('course_id', 'required', 'course_id is required');
  if ([...(bp.title ?? '')].length > 120) add('title', 'too_long', 'title must be at most 120 characters');

  const f: BlueprintFilters = bp.filters ?? {};
  for (const [name, ids] of Object.entries({
    subject_ids: f.subject_ids, chapter_ids: f.chapter_ids, topic_ids: f.topic_ids, tag_ids: f.tag_ids, exclude_tag_ids: f.exclude_tag_ids,
  })) {
    if ((ids?.length ?? 0) > 200) add(`filters.${name}`, 'too_many', 'at most 200 ids allowed');
  }
  for (const d of f.difficulty ?? []) if (!DIFFICULTIES.includes(d)) add('filters.difficulty', 'bad_enum', 'difficulty must be easy, medium or hard');
  for (const s of f.status ?? []) if (!STATUSES.includes(s)) add('filters.status', 'bad_enum', `status must be one of ${STATUSES.join(', ')}`);
  if ((f.status?.length ?? 0) > 0 && !lim.status_filters_enabled) add('filters.status', 'filter_unavailable', 'question-status filters are not enabled yet');
  if ((f.bookmark_collection_ids?.length ?? 0) > 0 && !(f.status ?? []).includes('bookmarked')) {
    add('filters.bookmark_collection_ids', 'needs_bookmarked_status', 'bookmark_collection_ids only applies together with status "bookmarked"');
  }
  for (const st of f.source_types ?? []) {
    if (!SOURCES.includes(st)) add('filters.source_types', 'bad_enum', `unknown source type: ${st}`);
    else if (!lim.allowed_sources.includes(st)) add('filters.source_types', 'source_not_allowed', `${st} questions are not available for custom tests`);
  }
  const n = f.ncert;
  if (n) {
    if (n.page_from != null && n.page_to != null && n.page_from > n.page_to) add('filters.ncert', 'bad_range', 'page_from must be <= page_to');
    if (n.class != null && (n.class < 1 || n.class > 12)) add('filters.ncert.class', 'out_of_range', 'class must be between 1 and 12');
  }
  if (f.exclude_attempted_within_days != null && (f.exclude_attempted_within_days < 0 || f.exclude_attempted_within_days > 365)) {
    add('filters.exclude_attempted_within_days', 'out_of_range', 'must be between 0 and 365');
  }

  if (!(bp.count >= lim.min_questions && bp.count <= lim.max_questions)) {
    add('count', 'out_of_range', `count must be between ${lim.min_questions} and ${lim.max_questions}`);
  }

  const mix = bp.difficulty_mix as Record<string, number> | undefined;
  if (mix && Object.keys(mix).length > 0) {
    let sum = 0;
    let bad = false;
    for (const [k, v] of Object.entries(mix)) {
      if (!DIFFICULTIES.includes(k) || v < 0 || v > 1) bad = true;
      sum += v;
    }
    if (bad) add('difficulty_mix', 'invalid', 'mix keys are easy/medium/hard with weights between 0 and 1');
    if (Math.abs(sum - 1) > 0.02) add('difficulty_mix', 'must_sum_to_one', 'difficulty_mix weights must add up to 1');
  }

  const sw = bp.subject_weights;
  if (sw != null) {
    if (typeof sw === 'string') {
      if (sw !== 'even' && sw !== 'proportional') add('subject_weights', 'invalid', 'subject_weights must be "even", "proportional" or a map of subject id → weight');
    } else if (typeof sw === 'object' && !Array.isArray(sw)) {
      for (const [k, v] of Object.entries(sw as Record<string, number>)) {
        if (!UUID.test(k) || !(typeof v === 'number') || v < 0) {
          add('subject_weights', 'invalid', 'weights are keyed by subject uuid with values >= 0');
          break;
        }
      }
    } else add('subject_weights', 'invalid', 'subject_weights must be a map of subject id → weight');
  }

  if (bp.order && !ORDERS.includes(bp.order)) add('order', 'bad_enum', `order must be one of ${ORDERS.join(', ')}`);
  if (bp.strategy && !STRATEGIES.includes(bp.strategy)) add('strategy', 'bad_enum', `strategy must be one of ${STRATEGIES.join(', ')}`);
  if (bp.fallback && bp.fallback !== 'fewer' && bp.fallback !== 'fail') add('fallback', 'bad_enum', 'fallback must be fewer or fail');

  const mode = bp.mode || 'exam';
  if (mode !== 'exam' && mode !== 'tutor') add('mode', 'bad_enum', 'mode must be exam or tutor');
  else if (mode === 'tutor' && !lim.tutor_enabled) add('mode', 'mode_unavailable', 'tutor mode is not enabled yet');

  if (bp.timing?.timed) {
    const d = bp.timing.duration_minutes ?? 0;
    if (d < lim.min_duration || d > lim.max_duration) add('timing.duration_minutes', 'out_of_range', `duration must be between ${lim.min_duration} and ${lim.max_duration} minutes`);
  }

  const m = bp.marking ?? {};
  const preset = m.preset || 'neet';
  if (preset === 'custom') {
    if (m.correct == null || m.wrong == null) add('marking', 'required', 'custom marking needs correct and wrong');
    else if (m.correct <= 0 || m.correct > 10 || m.wrong > 0 || m.wrong < -10) add('marking', 'out_of_range', 'correct must be in (0, 10] and wrong in [-10, 0]');
  } else if (preset !== 'neet' && preset !== 'no_negative') add('marking.preset', 'bad_enum', 'preset must be neet, no_negative or custom');

  return is;
}

/** The (correct, wrong) marks a blueprint resolves to — mirrors `Blueprint.Marks()` after Normalize. */
export function resolvedMarks(bp: Blueprint): { correct: number; wrong: number } {
  switch (bp.marking?.preset ?? 'neet') {
    case 'no_negative': return { correct: 1, wrong: 0 };
    case 'custom': return { correct: bp.marking.correct ?? 4, wrong: bp.marking.wrong ?? -1 };
    default: return { correct: 4, wrong: -1 };
  }
}

/** Suggested duration: minutes-per-question × count, clamped to the allowed range. */
export function suggestedMinutes(count: number, perQuestion: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.ceil(count * perQuestion)));
}

// ── immutable edit helpers (the builder reducer builds on these) ────────────

export function toggleInList<T>(list: T[] | undefined, value: T): T[] {
  const cur = list ?? [];
  return cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value];
}

/** Drop empty arrays/objects so equal filters serialise identically (stable count-cache keys, tidy blueprints). */
export function pruneFilters(f: BlueprintFilters): BlueprintFilters {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(f)) {
    if (Array.isArray(v) && v.length === 0) continue;
    if (v == null) continue;
    if (k === 'ncert' && typeof v === 'object' && Object.values(v).every((x) => x == null)) continue;
    if (k === 'exclude_attempted_within_days' && v === 0) continue;
    out[k] = v;
  }
  return out as BlueprintFilters;
}

/** Filter state as a string — the key for count-request dedupe/caching. */
export function blueprintKey(bp: Blueprint): string {
  return JSON.stringify({ ...bp, filters: pruneFilters(bp.filters ?? {}), title: undefined });
}

export function withDifficultyMix(bp: Blueprint, mix: Partial<Record<Difficulty, number>> | undefined): Blueprint {
  const next = { ...bp };
  if (!mix || Object.keys(mix).length === 0) delete next.difficulty_mix;
  else next.difficulty_mix = mix;
  return next;
}

/**
 * Chapter/subject/topic selection is hierarchical: picking a whole subject
 * makes its chapters redundant. `normalizeSelection` removes ids already
 * covered by a broader selection so the blueprint says one thing once.
 */
export function normalizeSelection(
  f: BlueprintFilters,
  tree: { id: string; chapters: { id: string; topics: { id: string }[] }[] }[],
): BlueprintFilters {
  const subj = new Set(f.subject_ids ?? []);
  const chap = new Set(f.chapter_ids ?? []);
  const chapterOfTopic = new Map<string, string>();
  const subjectOfChapter = new Map<string, string>();
  for (const s of tree) for (const c of s.chapters) {
    subjectOfChapter.set(c.id, s.id);
    for (const t of c.topics) chapterOfTopic.set(t.id, c.id);
  }
  const chapter_ids = (f.chapter_ids ?? []).filter((c) => !subj.has(subjectOfChapter.get(c) ?? ''));
  const chapKeep = new Set(chapter_ids);
  const topic_ids = (f.topic_ids ?? []).filter((t) => {
    const c = chapterOfTopic.get(t);
    return !(c && (chap.has(c) && chapKeep.has(c))) && !subj.has(subjectOfChapter.get(c ?? '') ?? '');
  });
  return pruneFilters({ ...f, chapter_ids, topic_ids });
}

/**
 * Apply a server suggestion/recommendation patch (a partial blueprint) to a
 * blueprint: top-level keys replace, `filters` merges key-by-key, and a `null`
 * value removes the key (e.g. `{"filters": {"ncert": null}}`).
 */
export function applyPatch(bp: Blueprint, patch: Record<string, unknown>): Blueprint {
  const next: Record<string, any> = { ...bp };
  for (const [k, v] of Object.entries(patch)) {
    if (k === 'filters' && v && typeof v === 'object') {
      const merged: Record<string, unknown> = { ...(bp.filters ?? {}) };
      for (const [fk, fv] of Object.entries(v as Record<string, unknown>)) {
        if (fv === null) delete merged[fk];
        else merged[fk] = fv;
      }
      next.filters = pruneFilters(merged as BlueprintFilters);
    } else if (v === null) delete next[k];
    else next[k] = v;
  }
  return next as Blueprint;
}

/** One-line human summary of a blueprint, for cards and share sheets. */
export function summarizeBlueprint(bp: Blueprint, names: { subjects?: Record<string, string> } = {}): string {
  const parts: string[] = [`${bp.count} Qs`];
  const subj = (bp.filters?.subject_ids ?? []).map((id) => names.subjects?.[id]).filter(Boolean) as string[];
  if (subj.length) parts.push(subj.slice(0, 2).join(', ') + (subj.length > 2 ? ` +${subj.length - 2}` : ''));
  else if ((bp.filters?.chapter_ids?.length ?? 0) > 0) parts.push(`${bp.filters.chapter_ids!.length} chapter${bp.filters.chapter_ids!.length > 1 ? 's' : ''}`);
  if (bp.filters?.difficulty?.length) parts.push(bp.filters.difficulty.join('/'));
  parts.push(bp.timing?.timed ? `${bp.timing.duration_minutes} min` : 'untimed');
  if (bp.mode === 'tutor') parts.push('tutor');
  return parts.join(' · ');
}
