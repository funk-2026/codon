import { useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle } from 'phosphor-react-native';
import { BottomSheet, EmptyState, ErrorBanner, InputField, PrimaryButton, Screen, ScreenHeader, SecondaryButton, SkeletonBlock, useToast } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { useAuth } from '@/src/auth/AuthContext';
import { ApiError, newIdempotencyKey } from '@/src/api/client';
import { generateTest, getBuilderConfig, listMyTemplates, saveTemplate, type TemplateRow } from '@/src/api/customTests';
import { listBookmarkCollections } from '@/src/api/bookmarks';
import { BuilderGroups } from '@/src/custom/BuilderGroups';
import { DEFAULT_STATE, FILTER_LABEL, MAX_TEMPLATES, mixValid, pyqPreset, tickLines, toBlueprint, type CustomState, type FilterKey } from '@/src/custom/logic';
import { ROUTES } from '@/src/navigation/routes';
import { shadow } from '@/src/theme/elevation';

type Source = { kind: 'new' } | { kind: 'pyq'; n: 10 | 25 } | { kind: 'template'; row: TemplateRow };
type Step = 'p1' | 'p2' | 'p3' | 'fill';

/** Create a custom module: template rows, then three builder pages (or one summary for a preset or saved template), a tick list, and the save popup. */
export default function CustomModuleRoute() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const { show } = useToast();
  const qc = useQueryClient();
  const { user } = useAuth();
  const courseId = user?.selected_course_id ?? '';
  const cfg = useQuery({ queryKey: ['custom-config', courseId], queryFn: () => getBuilderConfig(courseId), enabled: !!courseId });
  const templates = useQuery({ queryKey: ['custom-templates'], queryFn: listMyTemplates });
  const collections = useQuery({ queryKey: ['bookmark-collections'], queryFn: listBookmarkCollections, select: (r) => r.collections });

  const [source, setSource] = useState<Source>({ kind: 'new' });
  const [step, setStep] = useState<Step>('p1');
  // Opened from Home or a progress screen with a suggested focus (subjects, chapters, difficulty, status).
  const { patch } = useLocalSearchParams<{ patch?: string }>();
  const [s, setS] = useState<CustomState>(() => applyPatch(patch));
  const [touched, setTouched] = useState<FilterKey[]>([]);
  const [ticks, setTicks] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveTpl, setSaveTpl] = useState(false);
  const [tplName, setTplName] = useState('');
  const key = useRef(newIdempotencyKey());

  const set = (p: Partial<CustomState>) => { setS((x) => ({ ...x, ...p })); setTouched((t) => [...new Set([...t, ...(Object.keys(p).map(keyOf) as FilterKey[])])]); };
  const asked: FilterKey[] = source.kind === 'template' ? ((source.row.ask?.keys ?? []) as FilterKey[]) : [];
  const unset = asked.filter((k) => !touched.includes(k));
  const names = useMemo(() => {
    const subjects: Record<string, string> = {};
    const chapters: Record<string, string> = {};
    for (const sj of cfg.data?.subjects ?? []) { subjects[sj.id] = sj.name; for (const ch of sj.chapters) chapters[ch.id] = ch.name; }
    const tags = Object.fromEntries((cfg.data?.tags ?? []).map((t) => [t.id, t.label]));
    return { subjects, chapters, tags };
  }, [cfg.data]);

  const pick = (src: Source) => {
    setSource(src);
    setTouched([]);
    if (src.kind === 'new') { setS(DEFAULT_STATE); setStep('p1'); }
    else if (src.kind === 'pyq') { setS(pyqPreset(src.n)); setStep('fill'); }
    else { setS({ ...DEFAULT_STATE, ...((src.row.ask?.state as Partial<CustomState>) ?? {}) }); setStep('fill'); }
  };

  const create = useMutation({
    mutationFn: async () => {
      const bp = toBlueprint(s, courseId, { pyq: source.kind === 'pyq' });
      if (saveTpl && tplName.trim()) await saveTemplate({ title: tplName.trim(), blueprint: toBlueprint({ ...s, name: '' }, courseId, { pyq: source.kind === 'pyq' }), ask: { keys: [], state: { ...s, name: '' } } });
      return generateTest(bp, key.current);
    },
    onSuccess: (r) => {
      void qc.invalidateQueries({ queryKey: ['custom-templates'] });
      void qc.invalidateQueries({ queryKey: ['custom-challenges'] });
      setSaveOpen(false);
      router.replace({ pathname: ROUTES.student.customStart, params: { id: r.test.id } });
    },
    onError: (e) => {
      key.current = newIdempotencyKey();
      const code = e instanceof ApiError ? e.code : undefined;
      show(code === 'pool_too_small' ? 'Not enough questions match. Loosen a filter and try again.' : code === 'quota_exceeded' ? 'You have reached today’s limit for custom modules.' : code === 'too_many_templates' ? 'You already have 3 saved templates. Delete one first.' : 'Couldn’t make the module. Try again.', 'error');
    },
  });

  const canNext = mixValid(s) && (step !== 'fill' || unset.length === 0);
  const tplFull = (templates.data?.length ?? 0) >= MAX_TEMPLATES;
  const keysFor: Record<Step, FilterKey[]> = { p1: ['count', 'difficulty', 'from', 'skip', 'order'], p2: ['subjects'], p3: ['tags', 'mode', 'marking', 'timing'], fill: [] };
  const pageNo = step === 'p1' ? 1 : step === 'p2' ? 2 : 3;
  const pill = (label: string, on: boolean, onPress: () => void, tone: 'accent/default' | 'semantic/success' = 'accent/default') => (
    <Pressable key={label} onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: on }} style={{ minHeight: 40, paddingHorizontal: space.md, justifyContent: 'center', borderRadius: radius.pill, backgroundColor: on ? color('accent/tint') : color('bg/surface'), borderWidth: 1.5, borderColor: on ? color(tone) : color('border/subtle') }}>
      <Text style={[type['type/body-m-medium'], { color: on ? color(tone) : color('text/secondary') }]}>{label}</Text>
    </Pressable>
  );

  const next = () => {
    if (!canNext) return;
    if (step === 'p1') setStep('p2');
    else if (step === 'p2') setStep('p3');
    else setTicks(true);
  };
  const back = () => (step === 'p2' ? setStep('p1') : step === 'p3' ? setStep('p2') : router.back());

  return (
    <Screen keyboard>
      <ScreenHeader title="Create a custom module" onBack={back} />
      <ScrollView contentContainerStyle={{ padding: space.md, gap: space.md, paddingBottom: space['3xl'] }} keyboardShouldPersistTaps="handled">
        {cfg.isPending ? <SkeletonBlock height={200} radius={radius.lg} /> : cfg.isError ? <ErrorBanner onRetry={() => void cfg.refetch()} /> : (
          <>
            {step === 'p1' || step === 'fill' ? (
              <View style={{ gap: space.xs }}>
                <Text style={[type['type/overline'], { color: color('text/tertiary') }]}>PICK A TEMPLATE</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs }}>
                  {pill('New template', source.kind === 'new', () => pick({ kind: 'new' }))}
                  {pill('PYQ 10', source.kind === 'pyq' && source.n === 10, () => pick({ kind: 'pyq', n: 10 }))}
                  {pill('PYQ 25', source.kind === 'pyq' && source.n === 25, () => pick({ kind: 'pyq', n: 25 }))}
                </View>
                <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>Your saved templates (max {MAX_TEMPLATES})</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs }}>
                  {(templates.data ?? []).map((t) => pill(t.title, source.kind === 'template' && source.row.id === t.id, () => pick({ kind: 'template', row: t })))}
                  {(templates.data ?? []).length === 0 ? <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>None yet. Save one when you make a module, or use Create a template.</Text> : null}
                </View>
              </View>
            ) : null}

            {step !== 'fill' ? (
              <>
                <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>Page {pageNo} of 3</Text>
                <BuilderGroups keys={keysFor[step]} s={s} set={set} cfg={cfg.data} collections={collections.data ?? []} />
                {step === 'p3' ? <InputField label="8. Name the test (optional)" value={s.name} onChangeText={(v) => setS((x) => ({ ...x, name: v }))} maxLength={120} /> : null}
              </>
            ) : (
              <>
                <Text style={[type['type/h3'], { color: color('accent/default') }]}>{source.kind === 'pyq' ? `Pre-set: PYQ ${source.n}` : source.kind === 'template' ? source.row.title : ''}</Text>
                {tickLines(s, names, source.kind === 'pyq').map((l) => (
                  <View key={l} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                    <CheckCircle size={20} color={color('semantic/success')} weight="fill" />
                    <Text style={[type['type/body-m'], { color: color('text/primary'), flex: 1 }]}>{l}</Text>
                  </View>
                ))}
                {asked.length ? (
                  <View style={{ marginTop: space.sm }}>
                    <Text style={[type['type/overline'], { color: color('semantic/danger'), marginBottom: space.xs }]}>CHOOSE THESE NOW</Text>
                    <BuilderGroups keys={asked} s={s} set={set} cfg={cfg.data} collections={collections.data ?? []} unset={unset} />
                  </View>
                ) : null}
              </>
            )}
            {!mixValid(s) ? <Text style={[type['type/caption'], { color: color('semantic/danger') }]}>The custom difficulty must total 100%.</Text> : null}
          </>
        )}
      </ScrollView>
      <View style={{ flexDirection: 'row', gap: space.sm, padding: space.md }}>
        {step === 'p2' || step === 'p3' ? <View style={{ flex: 1 }}><SecondaryButton label="Previous" onPress={back} /></View> : null}
        <View style={{ flex: 1 }}><PrimaryButton label="Next" onPress={next} disabled={!canNext || cfg.isPending} /></View>
      </View>

      <BottomSheet visible={ticks} onClose={() => setTicks(false)} title="Choose your options" maxHeightPct={0.9}>
        <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 420 }}>
          <View style={{ gap: space.sm, paddingBottom: space.md }}>
            {tickLines(s, names, source.kind === 'pyq').map((l) => (
              <View key={l} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                <CheckCircle size={20} color={color('semantic/success')} weight="fill" />
                <Text style={[type['type/body-m'], { color: color('text/primary'), flex: 1 }]}>{l}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
        <PrimaryButton label="Next" onPress={() => { setTicks(false); setSaveOpen(true); }} />
      </BottomSheet>

      <BottomSheet visible={saveOpen} onClose={() => !create.isPending && setSaveOpen(false)} title="Save this template" dismissable={!create.isPending}>
        <View style={{ gap: space.sm, paddingBottom: space.md }}>
          <Pressable onPress={() => !tplFull && setSaveTpl((v) => !v)} accessibilityRole="checkbox" accessibilityState={{ checked: saveTpl, disabled: tplFull }} style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: space.sm, opacity: tplFull ? 0.5 : 1 }}>
            <CheckCircle size={22} color={saveTpl ? color('accent/default') : color('text/tertiary')} weight={saveTpl ? 'fill' : 'regular'} />
            <Text style={[type['type/body-m'], { color: color('text/primary'), flex: 1 }]}>{tplFull ? 'You already have 3 saved templates' : 'Save for future use'}</Text>
          </Pressable>
          {saveTpl ? <InputField label="Template name" value={tplName} onChangeText={setTplName} placeholder="Template name" maxLength={80} /> : null}
          <InputField label="Name this test" value={s.name} onChangeText={(v) => setS((x) => ({ ...x, name: v }))} placeholder="Test name" maxLength={120} />
          <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>The test name shows in your history and on the leaderboard.</Text>
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <View style={{ flex: 1 }}><SecondaryButton label="Cancel" onPress={() => setSaveOpen(false)} disabled={create.isPending} /></View>
            <View style={{ flex: 1 }}><PrimaryButton label="Start test" onPress={() => create.mutate()} loading={create.isPending} disabled={(saveTpl && !tplName.trim()) || !s.name.trim()} /></View>
          </View>
        </View>
      </BottomSheet>
    </Screen>
  );
}

