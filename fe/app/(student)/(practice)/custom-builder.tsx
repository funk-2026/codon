import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { CaretLeft, DotsThree, Lightbulb, Lock, WarningCircle } from 'phosphor-react-native';
import {
  BottomSheet, EmptyState, ErrorBanner, InputField, PrimaryButton, SecondaryButton, SkeletonBlock, TextButton, useToast,
} from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { useAuth } from '@/src/auth/AuthContext';
import { useAppConfig, useFlag } from '@/src/config/AppConfigContext';
import { ApiError } from '@/src/api/client';
import {
  createTemplate, getShared, listTemplates, shareBlueprint,
  type Blueprint, type BlueprintIssue, type GenerateResult, type Suggestion, type Template,
} from '@/src/api/customTests';
import { useBuilder } from '@/src/custom/useBuilder';
import { resolvedMarks, summarizeBlueprint } from '@/src/custom/blueprint';
import { ChipGroup, Section, ScopeTree, Segmented, Stepper } from '@/src/custom/ui';
import { formatClock } from '@/src/attempt/logic';
import { track } from '@/src/analytics/track';

const MIXES: { key: string; label: string; mix?: Blueprint['difficulty_mix'] }[] = [
  { key: 'any', label: 'Any' },
  { key: 'easy', label: 'Easier', mix: { easy: 0.5, medium: 0.3, hard: 0.2 } },
  { key: 'balanced', label: 'Balanced', mix: { easy: 0.3, medium: 0.5, hard: 0.2 } },
  { key: 'hard', label: 'Harder', mix: { easy: 0.2, medium: 0.3, hard: 0.5 } },
];
const mixKey = (m?: Blueprint['difficulty_mix']) =>
  !m || Object.keys(m).length === 0 ? 'any' : MIXES.find((x) => x.mix && x.mix.easy === m.easy && x.mix.medium === m.medium && x.mix.hard === m.hard)?.key ?? 'any';

const STRATEGY_LABEL: Record<string, string> = {
  random: 'Random', unseen_first: 'New questions first', weak_first: 'My weak areas', spaced: 'Due for revision',
};
const ORDER_LABEL: Record<string, string> = {
  random: 'Random', syllabus: 'Syllabus order', easy_first: 'Easy → hard', hard_first: 'Hard → easy', unattempted_first: 'Unattempted first',
};

