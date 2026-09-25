import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ApiError, newIdempotencyKey } from '@/src/api/client';
import {
  countBlueprint, generateTest, getBuilderConfig,
  type Blueprint, type BuilderConfig, type CountResult, type Difficulty, type GenerateResult, type QuestionStatus,
} from '@/src/api/customTests';
import { track } from '@/src/analytics/track';
import {
  applyPatch, blueprintKey, defaultBlueprint, normalizeSelection, pruneFilters, suggestedMinutes, toggleInList, validateBlueprint,
  type Limits,
} from './blueprint';

export type CountState =
  | { status: 'idle' }
  | { status: 'loading'; previous?: CountResult }
  | { status: 'ready'; data: CountResult }
  | { status: 'rate_limited' }
  | { status: 'error' };

const COUNT_DEBOUNCE_MS = 450;
const COUNT_CACHE_MS = 60_000;

export function limitsFromConfig(c: BuilderConfig): Limits {
  return {
    min_questions: c.limits.min_questions,
    max_questions: c.limits.max_questions,
    min_duration: c.limits.min_duration_minutes,
    max_duration: c.limits.max_duration_minutes,
    allowed_sources: c.sources.map((s) => s.key),
    tutor_enabled: c.flags.tutor_mode,
    status_filters_enabled: c.flags.status_filters,
  };
}

/**
 * Builder state for the custom-test screen (FE-4.x): server-driven config,
 * the blueprint being edited, instant local validation, and a live "how many
 * questions match?" that is debounced, cancellable and cached.
 */
