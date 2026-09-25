import { kvDelete, kvGet, kvSet } from './kv';

/**
 * Local drafts for the question editor (FE-2.6). A teacher who is interrupted
 * (call, app switch, crash) gets their half-written question back. Drafts are
 * per test + per question (or "new"), never sent to the server until saved.
 */
export type QuestionDraft = {
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: '' | 'A' | 'B' | 'C' | 'D';
  explanation: string;
  subject_id?: string;
  chapter_id?: string;
  topic_id?: string;
  difficulty?: 'easy' | 'medium' | 'hard' | '';
  ncert_class?: string;
  ncert_page?: string;
  source_type?: string;
  source_year?: string;
  source_label?: string;
  custom_eligible?: boolean;
  tags?: string[];
  updatedAt: number;
};

const key = (testId: string, questionId?: string) => `qdraft:${testId}:${questionId ?? 'new'}`;
const TTL_MS = 14 * 24 * 60 * 60 * 1000;

export async function loadDraft(testId: string, questionId?: string): Promise<QuestionDraft | null> {
  const d = await kvGet<QuestionDraft | null>(key(testId, questionId), null);
  if (!d) return null;
  if (Date.now() - d.updatedAt > TTL_MS) {
    await kvDelete(key(testId, questionId));
    return null;
  }
  return d;
}

export const saveDraft = (testId: string, d: Omit<QuestionDraft, 'updatedAt'>, questionId?: string) =>
  kvSet(key(testId, questionId), { ...d, updatedAt: Date.now() });

export const clearDraft = (testId: string, questionId?: string) => kvDelete(key(testId, questionId));

/** A draft with nothing typed isn't worth restoring. */
export function isBlankDraft(d: Pick<QuestionDraft, 'question_text' | 'option_a' | 'option_b' | 'option_c' | 'option_d' | 'explanation'>): boolean {
  return !(d.question_text.trim() || d.option_a.trim() || d.option_b.trim() || d.option_c.trim() || d.option_d.trim() || d.explanation.trim());
}
