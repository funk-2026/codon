import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { CheckSquare, FlagBanner, ImageSquare, Square, Tag, WarningCircle } from 'phosphor-react-native';
import {
  BottomSheet, EmptyState, ErrorBanner, PrimaryButton, SecondaryButton, SelectField, SkeletonBlock, TagInput, TextButton, useToast, ScreenHeader } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { ManageAllBanner } from './ManageAllBanner';
import { ApiError } from '@/src/api/client';
import { listCourses, getCurriculum, type Subject } from '@/src/api/courses';
import { bulkUpdateQuestions, listQuestionBank, type BulkPatch, type QuestionBankRow } from '@/src/api/questionBank';
import type { Difficulty } from '@/src/api/tests';
import { mediaRefs, plainText } from '@/src/rich';
import { EmbedRoot } from './EmbedRoot';
import { TreeToolbar } from '@/src/screens/CurriculumTree';
import { ROUTES } from '@/src/navigation/routes';
import { useQueryClient } from '@tanstack/react-query';
import { useCursorList } from '@/src/queries/useCursorList';
import { useCompleteness } from '@/src/queries/teacher';
import { useRefetchOnFocus } from '@/src/queries/useRefetchOnFocus';

const PAGE = 25;
type Filter = 'all' | 'reported' | Difficulty;
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'reported', label: 'Reported' },
  { key: 'easy', label: 'Easy' },
  { key: 'medium', label: 'Medium' },
  { key: 'hard', label: 'Hard' },
];
const DIFF_TONE = { easy: 'semantic/success', medium: 'semantic/warning', hard: 'semantic/danger' } as const;

/**
 * The teacher's question bank: every question across their tests. Search, one filter row, and an
 * explicit Select mode for bulk edits (up to 200 at once, all-or-nothing on the server). What is
 * missing from a question is handled in the Tags segment, so it isn't repeated here.
 */
