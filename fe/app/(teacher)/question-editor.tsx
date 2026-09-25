import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CaretLeft, Eye, WarningCircle } from 'phosphor-react-native';
import {
  BottomSheet, EmptyState, ErrorBanner, InputField, PrimaryButton, SecondaryButton, SelectField, SkeletonBlock, TagInput, TextButton, useToast,
} from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { useAppConfig } from '@/src/config/AppConfigContext';
import { ApiError } from '@/src/api/client';
import { getCurriculum, type Subject } from '@/src/api/courses';
import { createQuestion, getTeacherTest, updateQuestion, type SavedQuestion } from '@/src/api/teacher';
import { checkDuplicate, listTopics, submitCorrection, type DuplicateHit, type Topic } from '@/src/api/questionBank';
import type { AuthoredQuestion, Test } from '@/src/api/tests';
import { QuestionPreviewCard, RichField, type MediaMap, type MediaView } from '@/src/rich';
import {
  contentChanged, DEFAULT_LIMITS, EMPTY_DRAFT, fromQuestion, isDirty, isValid, softWarnings, toRequest, validateDraft, type FormDraft,
} from '@/src/teacher/questionForm';
import { clearDraft, isBlankDraft, loadDraft, saveDraft } from '@/src/storage/drafts';

const LETTERS = ['A', 'B', 'C', 'D'] as const;
const OPTION_KEYS = ['option_a', 'option_b', 'option_c', 'option_d'] as const;
const SOURCES = [
  { value: 'qbank', label: 'Question bank' }, { value: 'practice', label: 'Practice' }, { value: 'pyq', label: 'Previous-year paper' },
  { value: 'test_series', label: 'Test series' }, { value: 'other', label: 'Other' },
];