export default function CustomBuilderRoute() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { show } = useToast();
  const { user } = useAuth();
  const enabled = useFlag('custom_test.enabled');
  const app = useAppConfig();
  const params = useLocalSearchParams<{ code?: string; patch?: string }>();

  const courseId = user?.selected_course_id ?? undefined;
  const B = useBuilder(courseId);
  const { config, bp, api, count, issues, limits } = B;

  const [advanced, setAdvanced] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [codeOpen, setCodeOpen] = useState(false);
  const [quotaOpen, setQuotaOpen] = useState<{ resets_at?: string } | null>(null);
  const [done, setDone] = useState<GenerateResult | null>(null);
  const [genError, setGenError] = useState<string | null>(null);
  const [genSuggestions, setGenSuggestions] = useState<Suggestion[]>([]);
  const [serverIssues, setServerIssues] = useState<BlueprintIssue[]>([]);

  useEffect(() => {
    track('custom.builder_opened', { via: params.code ? 'shared_code' : 'direct' });
  }, [params.code]);

  // deep link: codon://custom-test/shared/<code> → pre-fill the builder
  useEffect(() => {
    if (!params.code || !config) return;
    (async () => {
      try {
        const r = await getShared(String(params.code));
        api.load(r.blueprint);
        show(r.still_valid ? 'Shared test loaded — adjust anything, then generate.' : 'Loaded, but some settings changed — check the highlighted fields.', 'success');
      } catch (e) {
        show(e instanceof ApiError && e.status === 410 ? 'That share link has expired.' : 'Couldn’t load that shared test.', 'error');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.code, !!config]);

  // "Practise this" from Progress / recommendations: a server patch applied on top of a fresh blueprint
  const appliedPatch = useRef(false);
  useEffect(() => {
    if (!params.patch || !config || appliedPatch.current) return;
    appliedPatch.current = true;
    try {
      api.patch(JSON.parse(String(params.patch)));
    } catch {
      /* a malformed patch is ignored — the builder just opens with defaults */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.patch, !!config]);

  const fieldError = (prefix: string) => {
    const all = [...issues, ...serverIssues];
    return all.find((i) => i.field === prefix || i.field.startsWith(`${prefix}.`))?.message ?? null;
  };

  const subjectNames = useMemo(() => Object.fromEntries((config?.subjects ?? []).map((s) => [s.id, s.name])), [config]);

  // count state → footer text
  const c = count.status === 'ready' ? count.data : count.status === 'loading' ? count.previous : undefined;
  const requested = bp?.count ?? 0;
  const effective = c?.clamped_to ?? requested;
  const short = !!c && c.available < effective;
  const none = !!c && c.available === 0;
  const canGenerate = !!bp && issues.length === 0 && !B.generating && !(none) && count.status !== 'error';

  const onGenerate = async () => {
    setGenError(null);
    setServerIssues([]);
    setGenSuggestions([]);
    try {
      const res = await B.generate();
      if (res.relaxations.length > 0) setDone(res);
      else router.replace({ pathname: '/(student)/(practice)/test-pre-start', params: { id: res.test.id } });
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.code === 'quota_exceeded') return setQuotaOpen({ resets_at: (e.details as any)?.resets_at });
        if (e.code === 'pool_too_small') {
          setGenSuggestions(((e.details as any)?.suggestions as Suggestion[]) ?? []);
          return setGenError(`Only ${(e.details as any)?.available ?? 0} questions match your choices.`);
        }
        if (e.code === 'invalid_blueprint') {
          setServerIssues(Array.isArray(e.details) ? (e.details as BlueprintIssue[]) : []);
          return setGenError('Some settings need attention — see the highlighted fields.');
        }
        if (e.code === 'rate_limited') return setGenError('You’re generating too quickly. Wait a moment and try again.');
        if (e.code === 'too_many_tests') return setGenError('You have too many saved tests. Delete some in My custom tests first.');
      }
      setGenError('Couldn’t build your test. Check your connection and try again.');
    }
  };

  const startNow = (r: GenerateResult) => {
    setDone(null);
    router.replace({ pathname: '/(student)/(practice)/test-pre-start', params: { id: r.test.id } });
  };

  // ── guards ──
  if (!enabled && app.status === 'ready') {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: color('bg/canvas') }]}>
        <Header onBack={() => router.back()} />
        <EmptyState
          icon={<Lock size={32} color={color('text/tertiary')} />}
          title="Custom tests aren’t available yet"
          description="We’re rolling this out gradually. Check back soon."
          action={<TextButton label="Back to Practice" onPress={() => router.back()} />}
          style={{ flex: 1, justifyContent: 'center' }}
        />
      </SafeAreaView>
    );
  }
  if (!courseId) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: color('bg/canvas') }]}>
        <Header onBack={() => router.back()} />
        <EmptyState
          icon={<WarningCircle size={32} color={color('text/tertiary')} />}
          title="Choose your course first"
          description="Custom tests are built from your course’s question bank."
          action={<TextButton label="Choose course" onPress={() => router.push('/course-selection')} />}
          style={{ flex: 1, justifyContent: 'center' }}
        />
      </SafeAreaView>
    );
  }
  if (B.cfgStatus === 'loading' || !bp || !config || !limits) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: color('bg/canvas') }]}>
        <Header onBack={() => router.back()} />
        {B.cfgStatus === 'error' ? (
          <EmptyState
            icon={<WarningCircle size={32} color={color('semantic/danger')} weight="fill" />}
            title="Couldn’t load the builder"
            description="Check your connection and try again."
            action={<TextButton label="Retry" onPress={B.reloadConfig} />}
            style={{ flex: 1, justifyContent: 'center' }}
          />
        ) : (
          <View style={{ padding: space.md, gap: space.md }}>
            <SkeletonBlock height={90} radius={radius.lg} />
            <SkeletonBlock height={200} radius={radius.lg} />
            <SkeletonBlock height={120} radius={radius.lg} />
          </View>
        )}
      </SafeAreaView>
    );
  }
  if (config.total_available === 0) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: color('bg/canvas') }]}>
        <Header onBack={() => router.back()} />
        <EmptyState
          icon={<Lightbulb size={32} color={color('text/tertiary')} />}
          title="No questions to build from yet"
          description="Your course’s question bank is still being prepared."
          action={<TextButton label="Back to Practice" onPress={() => router.back()} />}
          style={{ flex: 1, justifyContent: 'center' }}
        />
      </SafeAreaView>
    );
  }

  const f = bp.filters;
  const q = B.tier === 'free' ? config.entitlement : null;
  const marks = resolvedMarks(bp);
  const timedOn = bp.timing.timed;
  const bookmarkCollections = app.config?.bookmark_collections ?? [];
  const statusSupported = config.flags.status_filters;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: color('bg/canvas') }]}>
      <Header onBack={() => router.back()} onMenu={() => setMenuOpen(true)} />

      <ScrollView contentContainerStyle={{ padding: space.md, gap: space.md, paddingBottom: 200 + insets.bottom }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {q ? (
          <View style={{ backgroundColor: color('accent/tint'), borderRadius: radius.md, padding: space.md, gap: 2 }}>
            <Text style={[type['type/body-m-medium'], { color: color('text/primary') }]}>
              Free plan: {q.daily_generations_left ?? 0} of {q.daily_generations_limit ?? 0} custom tests left today · up to {q.max_questions} questions each
            </Text>
            <Pressable onPress={() => router.push('/(student)/(profile)/subscription-plans')} accessibilityRole="link">
              <Text style={[type['type/caption'], { color: color('accent/default') }]}>Upgrade for unlimited tests and larger sizes →</Text>
            </Pressable>
          </View>
        ) : null}

        {config.presets.length > 0 || true ? (
          <PresetRow presets={config.presets} onPick={(p) => { api.load(p.blueprint); track('custom.filter_changed', { via: 'preset' }); }} onTemplates={() => setTemplatesOpen(true)} />
        ) : null}

        <Section title="Scope" hint="Pick subjects, chapters or topics. Leave empty to use everything." error={fieldError('filters.subject_ids') ?? fieldError('filters.chapter_ids') ?? fieldError('filters.topic_ids')}>
          <ScopeTree
            subjects={config.subjects}
            selectedSubjects={f.subject_ids ?? []}
            selectedChapters={f.chapter_ids ?? []}
            selectedTopics={f.topic_ids ?? []}
            onSubject={api.toggleSubject}
            onChapter={api.toggleChapter}
            onTopic={api.toggleTopic}
          />
        </Section>

        <Section title="Difficulty" error={fieldError('filters.difficulty') ?? fieldError('difficulty_mix')}>
          <ChipGroup
            options={config.difficulty.map((d) => ({ key: d.key, label: d.label, count: d.available, disabled: d.available === 0 }))}
            selected={f.difficulty ?? []}
            onToggle={api.toggleDifficulty}
          />
          <Text style={[type['type/caption'], { color: color('text/secondary') }]}>Difficulty mix</Text>
          <Segmented
            options={MIXES.map((m) => ({ key: m.key, label: m.label }))}
            value={mixKey(bp.difficulty_mix)}
            onChange={(k) => {
              const m = MIXES.find((x) => x.key === k)?.mix;
              api.patch({ difficulty_mix: m ?? null });
            }}
          />
        </Section>

        <Section
          title="Which questions?"
          hint={statusSupported ? 'Focus on what you haven’t mastered.' : 'Question-status filters are coming soon.'}
          error={fieldError('filters.status') ?? fieldError('filters.bookmark_collection_ids')}
        >
          <ChipGroup
            options={config.statuses.map((s) => ({ key: s.key, label: s.label, disabled: !s.supported, note: s.supported ? undefined : 'coming soon' }))}
            selected={f.status ?? []}
            onToggle={api.toggleStatus}
            disabled={!statusSupported}
          />
          {(f.status ?? []).includes('bookmarked') && bookmarkCollections.length > 0 ? (
            <>
              <Text style={[type['type/caption'], { color: color('text/secondary') }]}>From these bookmark lists (none = all)</Text>
              <ChipGroup
                options={bookmarkCollections.map((b) => ({ key: b.id, label: b.label }))}
                selected={f.bookmark_collection_ids ?? []}
                onToggle={api.toggleCollection}
              />
            </>
          ) : null}
        </Section>

        <Section title="Number of questions" error={fieldError('count')}>
          <Stepper
            label="questions"
            value={bp.count}
            min={limits.min_questions}
            max={B.maxCount}
            step={5}
            presets={[10, 20, 30, 50, 90]}
            onChange={api.setCount}
            unit={`of up to ${B.maxCount}`}
          />
        </Section>

        <Section title="Mode">
          <Segmented
            options={[
              { key: 'exam', label: 'Exam' },
              { key: 'tutor', label: 'Tutor', disabled: !config.modes.includes('tutor') },
            ]}
            value={bp.mode ?? 'exam'}
            onChange={api.setMode}
          />
          <Text style={[type['type/caption'], { color: color('text/secondary') }]}>
            {bp.mode === 'tutor' ? 'Check each answer and read the explanation as you go.' : 'Answer everything first; see results at the end.'}
            {!config.modes.includes('tutor') ? ' Tutor mode is coming soon.' : ''}
          </Text>
        </Section>

        <Section title="Timing" error={fieldError('timing')}>
          <Segmented options={[{ key: 'off', label: 'Untimed' }, { key: 'on', label: 'Timed' }]} value={timedOn ? 'on' : 'off'} onChange={(k) => api.setTimed(k === 'on')} />
          {timedOn ? (
            <Stepper
              label="minutes"
              value={bp.timing.duration_minutes ?? limits.min_duration}
              min={limits.min_duration}
              max={limits.max_duration}
              step={5}
              unit={`minutes (${formatClock((bp.timing.duration_minutes ?? 0) * 60)})`}
              onChange={api.setDuration}
            />
          ) : null}
        </Section>

        <Section title="Marking" error={fieldError('marking')}>
          <ChipGroup
            single
            options={config.marking_presets.map((m) => ({ key: m.key, label: m.label }))}
            selected={[bp.marking.preset ?? 'neet']}
            onToggle={(k) => api.setMarking(k === 'custom' ? { preset: 'custom', correct: marks.correct, wrong: marks.wrong } : { preset: k })}
          />
          {bp.marking.preset === 'custom' ? (
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              <View style={{ flex: 1 }}>
                <InputField
                  label="Correct (+)"
                  value={String(bp.marking.correct ?? '')}
                  keyboardType="decimal-pad"
                  onChangeText={(t: string) => api.setMarking({ ...bp.marking, correct: t === '' ? undefined : Number(t.replace(',', '.')) })}
                />
              </View>
              <View style={{ flex: 1 }}>
                <InputField
                  label="Wrong (−)"
                  value={String(bp.marking.wrong ?? '')}
                  keyboardType="numbers-and-punctuation"
                  onChangeText={(t: string) => api.setMarking({ ...bp.marking, wrong: t === '' || t === '-' ? undefined : Number(t.replace(',', '.')) })}
                />
              </View>
            </View>
          ) : null}
          <Text style={[type['type/caption'], { color: color('text/secondary') }]}>
            +{marks.correct} for a correct answer, {marks.wrong === 0 ? 'no penalty' : `−${Math.abs(marks.wrong)}`} for a wrong one.
          </Text>
        </Section>

        <Pressable onPress={() => setAdvanced((a) => !a)} accessibilityRole="button" accessibilityState={{ expanded: advanced }} style={{ minHeight: 44, justifyContent: 'center' }}>
          <Text style={[type['type/body-m-medium'], { color: color('accent/default') }]}>{advanced ? 'Hide advanced options' : 'Advanced options'}</Text>
        </Pressable>

        {advanced ? (
          <>
            <Section title="Question source" error={fieldError('filters.source_types')}>
              <ChipGroup options={config.sources.map((s) => ({ key: s.key, label: s.label }))} selected={f.source_types ?? []} onToggle={api.toggleSource} />
            </Section>
            <Section title="Skip recently attempted" hint="Don’t repeat questions you answered in the last…" error={fieldError('filters.exclude_attempted_within_days')}>
              <ChipGroup
                single
                options={[{ key: '0', label: 'Off' }, { key: '7', label: '7 days' }, { key: '14', label: '14 days' }, { key: '30', label: '30 days' }]}
                selected={[String(f.exclude_attempted_within_days ?? 0)]}
                onToggle={(k) => api.setFilters({ exclude_attempted_within_days: Number(k) })}
              />
            </Section>
            <Section title="NCERT" hint="Limit to one class and page range." error={fieldError('filters.ncert')}>
              <ChipGroup
                single
                options={[6, 7, 8, 9, 10, 11, 12].map((n) => ({ key: String(n), label: `Class ${n}` }))}
                selected={f.ncert?.class ? [String(f.ncert.class)] : []}
                onToggle={(k) => api.setFilters({ ncert: f.ncert?.class === Number(k) ? undefined : { ...f.ncert, class: Number(k) } })}
              />
              {f.ncert?.class ? (
                <View style={{ flexDirection: 'row', gap: space.sm }}>
                  <View style={{ flex: 1 }}>
                    <InputField label="Page from" value={String(f.ncert.page_from ?? '')} keyboardType="number-pad" onChangeText={(t: string) => api.setFilters({ ncert: { ...f.ncert, page_from: t ? Number(t) : undefined } })} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <InputField label="Page to" value={String(f.ncert.page_to ?? '')} keyboardType="number-pad" onChangeText={(t: string) => api.setFilters({ ncert: { ...f.ncert, page_to: t ? Number(t) : undefined } })} />
                  </View>
                </View>
              ) : null}
            </Section>
            {config.tags.length > 0 ? (
              <Section title="Tags">
                <ChipGroup options={config.tags.slice(0, 20).map((t) => ({ key: t.id, label: t.label, count: t.uses }))} selected={f.tag_ids ?? []} onToggle={api.toggleTag} />
              </Section>
            ) : null}
            <Section title="Selection strategy" error={fieldError('strategy')}>
              <ChipGroup single options={config.strategies.map((s) => ({ key: s, label: STRATEGY_LABEL[s] ?? s }))} selected={[bp.strategy ?? 'random']} onToggle={api.setStrategy} />
            </Section>
            <Section title="Question order" error={fieldError('order')}>
              <ChipGroup single options={config.orders.map((o) => ({ key: o, label: ORDER_LABEL[o] ?? o }))} selected={[bp.order ?? 'random']} onToggle={api.setOrder} />
            </Section>
            <Section title="Balance across subjects" error={fieldError('subject_weights')}>
              <ChipGroup
                single
                options={[{ key: 'auto', label: 'Automatic' }, { key: 'even', label: 'Even' }, { key: 'proportional', label: 'Proportional' }]}
                selected={[typeof bp.subject_weights === 'string' ? bp.subject_weights : 'auto']}
                onToggle={(k) => api.patch({ subject_weights: k === 'auto' ? null : k })}
              />
            </Section>
            <Section title="Name (optional)" error={fieldError('title')}>
              <InputField label="Title" value={bp.title ?? ''} onChangeText={api.setTitle} placeholder="Auto-named if left empty" />
            </Section>
          </>
        ) : null}
      </ScrollView>

      {/* Footer: live count + generate */}
      <View
        style={{
          position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: color('bg/surface'), borderTopWidth: 1, borderTopColor: color('border/subtle'),
          paddingHorizontal: space.md, paddingTop: space.sm, paddingBottom: space.sm + insets.bottom, gap: space.xs,
        }}
      >
        <CountLine state={count} requested={requested} effective={effective} onSuggestion={(s) => api.patch(s.patch)} issues={issues} />
        {genError ? (
          <View style={{ gap: space.xs }}>
            <ErrorBanner message={genError} />
            {genSuggestions.length > 0 ? <SuggestionChips suggestions={genSuggestions} onPick={(s) => { setGenError(null); api.patch(s.patch); }} /> : null}
          </View>
        ) : null}
        <PrimaryButton
          label={B.generating ? 'Building your test…' : short && c ? `Generate ${c.available} questions` : 'Generate test'}
          onPress={() => {
            if (short && c && c.available >= limits.min_questions) api.setCount(c.available);
            void onGenerate();
          }}
          loading={B.generating}
          disabled={!canGenerate}
        />
      </View>

      {/* Menu */}
      <BottomSheet visible={menuOpen} onClose={() => setMenuOpen(false)} title="More">
        <View style={{ gap: space.sm }}>
          <SecondaryButton label="Save as template" onPress={() => { setMenuOpen(false); setSaveOpen(true); }} disabled={issues.length > 0} />
          <SecondaryButton
            label="Share this setup"
            disabled={issues.length > 0}
            onPress={async () => {
              setMenuOpen(false);
              try {
                const r = await shareBlueprint(bp);
                await Share.share({ message: `Try this custom test on Codon: ${summarizeBlueprint(bp, { subjects: subjectNames })}\nOpen: ${r.deep_link}\nCode: ${r.code}` });
              } catch {
                show('Couldn’t create a share link. Try again.', 'error');
              }
            }}
          />
          <SecondaryButton label="Enter a share code" onPress={() => { setMenuOpen(false); setCodeOpen(true); }} />
          <SecondaryButton label="My saved templates" onPress={() => { setMenuOpen(false); setTemplatesOpen(true); }} />
          <SecondaryButton label="My custom tests" onPress={() => { setMenuOpen(false); router.push('/(student)/(practice)/custom-tests'); }} />
          <TextButton label="Reset all settings" onPress={() => { setMenuOpen(false); api.reset(); }} />
        </View>
      </BottomSheet>

      <SaveTemplateSheet visible={saveOpen} onClose={() => setSaveOpen(false)} blueprint={bp} defaultName={bp.title || summarizeBlueprint(bp, { subjects: subjectNames })} />
      <TemplatesSheet visible={templatesOpen} onClose={() => setTemplatesOpen(false)} onPick={(t) => { api.load(t.blueprint); setTemplatesOpen(false); }} />
      <CodeSheet visible={codeOpen} onClose={() => setCodeOpen(false)} onLoaded={(b) => { api.load(b); setCodeOpen(false); }} />

      {/* Quota */}
      <BottomSheet visible={!!quotaOpen} onClose={() => setQuotaOpen(null)} title="You’ve used today’s free tests">
        <Text style={[type['type/body-m'], { color: color('text/secondary') }]}>
          Free plans include a few custom tests each day.
          {quotaOpen?.resets_at ? ` Your limit resets at ${new Date(quotaOpen.resets_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.` : ''}
        </Text>
        <View style={{ gap: space.sm, marginTop: space.lg }}>
          <PrimaryButton label="See plans" onPress={() => { setQuotaOpen(null); router.push('/(student)/(profile)/subscription-plans'); }} />
          <SecondaryButton label="Maybe later" onPress={() => setQuotaOpen(null)} />
        </View>
      </BottomSheet>

      {/* Adjustments made during generation are never silent */}
      <BottomSheet visible={!!done} onClose={() => done && startNow(done)} title="Your test is ready">
        {done ? (
          <>
            <Text style={[type['type/body-m'], { color: color('text/secondary') }]}>{done.test.total_questions} questions. We adjusted a few things to make this work:</Text>
            <View style={{ gap: space.xs, marginTop: space.sm }}>
              {done.relaxations.map((r) => (
                <Text key={r.code} style={[type['type/body-m'], { color: color('text/primary') }]}>• {r.message}</Text>
              ))}
            </View>
            <PrimaryButton label="Continue" onPress={() => startNow(done)} style={{ marginTop: space.lg }} />
          </>
        ) : null}
      </BottomSheet>
    </SafeAreaView>
  );
}