export function QuestionBankView({ embedded }: { embedded?: boolean }) {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { show } = useToast();
  const queryClient = useQueryClient();

  const [filter, setFilter] = useState<Filter>('all');
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectMode, setSelectMode] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setQuery(q.trim()), 350);
    return () => clearTimeout(t);
  }, [q]);

  const params = useMemo(
    () => ({
      q: query || undefined,
      difficulty: filter === 'easy' || filter === 'medium' || filter === 'hard' ? filter : undefined,
      reported: filter === 'reported' ? true : undefined,
      limit: PAGE,
    }),
    [filter, query],
  );

  const list = useCursorList<QuestionBankRow, Awaited<ReturnType<typeof listQuestionBank>>>(
    ['teacher', 'question-bank', params],
    (cursor) => listQuestionBank({ ...params, cursor }),
    (r) => r.items,
  );
  const { rows, loading, error, load } = list;
  const cursor = list.hasMore ? 'more' : null;
  const more = list.more;
  const completeness = useCompleteness();
  useRefetchOnFocus(completeness.refetch);
  const loadMore = () => void list.loadMore().then((r) => { if (r.isError) show('Couldn’t load more.', 'error'); });
  // A new search or filter starts a fresh list, so drop any selection from the old one.
  useEffect(() => setSelected(new Set()), [params]);

  const toggleSel = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else if (n.size < 200) n.add(id); else show('You can edit up to 200 questions at once.', 'error');
      return n;
    });
  const selecting = selectMode || selected.size > 0;
  const stopSelecting = () => { setSelectMode(false); setSelected(new Set()); };
  const unfiltered = filter === 'all' && !query;

  return (
    <EmbedRoot embedded={embedded}>
      {embedded ? null : <ScreenHeader title={selecting ? `${selected.size} selected` : 'Question bank'} onBack={selecting ? stopSelecting : undefined} />}

      <View style={{ paddingHorizontal: space.md, marginTop: space.xs }}>
        <TreeToolbar
          query={q}
          onQuery={setQ}
          placeholder="Search questions"
          chips={{ options: FILTERS, value: filter, onChange: (k) => setFilter(k as Filter) }}
        />
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: space.xs, minHeight: 36 }}>
          <Text style={[type['type/caption'], { color: color('text/tertiary'), flex: 1 }]}>
            {selecting ? `${selected.size} selected` : loading ? ' ' : `${rows.length}${cursor ? '+' : ''} question${rows.length === 1 && !cursor ? '' : 's'}`}
          </Text>
          <TextButton label={selecting ? 'Cancel' : 'Select'} onPress={selecting ? stopSelecting : () => setSelectMode(true)} disabled={rows.length === 0} />
        </View>
        <ManageAllBanner what="questions" />
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: space.md, gap: space.xs, paddingBottom: 140 + insets.bottom }} showsVerticalScrollIndicator={false}>
        {loading ? (
          [0, 1, 2, 3].map((i) => <SkeletonBlock key={i} height={72} radius={radius.md} />)
        ) : error ? (
          <EmptyState icon={<WarningCircle size={32} color={color('semantic/danger')} weight="fill" />} title="Couldn’t load the question bank" description="Check your connection and try again." action={<TextButton label="Retry" onPress={load} />} />
        ) : rows.length === 0 ? (
          <EmptyState icon={<Tag size={32} color={color('text/tertiary')} />} title={unfiltered ? 'No questions yet' : 'No questions match'} description={unfiltered ? 'Questions you add to your tests appear here.' : 'Try clearing a filter.'} />
        ) : (
          <>
            {rows.map((r) => {
              const on = selected.has(r.id);
              const imgs = new Set([r.question_text, r.option_a, r.option_b, r.option_c, r.option_d, r.explanation ?? ''].flatMap((t) => mediaRefs(t, r.content_format))).size;
              const summary = plainText(r.question_text, r.content_format) || (imgs ? '(image question)' : '(empty)');
              const needsTags = !r.difficulty || !r.chapter_id || (r.tags?.length ?? 0) === 0;
              const tone = r.difficulty ? DIFF_TONE[r.difficulty] : 'text/tertiary';
              return (
                <Pressable
                  key={r.id}
                  onPress={() => (selecting ? toggleSel(r.id) : router.push({ pathname: ROUTES.teacher.questionEditor, params: { testId: r.test.id, questionId: r.id } }))}
                  onLongPress={() => { setSelectMode(true); toggleSel(r.id); }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  accessibilityHint={selecting ? 'Toggles selection' : 'Opens the question'}
                  style={({ pressed }) => ({ backgroundColor: on ? color('accent/tint') : color('bg/surface'), borderRadius: radius.md, padding: space.sm, flexDirection: 'row', alignItems: 'center', gap: space.sm, opacity: pressed ? 0.94 : 1, borderWidth: on ? 1.5 : 0, borderColor: color('accent/default') })}
                >
                  {selecting ? (
                    on ? <CheckSquare size={22} weight="fill" color={color('accent/default')} /> : <Square size={22} color={color('text/tertiary')} />
                  ) : (
                    <View style={{ width: 40, height: 40, borderRadius: radius.sm, backgroundColor: color('bg/sunken'), alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={[type['type/h3'], { color: color(tone) }]}>{r.difficulty ? r.difficulty.charAt(0).toUpperCase() : '–'}</Text>
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={[type['type/body-m-medium'], { color: color('text/primary') }]} numberOfLines={2}>{summary}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs, marginTop: 2 }}>
                      <Text style={[type['type/caption'], { color: color('text/tertiary'), flexShrink: 1 }]} numberOfLines={1}>{r.test.title}</Text>
                      {needsTags ? (
                        <View style={{ backgroundColor: color('semantic/warning-tint'), borderRadius: radius.pill, paddingHorizontal: space.xs }}>
                          <Text style={[type['type/caption'], { color: color('semantic/warning') }]}>Needs tags</Text>
                        </View>
                      ) : null}
                      {r.flag_status && r.flag_status !== 'active' ? (
                        <View style={{ backgroundColor: color('semantic/danger-tint'), borderRadius: radius.pill, paddingHorizontal: space.xs }}>
                          <Text style={[type['type/caption'], { color: color('semantic/danger') }]}>{r.flag_status.replace('_', ' ')}</Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                  {imgs > 0 ? <ImageSquare size={16} color={color('text/tertiary')} /> : null}
                  {r.report_count > 0 ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                      <FlagBanner size={16} weight="fill" color={color('semantic/danger')} />
                      <Text style={[type['type/caption'], { color: color('semantic/danger') }]}>{r.report_count}</Text>
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
            {cursor ? <SecondaryButton label={more ? 'Loading…' : 'Load more'} onPress={loadMore} loading={more} /> : null}
          </>
        )}
      </ScrollView>

      {selecting && selected.size > 0 ? (
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: color('bg/surface'), borderTopWidth: 1, borderTopColor: color('border/subtle'), padding: space.md, paddingBottom: space.md + insets.bottom, flexDirection: 'row', gap: space.sm }}>
          <View style={{ flex: 1 }}><SecondaryButton label="Clear" onPress={() => setSelected(new Set())} /></View>
          <View style={{ flex: 2 }}><PrimaryButton label={`Edit ${selected.size}`} onPress={() => setBulkOpen(true)} /></View>
        </View>
      ) : null}

      <BulkSheet
        visible={bulkOpen}
        onClose={() => setBulkOpen(false)}
        ids={[...selected]}
        onDone={(n) => { setBulkOpen(false); stopSelecting(); show(`Updated ${n} question${n === 1 ? '' : 's'}`, 'success'); void load(); void completeness.refetch(); void queryClient.invalidateQueries({ queryKey: ['teacher', 'inbox'] }); }}
      />
    </EmbedRoot>
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