export default function QuestionEditorRoute() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { show } = useToast();
  const { config } = useAppConfig();
  const { testId, questionId } = useLocalSearchParams<{ testId: string; questionId?: string }>();

  const limits = useMemo(() => ({ ...DEFAULT_LIMITS, ...(config?.limits.rich_text ?? {}), ...(config?.limits.media ?? {}) }), [config]);

  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [test, setTest] = useState<Test | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [media, setMedia] = useState<MediaMap>({});
  const [draft, setDraft] = useState<FormDraft>(EMPTY_DRAFT);
  const [original, setOriginal] = useState<FormDraft>(EMPTY_DRAFT);
  const [saved, setSaved] = useState<SavedQuestion | AuthoredQuestion | null>(null);
  const [errors, setErrors] = useState<ReturnType<typeof validateDraft>>({});
  const [showErrors, setShowErrors] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [dups, setDups] = useState<DuplicateHit[]>([]);
  const [preview, setPreview] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [restore, setRestore] = useState<FormDraft | null>(null);
  const [reasonOpen, setReasonOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [metaOpen, setMetaOpen] = useState(false);

  const editing = !!questionId;
  const live = !!test && test.status !== 'draft' && test.status !== 'rejected';
  const dirty = isDirty(draft, original);
  const dupSeq = useRef(0);

  // ── load ──
  const load = useCallback(async () => {
    if (!testId) return;
    setStatus('loading');
    try {
      const res = await getTeacherTest(testId);
      setTest(res.test);
      setMedia(res.media ?? {});
      let base = EMPTY_DRAFT;
      if (questionId) {
        const q = res.questions.find((x) => x.id === questionId);
        if (!q) throw new Error('question not found');
        base = fromQuestion(q);
        setSaved(q);
      }
      setOriginal(base);
      setDraft(base);
      const d = await loadDraft(testId, questionId);
      if (d && !isBlankDraft(d)) {
        const { updatedAt: _u, ...rest } = d;
        if (isDirty(rest, base)) setRestore(rest);
      }
      getCurriculum(res.test.course_id).then((c) => setSubjects(c.course.subjects ?? [])).catch(() => {});
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, [testId, questionId]);

  useEffect(() => {
    void load();
  }, [load]);

  // topics follow the chosen chapter
  useEffect(() => {
    if (!test || !draft.chapter_id) return setTopics([]);
    listTopics(test.course_id, draft.chapter_id).then((r) => setTopics(r.topics)).catch(() => setTopics([]));
  }, [test, draft.chapter_id]);

  // ── local validation (instant), draft autosave, duplicate check ──
  useEffect(() => setErrors(validateDraft(draft, limits)), [draft, limits]);

  useEffect(() => {
    if (status !== 'ready' || !dirty || !testId) return;
    const t = setTimeout(() => void saveDraft(testId, draft, questionId), 800);
    return () => clearTimeout(t);
  }, [draft, dirty, status, testId, questionId]);

  useEffect(() => {
    const d = draft;
    if (![d.question_text, d.option_a, d.option_b, d.option_c, d.option_d].every((s) => s.trim())) return setDups([]);
    const my = ++dupSeq.current;
    const t = setTimeout(() => {
      checkDuplicate({ question_text: d.question_text, option_a: d.option_a, option_b: d.option_b, option_c: d.option_c, option_d: d.option_d, exclude_id: questionId })
        .then((r) => my === dupSeq.current && setDups(r.duplicates))
        .catch(() => my === dupSeq.current && setDups([])); // warn-only: a failed check never blocks authoring
    }, 900);
    return () => clearTimeout(t);
  }, [draft.question_text, draft.option_a, draft.option_b, draft.option_c, draft.option_d, questionId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── leaving ──
  const back = useCallback(() => (dirty ? setLeaveOpen(true) : router.back()), [dirty, router]);
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (leaveOpen || reasonOpen) return false;
      back();
      return true;
    });
    return () => sub.remove();
  }, [back, leaveOpen, reasonOpen]);

  const set = <K extends keyof FormDraft>(k: K, v: FormDraft[K]) => setDraft((d) => ({ ...d, [k]: v }));
  const addMedia = useCallback((v: MediaView) => setMedia((m) => ({ ...m, [v.id]: v })), []);

  // ── save ──
  const doSave = async (addAnother: boolean, correctionReason?: string) => {
    setShowErrors(true);
    setSaveError(null);
    if (!isValid(errors)) {
      show('Fix the highlighted fields first.', 'error');
      return;
    }
    if (!testId) return;
    // A live question: content changes need review; metadata-only changes save directly.
    if (editing && live && contentChanged(draft, original) && !correctionReason) {
      setReasonOpen(true);
      return;
    }
    setSaving(true);
    try {
      const req = toRequest(draft);
      let res: SavedQuestion | null = null;
      if (editing && live && contentChanged(draft, original)) {
        await submitCorrection(questionId!, { reason: correctionReason!, proposed: { ...req } });
        setReasonOpen(false);
        show('Correction sent for review. Students keep seeing the current version until it’s approved.', 'success');
      } else if (editing) {
        const meta = live ? (({ question_text, option_a, option_b, option_c, option_d, correct_option, explanation, content_format, ...m }) => m)(req) : req;
        res = await updateQuestion(questionId!, meta);
        show('Changes saved', 'success');
      } else {
        res = await createQuestion(testId, req);
        show('Question added', 'success');
      }
      if (res?.media) setMedia((m) => ({ ...m, ...res!.media }));
      setWarnings((res?.warnings ?? []).map((w: any) => (typeof w === 'string' ? w : w.message)));
      await clearDraft(testId, questionId);
      if (addAnother && !editing) {
        // keep the classification so authoring a run of similar questions is fast
        const keep: FormDraft = { ...EMPTY_DRAFT, subject_id: draft.subject_id, chapter_id: draft.chapter_id, topic_id: draft.topic_id, difficulty: draft.difficulty, source_type: draft.source_type, source_year: draft.source_year, source_label: draft.source_label, ncert_class: draft.ncert_class, custom_eligible: draft.custom_eligible };
        setDraft(keep);
        setOriginal(keep);
        setShowErrors(false);
        setDups([]);
      } else {
        setOriginal(draft);
        router.back();
      }
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.code === 'test_locked') return setSaveError('This test is no longer editable. Corrections to live questions go through review.');
        if (e.status === 401 || e.status === 403) return setSaveError('You don’t have permission to edit this question.');
        if (e.status === 422 || e.status === 400) return setSaveError(e.message);
      }
      setSaveError('Couldn’t save. Your work is kept — check your connection and try again.');
    } finally {
      setSaving(false);
    }
  };

  // ── ui helpers ──
  const err = (k: keyof typeof errors) => (showErrors ? errors[k] ?? null : null);
  const subj = subjects.find((s) => s.id === draft.subject_id);
  const chapters = subj?.chapters ?? subjects.flatMap((s) => s.chapters);
  const soft = softWarnings(draft);

  const previewQuestion = {
    id: questionId ?? 'preview', content_format: 'rich_v1', question_text: draft.question_text, option_a: draft.option_a, option_b: draft.option_b,
    option_c: draft.option_c, option_d: draft.option_d, correct_option: draft.correct_option, explanation: draft.explanation,
  };

  const Header = (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.md, paddingTop: space.md }}>
      <Pressable onPress={back} hitSlop={space.xs} accessibilityRole="button" accessibilityLabel="Back" style={{ minWidth: 44, minHeight: 44, justifyContent: 'center' }}>
        <CaretLeft size={24} color={color('text/primary')} />
      </Pressable>
      <Text accessibilityRole="header" style={[type['type/h2'], { color: color('text/primary'), flex: 1 }]} numberOfLines={1}>
        {editing ? 'Edit question' : 'New question'}
      </Text>
      <Pressable onPress={() => setPreview((p) => !p)} accessibilityRole="button" accessibilityState={{ selected: preview }} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44, paddingHorizontal: space.xs }}>
        <Eye size={20} color={preview ? color('accent/default') : color('text/secondary')} />
        <Text style={[type['type/body-m'], { color: preview ? color('accent/default') : color('text/secondary') }]}>{preview ? 'Editing' : 'Student view'}</Text>
      </Pressable>
    </View>
  );

  if (status !== 'ready') {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: color('bg/canvas') }}>
        {Header}
        {status === 'error' ? (
          <EmptyState
            icon={<WarningCircle size={32} color={color('semantic/danger')} weight="fill" />}
            title="Couldn’t load this question"
            description="Check your connection and try again."
            action={<TextButton label="Retry" onPress={load} />}
            style={{ flex: 1, justifyContent: 'center' }}
          />
        ) : (
          <View style={{ padding: space.md, gap: space.md }}>
            <SkeletonBlock height={140} radius={radius.md} />
            <SkeletonBlock height={80} radius={radius.md} />
            <SkeletonBlock height={80} radius={radius.md} />
          </View>
        )}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color('bg/canvas') }}>
      {Header}
      <ScrollView contentContainerStyle={{ padding: space.md, gap: space.lg, paddingBottom: 140 + insets.bottom }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {restore ? (
          <View style={{ backgroundColor: color('accent/tint'), borderRadius: radius.md, padding: space.md, gap: space.xs }}>
            <Text style={[type['type/body-m-medium'], { color: color('text/primary') }]}>You have an unsaved draft for this question.</Text>
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              <SecondaryButton label="Restore" onPress={() => { setDraft(restore); setRestore(null); }} />
              <TextButton label="Discard" onPress={() => { void clearDraft(testId!, questionId); setRestore(null); }} />
            </View>
          </View>
        ) : null}

        {live ? (
          <View style={{ backgroundColor: color('semantic/warning-tint'), borderRadius: radius.md, padding: space.md }}>
            <Text style={[type['type/body-m'], { color: color('text/primary') }]}>
              This question is live. Changes to its wording, options or answer are sent for review; tags and classification save right away.
            </Text>
          </View>
        ) : null}

        {test?.status === 'rejected' && test.rejection_reason ? (
          <View style={{ backgroundColor: color('semantic/danger-tint'), borderRadius: radius.md, padding: space.md }}>
            <Text style={[type['type/caption'], { color: color('semantic/danger') }]}>REVIEWER’S NOTE</Text>
            <Text style={[type['type/body-m'], { color: color('text/primary') }]}>{test.rejection_reason}</Text>
          </View>
        ) : null}

        {preview ? (
          <>
            <Text style={[type['type/body-m'], { color: color('text/secondary') }]}>This is how students will see it (the correct answer and explanation are shown to you here).</Text>
            <QuestionPreviewCard q={previewQuestion} index={0} media={media} />
            {errors.images ? <Text style={{ color: color('semantic/danger') }}>{errors.images}</Text> : null}
          </>
        ) : (
          <>
            <RichField
              label="Question" required value={draft.question_text} onChange={(v) => set('question_text', v)} media={media} onMedia={addMedia}
              purpose="question_image" maxChars={limits.max_stem_chars} minLines={4} placeholder="Type the question. Use the toolbar for bold, subscripts and images."
              error={err('question_text')} maxImages={limits.max_images_per_field}
            />

            <View style={{ gap: space.md }}>
              <Text style={[type['type/body-m-medium'], { color: color('text/primary') }]}>Options — tap a letter to mark the correct answer</Text>
              {LETTERS.map((L, i) => {
                const k = OPTION_KEYS[i];
                const on = draft.correct_option === L;
                return (
                  <View key={L} style={{ flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' }}>
                    <Pressable
                      onPress={() => set('correct_option', L)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: on }}
                      accessibilityLabel={`Option ${L}${on ? ', correct answer' : ''}`}
                      style={{ width: 44, height: 44, marginTop: 28, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? color('semantic/success') : color('bg/sunken'), borderWidth: on ? 0 : 1.5, borderColor: color('border/strong') }}
                    >
                      <Text style={[type['type/body-m-medium'], { color: on ? color('text/inverse') : color('text/secondary') }]}>{L}</Text>
                    </Pressable>
                    <View style={{ flex: 1 }}>
                      <RichField
                        label={`Option ${L}`} value={draft[k]} onChange={(v) => set(k, v)} media={media} onMedia={addMedia} purpose="question_image"
                        maxChars={limits.max_option_chars} minLines={1} compact maxImages={1} error={err(k)}
                      />
                    </View>
                  </View>
                );
              })}
              {err('correct_option') ? <Text style={[type['type/caption'], { color: color('semantic/danger') }]}>{err('correct_option')}</Text> : null}
            </View>

            <RichField
              label="Explanation" value={draft.explanation} onChange={(v) => set('explanation', v)} media={media} onMedia={addMedia}
              purpose="explanation_image" maxChars={limits.max_explanation_chars} minLines={3} placeholder="Why is that the answer? (students see this in review)"
              error={err('explanation')} maxImages={limits.max_images_per_field}
            />
            {err('images') ? <Text style={[type['type/caption'], { color: color('semantic/danger') }]}>{err('images')}</Text> : null}

            {dups.length > 0 ? (
              <View style={{ backgroundColor: color('semantic/warning-tint'), borderRadius: radius.md, padding: space.md, gap: 4 }}>
                <Text style={[type['type/body-m-medium'], { color: color('text/primary') }]}>This looks like a question that already exists</Text>
                {dups.slice(0, 2).map((d) => (
                  <Text key={d.id} numberOfLines={2} style={[type['type/caption'], { color: color('text/secondary') }]}>“{d.question_text}”</Text>
                ))}
                <Text style={[type['type/caption'], { color: color('text/secondary') }]}>You can still save it — duplicates across courses are sometimes intentional.</Text>
              </View>
            ) : null}

            {/* Classification */}
            <View style={{ backgroundColor: color('bg/surface'), borderRadius: radius.lg, padding: space.md, gap: space.md }}>
              <Pressable onPress={() => setMetaOpen((o) => !o)} accessibilityRole="button" accessibilityState={{ expanded: metaOpen }} style={{ minHeight: 44, justifyContent: 'center' }}>
                <Text style={[type['type/h3'], { color: color('text/primary') }]}>Classification {metaOpen ? '▾' : '▸'}</Text>
                <Text style={[type['type/caption'], { color: color('text/secondary') }]}>
                  Chapter, difficulty and tags let students build custom tests from this question.
                </Text>
              </Pressable>
              {metaOpen ? (
                <>
                  <SelectField label="Subject" value={draft.subject_id} allowClear options={subjects.map((s) => ({ value: s.id, label: s.name }))} onChange={(v) => setDraft((d) => ({ ...d, subject_id: v, chapter_id: undefined, topic_id: undefined }))} />
                  <SelectField label="Chapter" value={draft.chapter_id} allowClear searchable disabled={subjects.length === 0} disabledHint="Loading…" options={chapters.map((c) => ({ value: c.id, label: c.name }))}
                    onChange={(v) => setDraft((d) => ({ ...d, chapter_id: v, topic_id: undefined, subject_id: v ? subjects.find((s) => s.chapters.some((c) => c.id === v))?.id ?? d.subject_id : d.subject_id }))} />
                  <SelectField label="Topic" value={draft.topic_id} allowClear disabled={!draft.chapter_id} disabledHint="Choose a chapter first" options={topics.map((t) => ({ value: t.id, label: t.name }))} onChange={(v) => set('topic_id', v)} />
                  <SelectField label="Difficulty" value={draft.difficulty || undefined} allowClear options={[{ value: 'easy', label: 'Easy' }, { value: 'medium', label: 'Medium' }, { value: 'hard', label: 'Hard' }]} onChange={(v) => set('difficulty', (v ?? '') as FormDraft['difficulty'])} />
                  <View style={{ flexDirection: 'row', gap: space.sm }}>
                    <View style={{ flex: 1 }}><InputField label="NCERT class" value={draft.ncert_class ?? ''} onChangeText={(t: string) => set('ncert_class', t.replace(/\D/g, ''))} keyboardType="number-pad" error={err('ncert_class') ?? undefined} /></View>
                    <View style={{ flex: 1 }}><InputField label="NCERT page" value={draft.ncert_page ?? ''} onChangeText={(t: string) => set('ncert_page', t.replace(/\D/g, ''))} keyboardType="number-pad" error={err('ncert_page') ?? undefined} /></View>
                  </View>
                  <SelectField label="Source" value={draft.source_type} options={SOURCES} onChange={(v) => set('source_type', v ?? 'qbank')} />
                  <View style={{ flexDirection: 'row', gap: space.sm }}>
                    <View style={{ flex: 1 }}><InputField label="Year" value={draft.source_year ?? ''} onChangeText={(t: string) => set('source_year', t.replace(/\D/g, '').slice(0, 4))} keyboardType="number-pad" error={err('source_year') ?? undefined} /></View>
                    <View style={{ flex: 2 }}><InputField label="Source label" value={draft.source_label ?? ''} onChangeText={(t: string) => set('source_label', t)} placeholder="e.g. NEET 2023 Q45" /></View>
                  </View>
                  <TagInput value={draft.tags ?? []} onChange={(v) => set('tags', v)} />
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                    <View style={{ flex: 1 }}>
                      <Text style={[type['type/body-m-medium'], { color: color('text/primary') }]}>Available for custom tests</Text>
                      <Text style={[type['type/caption'], { color: color('text/secondary') }]}>Turn off for questions that only make sense inside their original test.</Text>
                    </View>
                    <Switch value={draft.custom_eligible ?? true} onValueChange={(v) => set('custom_eligible', v)} accessibilityLabel="Available for custom tests" />
                  </View>
                </>
              ) : null}
            </View>
          </>
        )}

        {warnings.length > 0 ? (
          <View style={{ backgroundColor: color('semantic/warning-tint'), borderRadius: radius.md, padding: space.md, gap: 4 }}>
            <Text style={[type['type/body-m-medium'], { color: color('text/primary') }]}>Saved — a few things to improve:</Text>
            {warnings.map((w, i) => <Text key={i} style={[type['type/caption'], { color: color('text/secondary') }]}>• {w}</Text>)}
          </View>
        ) : null}
        {saveError ? <ErrorBanner message={saveError} onRetry={() => void doSave(false)} /> : null}
      </ScrollView>

      {/* Sticky save bar */}
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: color('bg/surface'), borderTopWidth: 1, borderTopColor: color('border/subtle'), padding: space.md, paddingBottom: space.md + insets.bottom, gap: space.xs }}>
        {soft.length > 0 && !editing ? <Text style={[type['type/caption'], { color: color('text/secondary') }]} numberOfLines={1}>{soft[0]}</Text> : null}
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          {!editing ? <View style={{ flex: 1 }}><SecondaryButton label="Save & add another" onPress={() => void doSave(true)} disabled={saving} /></View> : null}
          <View style={{ flex: 1 }}>
            <PrimaryButton label={editing && live && contentChanged(draft, original) ? 'Submit for review' : editing ? 'Save changes' : 'Save'} onPress={() => void doSave(false)} loading={saving} disabled={editing && !dirty} />
          </View>
        </View>
      </View>

      <BottomSheet visible={leaveOpen} onClose={() => setLeaveOpen(false)} title="Leave without saving?">
        <Text style={[type['type/body-m'], { color: color('text/secondary') }]}>Your work is kept as a draft on this device, so you can pick it up later.</Text>
        <View style={{ gap: space.sm, marginTop: space.lg }}>
          <PrimaryButton label="Keep editing" onPress={() => setLeaveOpen(false)} />
          <SecondaryButton label="Leave (keep draft)" onPress={() => { setLeaveOpen(false); router.back(); }} />
          <TextButton label="Discard draft" onPress={() => { void clearDraft(testId!, questionId); setLeaveOpen(false); router.back(); }} />
        </View>
      </BottomSheet>

      <BottomSheet visible={reasonOpen} onClose={() => setReasonOpen(false)} title="Why is this change needed?" dismissable={!saving}>
        <View style={{ gap: space.md }}>
          <Text style={[type['type/body-m'], { color: color('text/secondary') }]}>A reviewer approves changes to live questions. Students keep seeing the current version until then.</Text>
          <InputField label="Reason" value={reason} onChangeText={setReason} multiline placeholder="e.g. The correct answer should be C — NCERT p. 45" />
          <PrimaryButton label="Send for review" onPress={() => void doSave(false, reason.trim())} loading={saving} disabled={reason.trim().length < 5} />
        </View>
      </BottomSheet>
    </SafeAreaView>
  );
}