// Which filter group a patched key belongs to, so a template's "choose this now" groups clear once the student has chosen.
function keyOf(k: string): FilterKey {
  const map: Record<string, FilterKey> = { count: 'count', difficulty: 'difficulty', mix: 'difficulty', from: 'from', bookmarkTypes: 'from', show: 'from', skipDays: 'skip', order: 'order', subjectIds: 'subjects', chapterIds: 'subjects', tagIds: 'tags', includeUntagged: 'tags', mode: 'mode', marking: 'marking', custom: 'marking', timed: 'timing', minutes: 'timing' };
  return map[k] ?? 'count';
}

export { FILTER_LABEL };


/** Reads a suggested blueprint patch ({ filters: { subject_ids, chapter_ids, difficulty, status }, count }) into builder choices. */
function applyPatch(raw?: string): CustomState {
  if (!raw) return DEFAULT_STATE;
  try {
    const p = JSON.parse(raw) as { count?: number; filters?: { subject_ids?: string[]; chapter_ids?: string[]; difficulty?: string[]; status?: string[] } };
    const f = p.filters ?? {};
    const diff = f.difficulty?.length === 1 && ['easy', 'medium', 'hard'].includes(f.difficulty[0]) ? (f.difficulty[0] as CustomState['difficulty']) : 'all';
    const show = f.status?.length === 1 && ['unattempted', 'incorrect', 'correct', 'skipped'].includes(f.status[0]) ? (f.status[0] as CustomState['show']) : 'all';
    const counts = [10, 20, 30, 50, 70, 100];
    return { ...DEFAULT_STATE, subjectIds: f.subject_ids ?? [], chapterIds: f.chapter_ids ?? [], difficulty: diff, show, count: (counts.includes(p.count ?? 0) ? p.count : 20) as CustomState['count'] };
  } catch {
    return DEFAULT_STATE;
  }
}
