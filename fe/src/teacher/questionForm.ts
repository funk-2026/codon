import type { CreateQuestionRequest } from '@/src/api/teacher';
import type { AuthoredQuestion } from '@/src/api/tests';
import { hasContent, mediaRefs } from '@/src/rich/parse';
import type { QuestionDraft } from '@/src/storage/drafts';

export type FormLimits = {
  max_stem_chars: number;
  max_option_chars: number;
  max_explanation_chars: number;
  max_images_per_question: number;
  max_images_per_field: number;
};

export const DEFAULT_LIMITS: FormLimits = {
  max_stem_chars: 2000, max_option_chars: 500, max_explanation_chars: 4000, max_images_per_question: 6, max_images_per_field: 3,
};

export type FormDraft = Omit<QuestionDraft, 'updatedAt'>;

export const EMPTY_DRAFT: FormDraft = {
  question_text: '', option_a: '', option_b: '', option_c: '', option_d: '', correct_option: '', explanation: '',
  difficulty: '', source_type: 'qbank', custom_eligible: true, tags: [],
};

export type FieldErrors = Partial<Record<'question_text' | 'option_a' | 'option_b' | 'option_c' | 'option_d' | 'correct_option' | 'explanation' | 'ncert_class' | 'ncert_page' | 'source_year' | 'images', string>>;

const OPTION_KEYS = ['option_a', 'option_b', 'option_c', 'option_d'] as const;

/**
 * Client-side mirror of the server's authoring rules, so errors show next to
 * the field instead of after a failed save. The server remains the authority.
 * An option may be text, an image, or both — but never empty.
 */
export function validateDraft(d: FormDraft, lim: FormLimits = DEFAULT_LIMITS): FieldErrors {
  const e: FieldErrors = {};
  if (!hasContent(d.question_text, 'rich_v1')) e.question_text = 'Write the question (text or an image).';
  else if (d.question_text.length > lim.max_stem_chars) e.question_text = `Too long — at most ${lim.max_stem_chars} characters.`;

  for (const k of OPTION_KEYS) {
    const v = d[k];
    if (!hasContent(v, 'rich_v1')) e[k] = 'This option is empty.';
    else if (v.length > lim.max_option_chars) e[k] = `Too long — at most ${lim.max_option_chars} characters.`;
  }
  // identical options are almost always a copy-paste slip
  const texts = OPTION_KEYS.map((k) => d[k].trim().toLowerCase());
  for (let i = 0; i < 4; i++) {
    if (texts[i] && texts.findIndex((t) => t === texts[i]) !== i && !e[OPTION_KEYS[i]]) e[OPTION_KEYS[i]] = 'Same as an earlier option.';
  }
  if (!d.correct_option) e.correct_option = 'Mark the correct answer.';
  if (d.explanation.length > lim.max_explanation_chars) e.explanation = `Too long — at most ${lim.max_explanation_chars} characters.`;

  const imgs = new Set([d.question_text, ...OPTION_KEYS.map((k) => d[k]), d.explanation].flatMap((t) => mediaRefs(t, 'rich_v1')));
  if (imgs.size > lim.max_images_per_question) e.images = `At most ${lim.max_images_per_question} images per question.`;

  if (d.ncert_class && !(Number(d.ncert_class) >= 1 && Number(d.ncert_class) <= 12)) e.ncert_class = 'Class must be 1–12.';
  if (d.ncert_page && !(Number(d.ncert_page) >= 1 && Number(d.ncert_page) <= 2000)) e.ncert_page = 'Enter a valid page number.';
  if (d.source_year && !(Number(d.source_year) >= 1950 && Number(d.source_year) <= new Date().getFullYear() + 1)) e.source_year = 'Enter a valid year.';
  return e;
}

export const isValid = (e: FieldErrors) => Object.keys(e).length === 0;

/** Non-blocking suggestions shown before saving (the server also returns its own warnings). */
export function softWarnings(d: FormDraft): string[] {
  const w: string[] = [];
  if (!d.explanation.trim()) w.push('No explanation — students learn most from one.');
  if (!d.difficulty) w.push('No difficulty set — the question can’t be used for difficulty-based custom tests.');
  if (!d.chapter_id) w.push('No chapter set — it won’t appear in chapter-wise custom tests.');
  return w;
}

const num = (s?: string) => (s && s.trim() !== '' && !Number.isNaN(Number(s)) ? Number(s) : undefined);

export function toRequest(d: FormDraft): CreateQuestionRequest {
  const r: CreateQuestionRequest = {
    content_format: 'rich_v1',
    question_text: d.question_text.trim(),
    option_a: d.option_a.trim(), option_b: d.option_b.trim(), option_c: d.option_c.trim(), option_d: d.option_d.trim(),
    correct_option: d.correct_option,
    explanation: d.explanation.trim(),
    custom_eligible: d.custom_eligible ?? true,
    tags: d.tags ?? [],
  };
  if (d.subject_id) r.subject_id = d.subject_id;
  if (d.chapter_id) r.chapter_id = d.chapter_id;
  if (d.topic_id) r.topic_id = d.topic_id;
  if (d.difficulty) r.difficulty = d.difficulty;
  const c = num(d.ncert_class); if (c != null) r.ncert_class = c;
  const p = num(d.ncert_page); if (p != null) r.ncert_page = p;
  if (d.source_type) r.source_type = d.source_type;
  const y = num(d.source_year); if (y != null) r.source_year = y;
  if (d.source_label?.trim()) r.source_label = d.source_label.trim();
  return r;
}

export function fromQuestion(q: AuthoredQuestion): FormDraft {
  return {
    question_text: q.question_text, option_a: q.option_a, option_b: q.option_b, option_c: q.option_c, option_d: q.option_d,
    correct_option: q.correct_option, explanation: q.explanation ?? '',
    subject_id: q.subject_id, chapter_id: q.chapter_id, topic_id: q.topic_id,
    difficulty: q.difficulty ?? '',
    ncert_class: q.ncert_class != null ? String(q.ncert_class) : '', ncert_page: q.ncert_page != null ? String(q.ncert_page) : '',
    source_type: q.source_type ?? 'qbank', source_year: q.source_year != null ? String(q.source_year) : '', source_label: q.source_label ?? '',
    custom_eligible: q.custom_eligible ?? true,
    tags: (q.tags ?? []).map((t: any) => t.label ?? t.name ?? String(t)),
  };
}

export function isDirty(a: FormDraft, b: FormDraft): boolean {
  const norm = (d: FormDraft) => JSON.stringify({ ...d, tags: [...(d.tags ?? [])].sort() });
  return norm(a) !== norm(b);
}

/** Fields (besides content) a teacher may change on a LIVE question without a review round-trip. */
export const METADATA_ONLY_KEYS = ['subject_id', 'chapter_id', 'topic_id', 'difficulty', 'ncert_class', 'ncert_page', 'source_type', 'source_year', 'source_label', 'custom_eligible', 'tags'] as const;

export function contentChanged(a: FormDraft, b: FormDraft): boolean {
  return (['question_text', 'option_a', 'option_b', 'option_c', 'option_d', 'correct_option', 'explanation'] as const).some((k) => a[k] !== b[k]);
}
