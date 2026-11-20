import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { listVideoCompletions } from '@/src/api/content';
import { listFlashcardActivity, listPulseReads, listSchemaCompletions, type DoneRow } from '@/src/api/study';
import { useAttempts } from '@/src/queries/attempts';
import { lastDays, type ChartPoint } from './chart';
import { dayKey } from './monthCalendar';
import type { AnalysisArea } from './DetailedAnalysisCard';

export const MODULE_OF: Partial<Record<AnalysisArea, string>> = { qbank: 'qbank', tests: 'test_series' };
export type DayItem = { id: string; title: string; where: string; pct?: number };

/**
 * Per-day counts for one area from the student's submitted tests. A module counts once per day it was submitted,
 * so a retake the same day does not add a second. Schema, Pulse and Flashcards come from their own per-student records.
 */
export function useAreaCounts(area: AnalysisArea, daysBack = 14, coverageStart?: string) {
  const attempts = useAttempts();
  const videos = useQuery({ queryKey: ['video-completions'], queryFn: listVideoCompletions, enabled: area === 'video' });
  const done = useQuery({
    queryKey: ['area-done', area],
    queryFn: (): Promise<DoneRow[]> => (area === 'schema' ? listSchemaCompletions() : area === 'pulse' ? listPulseReads() : listFlashcardActivity()),
    enabled: area === 'schema' || area === 'pulse' || area === 'flashcards',
  });
  const isDone = area === 'schema' || area === 'pulse' || area === 'flashcards';
  const mod = MODULE_OF[area];
  const days = useMemo(() => lastDays(daysBack), [daysBack]);
  const byDay = useMemo(() => {
    const m = new Map<string, DayItem[]>();
    for (const a of attempts.data?.attempts ?? []) {
      if (!mod || a.status !== 'submitted' || !a.submitted_at || a.test?.module_type !== mod) continue;
      const k = dayKey(new Date(a.submitted_at));
      const list = m.get(k) ?? [];
      if (list.some((x) => x.id === a.test_id)) continue;
      list.push({
        id: a.test_id,
        title: a.test?.title ?? 'Test',
        where: a.test?.subject?.name ? `${a.test.subject.name} › ${a.test.chapter?.name ?? 'General'}` : a.test?.course?.name ?? '',
        pct: a.total_marks ? Math.round(((a.score ?? 0) / a.total_marks) * 100) : undefined,
      });
      m.set(k, list);
    }
    // Video lectures: each lecture counts once, on the day it was completed.
    if (area === 'video') {
      for (const v of videos.data ?? []) {
        const k = dayKey(new Date(v.completed_at));
        const list = m.get(k) ?? [];
        if (!list.some((x) => x.id === v.id)) list.push({ id: v.id, title: v.title, where: `${v.subject} › ${v.chapter}` });
        m.set(k, list);
      }
    }
    // Schema topics (Confident that day), Pulse items read, and Flashcards last reviewed: one entry per item per day.
    if (isDone) {
      for (const r of done.data ?? []) {
        const k = dayKey(new Date(r.at));
        const list = m.get(k) ?? [];
        if (!list.some((x) => x.id === r.id)) list.push({ id: r.id, title: r.name, where: [r.subject, r.chapter].filter(Boolean).join(' › ') });
        m.set(k, list);
      }
    }
    return m;
  }, [attempts.data, videos.data, done.data, mod, area, isDone]);
  // Days before the student joined were never measured: they are unavailable, not zero.
  const startKey = coverageStart ? dayKey(new Date(coverageStart)) : null;
  const points: ChartPoint[] = days.map((d) => ({ label: d.label, value: byDay.get(d.key)?.length ?? 0, missing: startKey != null && d.key < startKey }));
  const total = points.reduce((n, p) => n + p.value, 0);
  const isVideo = area === 'video';
  const src = isDone ? done : isVideo ? videos : attempts;
  return {
    supported: !!mod || isVideo || isDone, days, byDay, points, total,
    isPending: src.isPending,
    isError: src.isError,
    refetch: src.refetch,
  };
}