export function useBuilder(courseId: string | undefined, seed?: Blueprint) {
  const [cfgStatus, setCfgStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [cfgError, setCfgError] = useState<ApiError | null>(null);
  const [config, setConfig] = useState<BuilderConfig | null>(null);
  const [bp, setBp] = useState<Blueprint | null>(seed ?? null);
  const [count, setCount] = useState<CountState>({ status: 'idle' });
  const cache = useRef(new Map<string, { at: number; data: CountResult }>());
  const abort = useRef<AbortController | null>(null);
  const idem = useRef<{ key: string; bpKey: string } | null>(null);
  const seeded = useRef(!!seed);

  const loadConfig = useCallback(async () => {
    if (!courseId) return;
    setCfgStatus('loading');
    setCfgError(null);
    try {
      const c = await getBuilderConfig(courseId);
      setConfig(c);
      setBp((cur) => {
        if (cur) return { ...cur, course_id: courseId };
        const start = defaultBlueprint(courseId, Math.min(20, c.limits.max_questions));
        return start;
      });
      setCfgStatus('ready');
    } catch (e) {
      setCfgError(e as ApiError);
      setCfgStatus('error');
    }
  }, [courseId]);

  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  const limits = useMemo(() => (config ? limitsFromConfig(config) : null), [config]);
  const tier = config?.entitlement.tier;
  // free tier: the server clamps the count, so the UI never offers more
  const maxCount = config ? Math.min(config.limits.max_questions, config.entitlement.max_questions ?? config.limits.max_questions) : 0;

  const issues = useMemo(() => (bp && limits ? validateBlueprint(bp, limits) : []), [bp, limits]);
  const key = useMemo(() => (bp ? blueprintKey(bp) : ''), [bp]);

  // ── live count ──
  useEffect(() => {
    if (!bp || !limits) return;
    if (issues.length > 0) {
      setCount({ status: 'idle' });
      return;
    }
    const hit = cache.current.get(key);
    if (hit && Date.now() - hit.at < COUNT_CACHE_MS) {
      setCount({ status: 'ready', data: hit.data });
      return;
    }
    setCount((c) => ({ status: 'loading', previous: c.status === 'ready' ? c.data : c.status === 'loading' ? c.previous : undefined }));
    const t = setTimeout(async () => {
      abort.current?.abort();
      const ctl = new AbortController();
      abort.current = ctl;
      try {
        const data = await countBlueprint(bp, ctl.signal);
        cache.current.set(key, { at: Date.now(), data });
        setCount({ status: 'ready', data });
        if (data.available < (data.clamped_to ?? data.requested)) track('custom.count_shortfall', { available: data.available, requested: data.requested });
      } catch (e: any) {
        if (e?.name === 'AbortError') return;
        if (e instanceof ApiError && e.status === 429) {
          setCount({ status: 'rate_limited' });
          setTimeout(() => setCount((c) => (c.status === 'rate_limited' ? { status: 'idle' } : c)), 8000);
        } else setCount({ status: 'error' });
      }
    }, COUNT_DEBOUNCE_MS);
    return () => {
      clearTimeout(t);
      abort.current?.abort();
    };
    // `key` captures every count-relevant field of bp
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, limits, issues.length]);

  // ── edits (all immutable; every edit yields a normalised, pruned blueprint) ──
  const edit = useCallback((fn: (b: Blueprint) => Blueprint) => setBp((b) => (b ? fn(b) : b)), []);
  const tree = config?.subjects ?? [];

  const setFilters = useCallback(
    (patch: Partial<Blueprint['filters']>) =>
      edit((b) => ({ ...b, filters: normalizeSelection(pruneFilters({ ...b.filters, ...patch }), tree) })),
    [edit, tree],
  );

  const api = {
    toggleSubject: (id: string) => setFilters({ subject_ids: toggleInList(bp?.filters.subject_ids, id) }),
    toggleChapter: (id: string) => setFilters({ chapter_ids: toggleInList(bp?.filters.chapter_ids, id) }),
    toggleTopic: (id: string) => setFilters({ topic_ids: toggleInList(bp?.filters.topic_ids, id) }),
    toggleDifficulty: (d: Difficulty) => setFilters({ difficulty: toggleInList(bp?.filters.difficulty, d) }),
    toggleStatus: (s: QuestionStatus) => {
      const status = toggleInList(bp?.filters.status, s);
      // bookmark collections only make sense together with "bookmarked"
      setFilters({ status, ...(status.includes('bookmarked') ? {} : { bookmark_collection_ids: [] }) });
    },
    toggleSource: (s: string) => setFilters({ source_types: toggleInList(bp?.filters.source_types, s) }),
    toggleCollection: (id: string) => setFilters({ bookmark_collection_ids: toggleInList(bp?.filters.bookmark_collection_ids, id) }),
    toggleTag: (id: string) => setFilters({ tag_ids: toggleInList(bp?.filters.tag_ids, id) }),
    setFilters,
    setCount: (n: number) => edit((b) => ({ ...b, count: Math.max(0, Math.round(n)) })),
    setMode: (m: 'exam' | 'tutor') => edit((b) => ({ ...b, mode: m })),
    setTimed: (timed: boolean) =>
      edit((b) => ({
        ...b,
        timing: timed
          ? { timed: true, duration_minutes: b.timing.duration_minutes || suggestedMinutes(b.count, config?.limits.suggested_minutes_per_question ?? 1, limits?.min_duration ?? 5, limits?.max_duration ?? 180) }
          : { timed: false },
      })),
    setDuration: (m: number) => edit((b) => ({ ...b, timing: { timed: true, duration_minutes: Math.round(m) } })),
    setMarking: (marking: Blueprint['marking']) => edit((b) => ({ ...b, marking })),
    setOrder: (order: Blueprint['order']) => edit((b) => ({ ...b, order })),
    setStrategy: (strategy: Blueprint['strategy']) => edit((b) => ({ ...b, strategy })),
    setTitle: (title: string) => edit((b) => ({ ...b, title })),
    /** Replace the whole blueprint (preset / template / shared code), keeping the course. */
    load: (next: Blueprint) => edit(() => ({ ...next, course_id: courseId ?? next.course_id })),
    patch: (p: Record<string, unknown>) => edit((b) => applyPatch(b, p)),
    reset: () => courseId && config && setBp(defaultBlueprint(courseId, Math.min(20, config.limits.max_questions))),
  };

  // Clamp the count into the allowed window when limits change (e.g. tier resolves after first render).
  useEffect(() => {
    if (!bp || !config || seeded.current) return;
    if (bp.count > maxCount && maxCount > 0) edit((b) => ({ ...b, count: maxCount }));
  }, [bp, config, maxCount, edit]);

  // ── generate ──
  const [generating, setGenerating] = useState(false);
  const generate = useCallback(async (): Promise<GenerateResult> => {
    if (!bp) throw new Error('no blueprint');
    // same intent (same blueprint) ⇒ same idempotency key, so a retry after a dropped response can't create two tests
    if (!idem.current || idem.current.bpKey !== key) idem.current = { key: newIdempotencyKey(), bpKey: key };
    setGenerating(true);
    try {
      const res = await generateTest(bp, idem.current.key);
      track('custom.generated', { count: res.test.total_questions, mode: bp.mode ?? 'exam', timed: !!bp.timing.timed, relaxed: res.relaxations.length, tier: tier ?? 'unknown' });
      idem.current = null;
      cache.current.clear(); // question status changes after generation; drop cached counts
      return res;
    } finally {
      setGenerating(false);
    }
  }, [bp, key, tier]);

  return {
    config, cfgStatus, cfgError, reloadConfig: loadConfig,
    bp, limits, maxCount, tier, issues, count, api, generate, generating,
  };
}
