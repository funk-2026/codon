import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { CaretLeft, CheckSquare, FlagBanner, ImageSquare, Square, Tag, WarningCircle } from 'phosphor-react-native';
import {
  BottomSheet, EmptyState, ErrorBanner, InputField, PrimaryButton, SecondaryButton, SelectField, SkeletonBlock, TagInput, TextButton, useToast,
} from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { ApiError } from '@/src/api/client';
import { listCourses, getCurriculum, type Subject } from '@/src/api/courses';
import {
  bulkUpdateQuestions, getCompleteness, listQuestionBank, type BulkPatch, type CompletenessRow, type MissingKind, type QuestionBankRow,
} from '@/src/api/questionBank';
import type { Difficulty } from '@/src/api/tests';
import { mediaRefs, plainText } from '@/src/rich';

const PAGE = 25;
type Quick = 'all' | 'reported' | MissingKind;
const QUICK: { key: Quick; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'reported', label: 'Reported' },
  { key: 'difficulty', label: 'No difficulty' },
  { key: 'chapter', label: 'No chapter' },
  { key: 'topic', label: 'No topic' },
  { key: 'tags', label: 'No tags' },
  { key: 'alt_text', label: 'Image without description' },
];

/**
 * The teacher's question bank (FE-2.1/2.9/2.10): every question across their
 * tests, filterable, with a "what's missing" queue and bulk edits (up to 200
 * at once, all-or-nothing on the server).
 */