function Header({ onBack, onMenu }: { onBack: () => void; onMenu?: () => void }) {
  const { color, type, space } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.md, paddingTop: space.md }}>
      <Pressable onPress={onBack} hitSlop={space.xs} accessibilityRole="button" accessibilityLabel="Back" style={{ minWidth: 44, minHeight: 44, justifyContent: 'center' }}>
        <CaretLeft size={24} color={color('text/primary')} />
      </Pressable>
      <Text accessibilityRole="header" style={[type['type/h1'], { color: color('text/primary'), flex: 1 }]}>Custom test</Text>
      {onMenu ? (
        <Pressable onPress={onMenu} hitSlop={space.xs} accessibilityRole="button" accessibilityLabel="More options" style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
          <DotsThree size={28} weight="bold" color={color('text/primary')} />
        </Pressable>
      ) : null}
    </View>
  );
}

function PresetRow({ presets, onPick, onTemplates }: { presets: { id: string; title: string; description?: string; blueprint: Blueprint }[]; onPick: (p: { blueprint: Blueprint }) => void; onTemplates: () => void }) {
  const { color, type, space, radius } = useTheme();
  return (
    <View style={{ gap: space.xs }}>
      <Text style={[type['type/overline'], { color: color('text/tertiary') }]}>START FROM</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.xs }}>
        <Pressable onPress={onTemplates} accessibilityRole="button" style={{ minHeight: 40, paddingHorizontal: space.md, borderRadius: radius.pill, borderWidth: 1.5, borderColor: color('accent/default'), justifyContent: 'center' }}>
          <Text style={[type['type/body-m'], { color: color('accent/default') }]}>My templates</Text>
        </Pressable>
        {presets.map((p) => (
          <Pressable key={p.id} onPress={() => onPick(p)} accessibilityRole="button" accessibilityHint={p.description} style={{ minHeight: 40, paddingHorizontal: space.md, borderRadius: radius.pill, backgroundColor: color('bg/surface'), justifyContent: 'center' }}>
            <Text style={[type['type/body-m'], { color: color('text/primary') }]}>{p.title}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

function SuggestionChips({ suggestions, onPick }: { suggestions: Suggestion[]; onPick: (s: Suggestion) => void }) {
  const { color, type, space, radius } = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs }}>
      {suggestions.slice(0, 3).map((s) => (
        <Pressable key={s.code} onPress={() => onPick(s)} accessibilityRole="button" style={{ minHeight: 36, paddingHorizontal: space.sm, borderRadius: radius.pill, backgroundColor: color('accent/tint'), justifyContent: 'center' }}>
          <Text style={[type['type/caption'], { color: color('accent/default') }]}>{s.label}{s.gain > 0 ? ` (+${s.gain})` : ''}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function CountLine({ state, requested, effective, onSuggestion, issues }: {
  state: ReturnType<typeof useBuilder>['count']; requested: number; effective: number; onSuggestion: (s: Suggestion) => void; issues: BlueprintIssue[];
}) {
  const { color, type, space } = useTheme();
  if (issues.length > 0) {
    return <Text style={[type['type/body-m'], { color: color('semantic/warning') }]}>Fix the highlighted settings to continue.</Text>;
  }
  if (state.status === 'rate_limited') return <Text style={[type['type/body-m'], { color: color('text/secondary') }]}>Checking too fast — updating shortly…</Text>;
  if (state.status === 'error') return <Text style={[type['type/body-m'], { color: color('semantic/danger') }]}>Couldn’t check availability. You can still try to generate.</Text>;
  const c = state.status === 'ready' ? state.data : state.status === 'loading' ? state.previous : undefined;
  if (!c) return <Text style={[type['type/body-m'], { color: color('text/secondary') }]}>{state.status === 'loading' ? 'Checking questions…' : ' '}</Text>;
  const short = c.available < effective;
  return (
    <View style={{ gap: space['2xs'] }} accessibilityLiveRegion="polite">
      <Text style={[type['type/body-m-medium'], { color: c.available === 0 ? color('semantic/danger') : short ? color('semantic/warning') : color('text/primary') }]}>
        {state.status === 'loading' ? 'Updating… ' : ''}
        {c.available === 0
          ? 'No questions match these choices'
          : short
            ? `${c.available} questions match — you asked for ${effective}`
            : `${c.available.toLocaleString()} questions match`}
        {c.clamped_to != null && c.clamped_to < requested ? ` (free plan limit: ${c.clamped_to})` : ''}
      </Text>
      {c.bottleneck && short ? <Text style={[type['type/caption'], { color: color('text/secondary') }]}>{c.bottleneck.reason}</Text> : null}
      {short && c.suggestions.length > 0 ? <SuggestionChips suggestions={c.suggestions} onPick={onSuggestion} /> : null}
    </View>
  );
}

function SaveTemplateSheet({ visible, onClose, blueprint, defaultName }: { visible: boolean; onClose: () => void; blueprint: Blueprint; defaultName: string }) {
  const { space } = useTheme();
  const { show } = useToast();
  const [name, setName] = useState(defaultName);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (visible) setName(defaultName.slice(0, 80)); }, [visible, defaultName]);
  const save = async () => {
    setBusy(true);
    try {
      await createTemplate(name.trim() || 'My template', blueprint);
      show('Template saved', 'success');
      onClose();
    } catch (e) {
      show(e instanceof ApiError && e.status === 409 ? 'You’ve reached the template limit. Delete one first.' : 'Couldn’t save the template. Try again.', 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <BottomSheet visible={visible} onClose={onClose} title="Save as template" dismissable={!busy}>
      <View style={{ gap: space.md }}>
        <InputField label="Template name" value={name} onChangeText={setName} />
        <PrimaryButton label="Save" onPress={save} loading={busy} disabled={!name.trim()} />
      </View>
    </BottomSheet>
  );
}

function TemplatesSheet({ visible, onClose, onPick }: { visible: boolean; onClose: () => void; onPick: (t: Template) => void }) {
  const { color, type, space, radius } = useTheme();
  const [items, setItems] = useState<Template[] | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    if (!visible) return;
    setItems(null);
    setErr(false);
    listTemplates().then((r) => setItems(r.templates)).catch(() => setErr(true));
  }, [visible]);
  return (
    <BottomSheet visible={visible} onClose={onClose} title="My templates">
      {err ? (
        <ErrorBanner message="Couldn’t load your templates." onRetry={() => { setErr(false); listTemplates().then((r) => setItems(r.templates)).catch(() => setErr(true)); }} />
      ) : items == null ? (
        <SkeletonBlock height={60} radius={radius.md} />
      ) : items.length === 0 ? (
        <Text style={[type['type/body-m'], { color: color('text/secondary') }]}>No templates yet. Set up a test and choose “Save as template” from the menu.</Text>
      ) : (
        <View style={{ gap: space.sm }}>
          {items.map((t) => (
            <Pressable key={t.id} onPress={() => onPick(t)} accessibilityRole="button" style={{ padding: space.md, borderRadius: radius.md, backgroundColor: color('bg/sunken') }}>
              <Text style={[type['type/body-m-medium'], { color: color('text/primary') }]}>{t.title}</Text>
              <Text style={[type['type/caption'], { color: color('text/secondary') }]}>{summarizeBlueprint(t.blueprint)}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </BottomSheet>
  );
}

function CodeSheet({ visible, onClose, onLoaded }: { visible: boolean; onClose: () => void; onLoaded: (b: Blueprint) => void }) {
  const { space } = useTheme();
  const { show } = useToast();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const go = async () => {
    setBusy(true);
    try {
      const r = await getShared(code.trim());
      onLoaded(r.blueprint);
      show(r.still_valid ? 'Loaded' : 'Loaded — some settings changed, please review.', 'success');
    } catch (e) {
      show(e instanceof ApiError && e.status === 410 ? 'That code has expired.' : e instanceof ApiError && e.status === 404 ? 'No test found for that code.' : 'Couldn’t load that code.', 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <BottomSheet visible={visible} onClose={onClose} title="Enter a share code" dismissable={!busy}>
      <View style={{ gap: space.md }}>
        <InputField label="Code" value={code} onChangeText={setCode} autoCapitalize="none" autoCorrect={false} />
        <PrimaryButton label="Load" onPress={go} loading={busy} disabled={code.trim().length < 4} />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
