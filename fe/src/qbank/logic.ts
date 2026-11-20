import type { QBankModule, QBankSubject } from '@/src/api/qbank';

export type QBankFilter = 'all' | 'free' | 'paused' | 'completed' | 'unattempted';
export const QBANK_FILTERS: { key: QBankFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'free', label: 'Free' },
  { key: 'paused', label: 'Paused' },
  { key: 'completed', label: 'Completed' },
  { key: 'unattempted', label: 'Unattempted' },
];

export function moduleMatches(m: QBankModule, f: QBankFilter): boolean {
  if (f === 'all') return true;
  if (f === 'free') return !m.requires_subscription;
  return m.state === f;
}

/** "6 / 20 modules completed" */
export const progressLine = (s: Pick<QBankSubject, 'completed' | 'total'>) => `${s.completed} / ${s.total} modules completed`;
export const progressFraction = (s: Pick<QBankSubject, 'completed' | 'total'>) => (s.total > 0 ? s.completed / s.total : 0);

/** "Living world 72%" for a solved module, the plain name otherwise. */
export const moduleTitle = (m: QBankModule) => (m.state === 'completed' && m.score_pct != null ? `${m.chapter_name} ${m.score_pct}%` : m.chapter_name);

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "22 Sep 2026", the same on every phone. */
export const shortDate = (iso: string) => {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
};

/** "Solved on 22 Sep 2026" */
export const solvedLine = (m: QBankModule) =>
  m.state === 'completed' && m.solved_at
    ? `Solved on ${shortDate(m.solved_at)}`
    : '';

export type QBankHit = { key: string; kind: 'subject' | 'chapter'; title: string; sub: string; subjectId: string; testId?: string };

/** Subjects and chapters whose name contains the text. Subjects come first, in the order given. */
export function searchQBank(subjects: import('@/src/api/qbank').QBankSubject[], q: string): QBankHit[] {
  const s = q.trim().toLowerCase();
  if (!s) return [];
  const out: QBankHit[] = [];
  for (const sj of subjects) {
    if (sj.name.toLowerCase().includes(s)) out.push({ key: `s${sj.subject_id}`, kind: 'subject', title: sj.name, sub: `${sj.completed} / ${sj.total} modules`, subjectId: sj.subject_id });
  }
  for (const sj of subjects) {
    for (const m of sj.modules) {
      if (`${m.chapter_name} ${m.title}`.toLowerCase().includes(s)) out.push({ key: m.test_id, kind: 'chapter', title: m.chapter_name || m.title, sub: `${sj.name} · ${m.mcq_count} MCQs`, subjectId: sj.subject_id, testId: m.test_id });
    }
  }
  return out;
}