export default function QuestionBankRoute() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { show } = useToast();

  const [quick, setQuick] = useState<Quick>('all');
  const [difficulty, setDifficulty] = useState<Difficulty | undefined>();
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState<QuestionBankRow[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  const [error, setError] = useState(false);
  const [totals, setTotals] = useState<Record<string, number> | null>(null);
  const [chapters, setChapters] = useState<CompletenessRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    const t = setTimeout(() => setQuery(q.trim()), 350);
    return () => clearTimeout(t);
  }, [q]);

  const params = useMemo(
    () => ({
      q: query || undefined,
      difficulty,
      reported: quick === 'reported' ? true : undefined,
      missing: quick !== 'all' && quick !== 'reported' ? (quick as MissingKind) : undefined,
      limit: PAGE,
    }),
    [quick, difficulty, query],
  );

  const load = useCallback(async () => {
    const my = ++seq.current;
    setLoading(true);
    setError(false);
    try {
      const r = await listQuestionBank(params);
      if (my !== seq.current) return;
      setRows(r.items);
      setCursor(r.next_cursor);
      setSelected(new Set());
    } catch {
      if (my === seq.current) setError(true);
    } finally {
      if (my === seq.current) setLoading(false);
    }
  }, [params]);

  useEffect(() => { void load(); }, [load]);
  useFocusEffect(useCallback(() => {
    getCompleteness().then((r) => { setTotals(r.totals); setChapters(r.chapters); }).catch(() => {});
  }, []));

  const loadMore = async () => {
    if (!cursor || more) return;
    setMore(true);
    try {
      const r = await listQuestionBank({ ...params, cursor });
      setRows((p) => [...p, ...r.items]);
      setCursor(r.next_cursor);
    } catch {
      show('Couldn’t load more.', 'error');
    } finally {
      setMore(false);
    }
  };

  const toggleSel = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else if (n.size < 200) n.add(id); else show('You can edit up to 200 questions at once.', 'error');
      return n;
    });
  const selecting = selected.size > 0;

  const missingLine = totals && (totals.missing_difficulty || totals.missing_topic || totals.missing_tags || totals.missing_alt_text)
    ? [
        totals.missing_difficulty ? `${totals.missing_difficulty} without difficulty` : null,
        totals.missing_tags ? `${totals.missing_tags} untagged` : null,
        totals.missing_alt_text ? `${totals.missing_alt_text} with undescribed images` : null,
      ].filter(Boolean).join(' · ')
    : null;

  const chip = (on: boolean) => ({
    minHeight: 36, paddingHorizontal: space.md, borderRadius: radius.pill, justifyContent: 'center' as const,
    backgroundColor: on ? color('accent/tint') : color('bg/surface'), borderWidth: 1, borderColor: on ? color('accent/default') : color('border/subtle'),
  });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color('bg/canvas') }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.md, paddingTop: space.md }}>
        <Pressable onPress={() => (selecting ? setSelected(new Set()) : router.back())} hitSlop={space.xs} accessibilityRole="button" accessibilityLabel={selecting ? 'Clear selection' : 'Back'} style={{ minWidth: 44, minHeight: 44, justifyContent: 'center' }}>
          <CaretLeft size={24} color={color('text/primary')} />
        </Pressable>
        <Text accessibilityRole="header" style={[type['type/h1'], { color: color('text/primary'), flex: 1 }]}>{selecting ? `${selected.size} selected` : 'Question bank'}</Text>
      </View>

      <View style={{ paddingHorizontal: space.md, marginTop: space.xs }}>
        <InputField label="Search questions" value={q} onChangeText={setQ} autoCorrect={false} />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginTop: space.sm }} contentContainerStyle={{ paddingHorizontal: space.md, gap: space.xs }}>
        {QUICK.map((c) => (
          <Pressable key={c.key} onPress={() => setQuick(c.key)} accessibilityRole="button" accessibilityState={{ selected: quick === c.key }} style={chip(quick === c.key)}>
            <Text style={[type['type/caption'], { color: quick === c.key ? color('accent/default') : color('text/secondary') }]}>{c.label}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginTop: space.xs }} contentContainerStyle={{ paddingHorizontal: space.md, gap: space.xs }}>
        {(['easy', 'medium', 'hard'] as Difficulty[]).map((d) => (
          <Pressable key={d} onPress={() => setDifficulty((cur) => (cur === d ? undefined : d))} accessibilityRole="button" accessibilityState={{ selected: difficulty === d }} style={chip(difficulty === d)}>
            <Text style={[type['type/caption'], { color: difficulty === d ? color('accent/default') : color('text/secondary') }]}>{d}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {missingLine && quick === 'all' ? (
        <Pressable onPress={() => setQuick(totals?.missing_difficulty ? 'difficulty' : totals?.missing_tags ? 'tags' : 'alt_text')} accessibilityRole="button" style={{ marginHorizontal: space.md, marginTop: space.sm, backgroundColor: color('semantic/warning-tint'), borderRadius: radius.md, padding: space.sm }}>
          <Text style={[type['type/caption'], { color: color('text/primary') }]}>Needs attention: {missingLine} — tap to review</Text>
        </Pressable>
      ) : null}

      <ScrollView contentContainerStyle={{ padding: space.md, gap: space.sm, paddingBottom: 140 + insets.bottom }} showsVerticalScrollIndicator={false}>
        {loading ? (
          [0, 1, 2, 3].map((i) => <SkeletonBlock key={i} height={90} radius={radius.md} />)
        ) : error ? (
          <EmptyState icon={<WarningCircle size={32} color={color('semantic/danger')} weight="fill" />} title="Couldn’t load the question bank" description="Check your connection and try again." action={<TextButton label="Retry" onPress={load} />} />
        ) : rows.length === 0 ? (
          <EmptyState icon={<Tag size={32} color={color('text/tertiary')} />} title={quick === 'all' && !query && !difficulty ? 'No questions yet' : 'No questions match'} description={quick === 'all' && !query && !difficulty ? 'Questions you add to your tests appear here.' : 'Try clearing a filter.'} />
        ) : (
          <>
            {rows.map((r) => {
              const on = selected.has(r.id);
              const imgs = new Set([r.question_text, r.option_a, r.option_b, r.option_c, r.option_d, r.explanation ?? ''].flatMap((t) => mediaRefs(t, r.content_format))).size;
              const summary = plainText(r.question_text, r.content_format) || (imgs ? '(image question)' : '(empty)');
              return (
                <Pressable
                  key={r.id}
                  onPress={() => (selecting ? toggleSel(r.id) : router.push({ pathname: '/(teacher)/question-editor', params: { testId: r.test.id, questionId: r.id } }))}
                  onLongPress={() => toggleSel(r.id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  accessibilityHint={selecting ? 'Toggles selection' : 'Opens the question. Long-press to select.'}
                  style={({ pressed }) => ({ backgroundColor: on ? color('accent/tint') : color('bg/surface'), borderRadius: radius.md, padding: space.md, gap: 4, opacity: pressed ? 0.94 : 1, borderWidth: on ? 1.5 : 0, borderColor: color('accent/default') })}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                    {selecting ? (on ? <CheckSquare size={20} weight="fill" color={color('accent/default')} /> : <Square size={20} color={color('text/tertiary')} />) : null}
                    <Text style={[type['type/caption'], { color: color('text/tertiary'), flex: 1 }]} numberOfLines={1}>{r.test.title}</Text>
                    {imgs > 0 ? <ImageSquare size={14} color={color('text/tertiary')} /> : null}
                    {r.report_count > 0 ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                        <FlagBanner size={14} weight="fill" color={color('semantic/danger')} />
                        <Text style={[type['type/caption'], { color: color('semantic/danger') }]}>{r.report_count}</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={[type['type/body-m'], { color: color('text/primary') }]} numberOfLines={2}>{summary}</Text>
                  <Text style={[type['type/caption'], { color: color('text/tertiary') }]} numberOfLines={1}>
                    {[r.difficulty ?? 'no difficulty', r.chapter_id ? null : 'no chapter', (r.tags?.length ?? 0) === 0 ? 'no tags' : `${r.tags!.length} tags`, r.flag_status && r.flag_status !== 'active' ? r.flag_status.replace('_', ' ') : null].filter(Boolean).join(' · ')}
                  </Text>
                </Pressable>
              );
            })}
            {cursor ? <SecondaryButton label={more ? 'Loading…' : 'Load more'} onPress={loadMore} loading={more} /> : null}
          </>
        )}
      </ScrollView>

      {selecting ? (
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: color('bg/surface'), borderTopWidth: 1, borderTopColor: color('border/subtle'), padding: space.md, paddingBottom: space.md + insets.bottom, flexDirection: 'row', gap: space.sm }}>
          <View style={{ flex: 1 }}><SecondaryButton label="Clear" onPress={() => setSelected(new Set())} /></View>
          <View style={{ flex: 2 }}><PrimaryButton label={`Edit ${selected.size}`} onPress={() => setBulkOpen(true)} /></View>
        </View>
      ) : null}

      <BulkSheet
        visible={bulkOpen}
        onClose={() => setBulkOpen(false)}
        ids={[...selected]}
        onDone={(n) => { setBulkOpen(false); show(`Updated ${n} question${n === 1 ? '' : 's'}`, 'success'); void load(); getCompleteness().then((r) => setTotals(r.totals)).catch(() => {}); }}
      />
    </SafeAreaView>
  );
}

function BulkSheet({ visible, onClose, ids, onDone }: { visible: boolean; onClose: () => void; ids: string[]; onDone: (n: number) => void }) {
  const { color, type, space } = useTheme();
  const [difficulty, setDifficulty] = useState<Difficulty | undefined>();
  const [courseId, setCourseId] = useState<string | undefined>();
  const [subjectId, setSubjectId] = useState<string | undefined>();
  const [chapterId, setChapterId] = useState<string | undefined>();
  const [courses, setCourses] = useState<{ value: string; label: string }[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [add, setAdd] = useState<string[]>([]);
  const [remove, setRemove] = useState<string[]>([]);
  const [eligible, setEligible] = useState<'keep' | 'yes' | 'no'>('keep');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setDifficulty(undefined); setCourseId(undefined); setSubjectId(undefined); setChapterId(undefined); setAdd([]); setRemove([]); setEligible('keep'); setErr(null);
    listCourses().then((r) => setCourses(r.courses.map((c) => ({ value: c.id, label: c.name })))).catch(() => {});
  }, [visible]);

  useEffect(() => {
    if (!courseId) return setSubjects([]);
    getCurriculum(courseId).then((r) => setSubjects(r.course.subjects ?? [])).catch(() => setSubjects([]));
  }, [courseId]);

  const patch: BulkPatch = {
    ...(difficulty ? { difficulty } : {}),
    ...(chapterId ? { chapter_id: chapterId, ...(subjectId ? { subject_id: subjectId } : {}) } : {}),
    ...(add.length ? { tags_add: add } : {}),
    ...(remove.length ? { tags_remove: remove } : {}),
    ...(eligible !== 'keep' ? { custom_eligible: eligible === 'yes' } : {}),
  };
  const empty = Object.keys(patch).length === 0;

  const apply = async () => {
    setBusy(true);
    setErr(null);
    try {
      const r = await bulkUpdateQuestions(ids, patch);
      onDone(r.updated ?? ids.length);
    } catch (e) {
      setErr(e instanceof ApiError && e.code === 'not_owner' ? 'Some of these questions belong to another teacher, so nothing was changed.' : 'Couldn’t apply the changes. Nothing was changed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title={`Edit ${ids.length} question${ids.length === 1 ? '' : 's'}`} dismissable={!busy} maxHeightPct={0.9}>
      <View style={{ gap: space.md }}>
        <Text style={[type['type/caption'], { color: color('text/secondary') }]}>Only the fields you set are changed. Wording and answers are never touched here.</Text>
        <SelectField label="Difficulty" value={difficulty} allowClear options={[{ value: 'easy', label: 'Easy' }, { value: 'medium', label: 'Medium' }, { value: 'hard', label: 'Hard' }]} onChange={(v) => setDifficulty(v as Difficulty | undefined)} />
        <SelectField label="Course (to pick a chapter)" value={courseId} allowClear options={courses} onChange={(v) => { setCourseId(v); setSubjectId(undefined); setChapterId(undefined); }} />
        <SelectField label="Chapter" value={chapterId} allowClear searchable disabled={!courseId} disabledHint="Choose a course first" options={subjects.flatMap((s) => s.chapters.map((c) => ({ value: c.id, label: `${s.name} › ${c.name}` })))}
          onChange={(v) => { setChapterId(v); setSubjectId(v ? subjects.find((s) => s.chapters.some((c) => c.id === v))?.id : undefined); }} />
        <TagInput label="Add tags" value={add} onChange={setAdd} />
        <TagInput label="Remove tags" value={remove} onChange={setRemove} suggest={false} />
        <SelectField label="Available for custom tests" value={eligible === 'keep' ? undefined : eligible} allowClear placeholder="Leave as is" options={[{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }]} onChange={(v) => setEligible((v as 'yes' | 'no' | undefined) ?? 'keep')} />
        {err ? <ErrorBanner message={err} /> : null}
        <PrimaryButton label="Apply to all" onPress={apply} loading={busy} disabled={empty} />
      </View>
    </BottomSheet>
  );
}
