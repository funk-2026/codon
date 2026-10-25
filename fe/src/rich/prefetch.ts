import { mediaRefs } from './parse';

type Q = { question_text: string; option_a: string; option_b: string; option_c: string; option_d: string; content_format?: string };

/**
 * Media ids an attempt needs, in reading order starting at `from` and wrapping
 * around — so the next questions' images are fetched first (FE-1.10).
 */
export function prefetchOrder(questions: Q[], from: number): string[] {
  const n = questions.length;
  const seen = new Set<string>();
  const out: string[] = [];
  for (let k = 0; k < n; k++) {
    const q = questions[(from + k) % n];
    for (const field of [q.question_text, q.option_a, q.option_b, q.option_c, q.option_d]) {
      for (const id of mediaRefs(field ?? '', q.content_format)) {
        if (!seen.has(id)) {
          seen.add(id);
          out.push(id);
        }
      }
    }
  }
  return out;
}
