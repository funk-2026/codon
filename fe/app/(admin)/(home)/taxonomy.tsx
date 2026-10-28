import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { CaretLeft, MagnifyingGlass, WarningCircle } from 'phosphor-react-native';
import { BottomSheet, EmptyState, InputField, PrimaryButton, SecondaryButton, SelectField, SkeletonBlock, TextButton, useToast } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { ApiError } from '@/src/api/client';
import { getCurriculum, listCourses } from '@/src/api/courses';
import {
  adminDeleteTag, adminDeleteTopic, adminListTags, adminMergeTag, adminRenameTag, adminRenameTopic, createTopic, listTopics,
  type AdminTag, type Topic,
} from '@/src/api/questionBank';

type Tab = 'tags' | 'topics';
type Opt = { value: string; label: string };
type Sheet =
  | { kind: 'renameTag'; tag: AdminTag }
  | { kind: 'mergeTag'; tag: AdminTag }
  | { kind: 'deleteTag'; tag: AdminTag }
  | { kind: 'renameTopic'; topic: Topic }
  | { kind: 'deleteTopic'; topic: Topic }
  | { kind: 'addTopic' };

/** Admin taxonomy manager (FE-5.14): tags (rename / merge / delete) and topics per chapter. */
export default function TaxonomyRoute() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { show } = useToast();

  const [tab, setTab] = useState<Tab>('tags');
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [text, setText] = useState('');
  const [mergeInto, setMergeInto] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);

  // ── tags ──
  const [q, setQ] = useState('');
  const [tags, setTags] = useState<AdminTag[] | null>(null);
  const [tagsError, setTagsError] = useState(false);
  const tagSeq = useRef(0);
  const loadTags = useCallback(async (query: string) => {
    const my = ++tagSeq.current;
    setTagsError(false);
    try {
      const r = await adminListTags(query.trim() || undefined);
      if (my === tagSeq.current) setTags(r.tags);
    } catch {
      if (my === tagSeq.current) setTagsError(true);
    }
  }, []);
  useEffect(() => {
    if (tab !== 'tags') return;
    const t = setTimeout(() => void loadTags(q), 300);
    return () => clearTimeout(t);
  }, [q, tab, loadTags]);

  // ── topics ──
  const [courses, setCourses] = useState<Opt[]>([]);
  const [courseId, setCourseId] = useState<string | undefined>();
  const [tree, setTree] = useState<{ id: string; name: string; chapters: { id: string; name: string }[] }[]>([]);
  const [subjectId, setSubjectId] = useState<string | undefined>();
  const [chapterId, setChapterId] = useState<string | undefined>();
  const [topics, setTopics] = useState<Topic[] | null>(null);
  const [topicsError, setTopicsError] = useState(false);

  useEffect(() => {
    listCourses()
      .then((r) => {
        const opts = (r.courses ?? []).map((c) => ({ value: c.id, label: c.name }));
        setCourses(opts);
        setCourseId((cur) => cur ?? opts[0]?.value);
      })
      .catch(() => {});
  }, []);
  useEffect(() => {
    if (!courseId) return;
    getCurriculum(courseId)
      .then((r) => setTree((r.course.subjects ?? []).map((s) => ({ id: s.id, name: s.name, chapters: (s.chapters ?? []).map((c) => ({ id: c.id, name: c.name })) }))))
      .catch(() => setTree([]));
  }, [courseId]);
  const loadTopics = useCallback(async () => {
    if (!courseId || !chapterId) return setTopics(null);
    setTopicsError(false);
    setTopics(null);
    try {
      const r = await listTopics(courseId, chapterId);
      setTopics(r.topics ?? []);
    } catch {
      setTopicsError(true);
    }
  }, [courseId, chapterId]);
  useEffect(() => {
    void loadTopics();
  }, [loadTopics]);

  const subjectOpts = useMemo(() => tree.map((s) => ({ value: s.id, label: s.name })), [tree]);
  const chapterOpts = useMemo(() => (tree.find((s) => s.id === subjectId)?.chapters ?? []).map((c) => ({ value: c.id, label: c.name })), [tree, subjectId]);
  const mergeOpts = useMemo(
    () => (sheet?.kind === 'mergeTag' ? (tags ?? []).filter((t) => t.id !== sheet.tag.id && !t.alias_of).map((t) => ({ value: t.id, label: t.label, hint: `${t.uses} uses` })) : []),
    [sheet, tags],
  );

  const openSheet = (s: Sheet) => {
    setText(s.kind === 'renameTag' || s.kind === 'mergeTag' || s.kind === 'deleteTag' ? (s.kind === 'renameTag' ? s.tag.label : '') : s.kind === 'renameTopic' ? s.topic.name : '');
    setMergeInto(undefined);
    setSheet(s);
  };

  const run = async () => {
    if (!sheet) return;
    setBusy(true);
    try {
      switch (sheet.kind) {
        case 'renameTag': {
          const t = await adminRenameTag(sheet.tag.id, text.trim());
          setTags((p) => p?.map((x) => (x.id === sheet.tag.id ? { ...x, label: t.label ?? text.trim() } : x)) ?? p);
          show('Tag renamed', 'success');
          break;
        }
        case 'mergeTag':
          await adminMergeTag(sheet.tag.id, mergeInto!);
          show('Tags merged', 'success');
          void loadTags(q);
          break;
        case 'deleteTag':
          await adminDeleteTag(sheet.tag.id);
          setTags((p) => p?.filter((x) => x.id !== sheet.tag.id) ?? p);
          show('Tag deleted', 'success');
          break;
        case 'renameTopic': {
          const t = await adminRenameTopic(sheet.topic.id, text.trim());
          setTopics((p) => p?.map((x) => (x.id === sheet.topic.id ? { ...x, name: t.name ?? text.trim() } : x)) ?? p);
          show('Topic renamed', 'success');
          break;
        }
        case 'deleteTopic':
          await adminDeleteTopic(sheet.topic.id);
          setTopics((p) => p?.filter((x) => x.id !== sheet.topic.id) ?? p);
          show('Topic deleted', 'success');
          break;
        case 'addTopic': {
          const t = await createTopic(chapterId!, text.trim());
          setTopics((p) => [...(p ?? []), t]);
          show('Topic added', 'success');
          break;
        }
      }
      setSheet(null);
    } catch (e) {
      const code = e instanceof ApiError ? e.code : undefined;
      show(
        code === 'tag_in_use' ? 'Questions still use this tag — merge it into another instead.'
        : code === 'topic_in_use' ? 'Questions still use this topic — move them first.'
        : e instanceof ApiError && e.status === 409 ? 'That name is already taken.'
        : 'Something went wrong. Try again.',
        'error',
      );
    } finally {
      setBusy(false);
    }
  };

  const sheetTitle = !sheet ? '' : {
    renameTag: 'Rename tag', mergeTag: 'Merge tag', deleteTag: 'Delete tag', renameTopic: 'Rename topic', deleteTopic: 'Delete topic', addTopic: 'New topic',
  }[sheet.kind];

  const chip = (k: Tab, label: string) => {
    const on = tab === k;
    return (
      <Pressable
        key={k}
        onPress={() => setTab(k)}
        accessibilityRole="tab"
        accessibilityState={{ selected: on }}
        style={{ minHeight: 40, paddingHorizontal: space.md, borderRadius: radius.pill, justifyContent: 'center', borderWidth: 1, borderColor: on ? color('accent/default') : color('border/subtle'), backgroundColor: on ? color('accent/tint') : color('bg/surface') }}
      >
        <Text style={[type['type/body-m-medium'], { color: on ? color('accent/default') : color('text/primary') }]}>{label}</Text>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color('bg/canvas') }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.md, paddingTop: space.md }}>
        <Pressable onPress={() => router.back()} hitSlop={space.xs} accessibilityRole="button" accessibilityLabel="Back" style={{ minWidth: 44, minHeight: 44, justifyContent: 'center' }}>
          <CaretLeft size={24} color={color('text/primary')} />
        </Pressable>
        <Text accessibilityRole="header" style={[type['type/h1'], { color: color('text/primary') }]}>Tags & Topics</Text>
      </View>
      <View style={{ flexDirection: 'row', gap: space.xs, paddingHorizontal: space.md, marginTop: space.sm }}>
        {chip('tags', 'Tags')}
        {chip('topics', 'Topics')}
      </View>

      <ScrollView contentContainerStyle={{ padding: space.md, gap: space.sm, paddingBottom: space['3xl'] + insets.bottom }} keyboardShouldPersistTaps="handled">
        {tab === 'tags' ? (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: color('bg/sunken'), borderRadius: radius.sm, paddingHorizontal: space.sm }}>
              <MagnifyingGlass size={18} color={color('text/tertiary')} />
              <TextInput
                value={q}
                onChangeText={setQ}
                placeholder="Search tags"
                placeholderTextColor={color('text/tertiary')}
                autoCapitalize="none"
                style={[type['type/body-m'], { color: color('text/primary'), flex: 1, marginLeft: space.xs, paddingVertical: space.sm }]}
                accessibilityLabel="Search tags"
              />
            </View>
            {tagsError ? (
              <EmptyState icon={<WarningCircle size={32} color={color('semantic/danger')} weight="fill" />} title="Couldn’t load tags" description="Check your connection and try again." action={<TextButton label="Retry" onPress={() => loadTags(q)} />} />
            ) : tags == null ? (
              [0, 1, 2, 3].map((i) => <SkeletonBlock key={i} height={64} radius={radius.md} />)
            ) : tags.length === 0 ? (
              <Text style={[type['type/body-m'], { color: color('text/secondary') }]}>{q ? 'No tags match.' : 'No tags yet — teachers create them while tagging questions.'}</Text>
            ) : (
              tags.map((t) => (
                <View key={t.id} style={{ backgroundColor: color('bg/surface'), borderRadius: radius.md, padding: space.md }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={{ flex: 1 }}>
                      <Text style={[type['type/body-m-medium'], { color: color('text/primary') }]}>{t.label}</Text>
                      <Text style={[type['type/caption'], { color: color('text/secondary') }]}>
                        {t.slug} · {t.uses} question{t.uses === 1 ? '' : 's'}{t.alias_of ? ' · merged (alias)' : ''}
                      </Text>
                    </View>
                  </View>
                  {!t.alias_of ? (
                    <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.xs }}>
                      <TextButton label="Rename" onPress={() => openSheet({ kind: 'renameTag', tag: t })} />
                      <TextButton label="Merge into…" onPress={() => openSheet({ kind: 'mergeTag', tag: t })} />
                      <TextButton label="Delete" onPress={() => openSheet({ kind: 'deleteTag', tag: t })} />
                    </View>
                  ) : null}
                </View>
              ))
            )}
          </>
        ) : (
          <>
            <SelectField label="Course" value={courseId} options={courses} onChange={(v) => { setCourseId(v); setSubjectId(undefined); setChapterId(undefined); }} />
            <SelectField label="Subject" value={subjectId} options={subjectOpts} onChange={(v) => { setSubjectId(v); setChapterId(undefined); }} disabled={subjectOpts.length === 0} />
            <SelectField label="Chapter" value={chapterId} options={chapterOpts} onChange={setChapterId} disabled={!subjectId} disabledHint="Pick a subject first" searchable />
            {!chapterId ? (
              <Text style={[type['type/body-m'], { color: color('text/secondary') }]}>Pick a chapter to see its topics.</Text>
            ) : topicsError ? (
              <EmptyState icon={<WarningCircle size={32} color={color('semantic/danger')} weight="fill" />} title="Couldn’t load topics" description="Check your connection and try again." action={<TextButton label="Retry" onPress={loadTopics} />} />
            ) : topics == null ? (
              <SkeletonBlock height={64} radius={radius.md} />
            ) : (
              <>
                {topics.length === 0 ? <Text style={[type['type/body-m'], { color: color('text/secondary') }]}>No topics in this chapter yet.</Text> : null}
                {topics.map((t) => (
                  <View key={t.id} style={{ backgroundColor: color('bg/surface'), borderRadius: radius.md, padding: space.md, flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                    <Text style={[type['type/body-m'], { color: color('text/primary'), flex: 1 }]}>{t.name}</Text>
                    <TextButton label="Rename" onPress={() => openSheet({ kind: 'renameTopic', topic: t })} />
                    <TextButton label="Delete" onPress={() => openSheet({ kind: 'deleteTopic', topic: t })} />
                  </View>
                ))}
                <SecondaryButton label="+ Add topic" onPress={() => openSheet({ kind: 'addTopic' })} />
              </>
            )}
          </>
        )}
      </ScrollView>

      <BottomSheet visible={!!sheet} onClose={() => setSheet(null)} title={sheetTitle} dismissable={!busy}>
        {sheet ? (
          <View style={{ gap: space.md }}>
            {sheet.kind === 'renameTag' || sheet.kind === 'renameTopic' || sheet.kind === 'addTopic' ? (
              <InputField label={sheet.kind === 'renameTag' ? 'Label' : 'Topic name'} value={text} onChangeText={setText} maxLength={80} autoFocus />
            ) : sheet.kind === 'mergeTag' ? (
              <>
                <Text style={[type['type/body-m'], { color: color('text/secondary') }]}>
                  Every question tagged “{sheet.tag.label}” ({sheet.tag.uses}) moves to the tag you pick; “{sheet.tag.label}” becomes an alias of it.
                </Text>
                <SelectField label="Merge into" value={mergeInto} options={mergeOpts} onChange={setMergeInto} searchable />
              </>
            ) : (
              <Text style={[type['type/body-m'], { color: color('text/secondary') }]}>
                {sheet.kind === 'deleteTag'
                  ? sheet.tag.uses > 0
                    ? `${sheet.tag.uses} question${sheet.tag.uses === 1 ? '' : 's'} still use this tag, so it can’t be deleted — merge it into another tag instead.`
                    : `Delete “${sheet.tag.label}”? It isn’t used by any question.`
                  : `Delete “${sheet.topic.name}”? This only works if no question uses it.`}
              </Text>
            )}
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              <SecondaryButton label="Cancel" onPress={() => setSheet(null)} style={{ flex: 1 }} />
              <PrimaryButton
                label={sheet.kind === 'mergeTag' ? 'Merge' : sheet.kind.startsWith('delete') ? 'Delete' : 'Save'}
                onPress={run}
                loading={busy}
                style={{ flex: 1 }}
                disabled={
                  (sheet.kind === 'mergeTag' && !mergeInto)
                  || ((sheet.kind === 'renameTag' || sheet.kind === 'renameTopic' || sheet.kind === 'addTopic') && !text.trim())
                  || (sheet.kind === 'deleteTag' && sheet.tag.uses > 0)
                }
              />
            </View>
          </View>
        ) : null}
      </BottomSheet>
    </SafeAreaView>
  );
}
