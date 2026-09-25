import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { CaretLeft, DotsThreeVertical, Plus, Sliders, WarningCircle } from 'phosphor-react-native';
import {
  BottomSheet, EmptyState, ErrorBanner, InputField, PrimaryButton, SecondaryButton, SkeletonBlock, TextButton, useToast,
} from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { ApiError, newIdempotencyKey } from '@/src/api/client';
import {
  deleteCustomTest, deleteTemplate, listCustomTests, listTemplates, regenerateCustomTest, renameCustomTest,
  type CustomTestRow, type CustomTestState, type Template,
} from '@/src/api/customTests';
import { summarizeBlueprint } from '@/src/custom/blueprint';

type Tab = 'tests' | 'templates';
const STATES: { key: CustomTestState | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'in_progress', label: 'In progress' },
  { key: 'not_started', label: 'Not started' },
  { key: 'completed', label: 'Completed' },
];

const when = (iso?: string) => (iso ? new Date(iso).toLocaleDateString([], { day: 'numeric', month: 'short' }) : '');

export default function CustomTestsRoute() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { show } = useToast();

  const [tab, setTab] = useState<Tab>('tests');
  const [state, setState] = useState<CustomTestState | 'all'>('all');
  const [rows, setRows] = useState<CustomTestRow[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  const [error, setError] = useState(false);
  const [menu, setMenu] = useState<CustomTestRow | null>(null);
  const [renaming, setRenaming] = useState<CustomTestRow | null>(null);
  const [title, setTitle] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<CustomTestRow | null>(null);
  const [busy, setBusy] = useState(false);
  const seq = useRef(0);

  const load = useCallback(async () => {
    const my = ++seq.current;
    setLoading(true);
    setError(false);
    try {
      if (tab === 'tests') {
        const r = await listCustomTests({ state: state === 'all' ? undefined : state, limit: 20 });
        if (my !== seq.current) return;
        setRows(r.items);
        setCursor(r.next_cursor);
      } else {
        const r = await listTemplates();
        if (my !== seq.current) return;
        setTemplates(r.templates);
      }
    } catch {
      if (my === seq.current) setError(true);
    } finally {
      if (my === seq.current) setLoading(false);
    }
  }, [tab, state]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadMore = async () => {
    if (!cursor || more) return;
    setMore(true);
    try {
      const r = await listCustomTests({ state: state === 'all' ? undefined : state, limit: 20, cursor });
      setRows((p) => [...p, ...r.items]);
      setCursor(r.next_cursor);
    } catch {
      show('Couldn’t load more.', 'error');
    } finally {
      setMore(false);
    }
  };

  const open = (r: CustomTestRow) => router.push({ pathname: '/(student)/(practice)/test-pre-start', params: { id: r.test.id } });

  const newSet = async (r: CustomTestRow) => {
    setMenu(null);
    setBusy(true);
    try {
      const res = await regenerateCustomTest(r.test.id, newIdempotencyKey());
      router.push({ pathname: '/(student)/(practice)/test-pre-start', params: { id: res.test.id } });
    } catch (e) {
      show(e instanceof ApiError && e.code === 'quota_exceeded' ? 'You’ve reached today’s limit for custom tests.' : e instanceof ApiError && e.code === 'pool_too_small' ? 'Not enough questions to build a new set.' : 'Couldn’t build a new set. Try again.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const doRename = async () => {
    if (!renaming) return;
    setBusy(true);
    try {
      const t = await renameCustomTest(renaming.test.id, title.trim());
      setRows((p) => p.map((x) => (x.test.id === renaming.test.id ? { ...x, test: { ...x.test, title: t.title ?? title.trim() } } : x)));
      setRenaming(null);
    } catch {
      show('Couldn’t rename. Try again.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const doDelete = async () => {
    if (!confirmDelete) return;
    setBusy(true);
    try {
      await deleteCustomTest(confirmDelete.test.id);
      setRows((p) => p.filter((x) => x.test.id !== confirmDelete.test.id));
      setConfirmDelete(null);
      show('Deleted. Your scores and progress are kept.', 'success');
    } catch {
      show('Couldn’t delete. Try again.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const chipStyle = (on: boolean) => ({
    minHeight: 40, paddingHorizontal: space.md, borderRadius: radius.pill, justifyContent: 'center' as const,
    backgroundColor: on ? color('accent/tint') : color('bg/surface'), borderWidth: 1, borderColor: on ? color('accent/default') : color('border/subtle'),
  });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color('bg/canvas') }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.md, paddingTop: space.md }}>
        <Pressable onPress={() => router.back()} hitSlop={space.xs} accessibilityRole="button" accessibilityLabel="Back" style={{ minWidth: 44, minHeight: 44, justifyContent: 'center' }}>
          <CaretLeft size={24} color={color('text/primary')} />
        </Pressable>
        <Text accessibilityRole="header" style={[type['type/h1'], { color: color('text/primary'), flex: 1 }]}>My custom tests</Text>
        <Pressable onPress={() => router.push('/(student)/(practice)/custom-builder')} accessibilityRole="button" accessibilityLabel="Create a new custom test" style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
          <Plus size={26} weight="bold" color={color('accent/default')} />
        </Pressable>
      </View>

      <View style={{ flexDirection: 'row', gap: space.xs, paddingHorizontal: space.md, marginTop: space.sm }}>
        {(['tests', 'templates'] as Tab[]).map((t) => (
          <Pressable key={t} onPress={() => setTab(t)} accessibilityRole="tab" accessibilityState={{ selected: tab === t }} style={chipStyle(tab === t)}>
            <Text style={[type['type/body-m-medium'], { color: tab === t ? color('accent/default') : color('text/primary') }]}>{t === 'tests' ? 'Tests' : 'Templates'}</Text>
          </Pressable>
        ))}
      </View>

      {tab === 'tests' ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginTop: space.sm }} contentContainerStyle={{ paddingHorizontal: space.md, gap: space.xs }}>
          {STATES.map((s) => (
            <Pressable key={s.key} onPress={() => setState(s.key)} accessibilityRole="button" accessibilityState={{ selected: state === s.key }} style={chipStyle(state === s.key)}>
              <Text style={[type['type/caption'], { color: state === s.key ? color('accent/default') : color('text/secondary') }]}>{s.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

      <ScrollView contentContainerStyle={{ padding: space.md, gap: space.sm, paddingBottom: space['3xl'] + insets.bottom }} showsVerticalScrollIndicator={false}>
        {loading ? (
          [0, 1, 2, 3].map((i) => <SkeletonBlock key={i} height={84} radius={radius.md} />)
        ) : error ? (
          <EmptyState
            icon={<WarningCircle size={32} color={color('semantic/danger')} weight="fill" />}
            title="Couldn’t load your custom tests"
            description="Check your connection and try again."
            action={<TextButton label="Retry" onPress={load} />}
          />
        ) : tab === 'tests' ? (
          rows.length === 0 ? (
            <EmptyState
              icon={<Sliders size={32} color={color('text/tertiary')} />}
              title={state === 'all' ? 'No custom tests yet' : 'Nothing here'}
              description={state === 'all' ? 'Build a test from exactly the topics and difficulty you want.' : 'No tests match this filter.'}
              action={state === 'all' ? <TextButton label="Build a test" onPress={() => router.push('/(student)/(practice)/custom-builder')} /> : undefined}
            />
          ) : (
            <>
              {rows.map((r) => {
                const la = r.last_attempt;
                const badge = r.state === 'in_progress' ? 'In progress' : r.state === 'completed' && la?.total_marks ? `${la.score ?? 0}/${la.total_marks}` : r.state === 'completed' ? 'Done' : 'New';
                return (
                  <Pressable
                    key={r.test.id}
                    onPress={() => open(r)}
                    accessibilityRole="button"
                    accessibilityLabel={`${r.test.title}. ${r.summary}. ${badge}`}
                    style={({ pressed }) => ({ backgroundColor: color('bg/surface'), borderRadius: radius.md, padding: space.md, flexDirection: 'row', alignItems: 'center', gap: space.sm, opacity: pressed ? 0.94 : 1 })}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[type['type/body-m-medium'], { color: color('text/primary') }]} numberOfLines={1}>{r.test.title}</Text>
                      <Text style={[type['type/caption'], { color: color('text/secondary'), marginTop: 2 }]} numberOfLines={1}>{r.summary}</Text>
                      <Text style={[type['type/caption'], { color: color('text/tertiary'), marginTop: 2 }]}>
                        Created {when(r.test.created_at)}{r.attempts_count > 0 ? ` · ${r.attempts_count} attempt${r.attempts_count > 1 ? 's' : ''}` : ''}
                      </Text>
                    </View>
                    <View style={{ backgroundColor: r.state === 'in_progress' ? color('semantic/warning-tint') : color('accent/tint'), borderRadius: radius.pill, paddingHorizontal: space.sm, paddingVertical: 4 }}>
                      <Text style={[type['type/caption'], { color: r.state === 'in_progress' ? color('semantic/warning') : color('accent/default') }]}>{badge}</Text>
                    </View>
                    <Pressable onPress={() => setMenu(r)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Actions for ${r.test.title}`} style={{ minWidth: 36, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
                      <DotsThreeVertical size={22} color={color('text/secondary')} weight="bold" />
                    </Pressable>
                  </Pressable>
                );
              })}
              {cursor ? <SecondaryButton label={more ? 'Loading…' : 'Load more'} onPress={loadMore} loading={more} /> : null}
            </>
          )
        ) : templates.length === 0 ? (
          <EmptyState
            icon={<Sliders size={32} color={color('text/tertiary')} />}
            title="No templates yet"
            description="Set up a custom test and choose “Save as template” to reuse it later."
            action={<TextButton label="Build a test" onPress={() => router.push('/(student)/(practice)/custom-builder')} />}
          />
        ) : (
          templates.map((t) => (
            <View key={t.id} style={{ backgroundColor: color('bg/surface'), borderRadius: radius.md, padding: space.md, flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
              <View style={{ flex: 1 }}>
                <Text style={[type['type/body-m-medium'], { color: color('text/primary') }]} numberOfLines={1}>{t.title}</Text>
                <Text style={[type['type/caption'], { color: color('text/secondary') }]}>{summarizeBlueprint(t.blueprint)}</Text>
              </View>
              <TextButton label="Delete" onPress={async () => {
                try { await deleteTemplate(t.id); setTemplates((p) => p.filter((x) => x.id !== t.id)); } catch { show('Couldn’t delete the template.', 'error'); }
              }} />
            </View>
          ))
        )}
        {busy ? <ErrorBanner message="Working…" /> : null}
      </ScrollView>

      {/* Row menu */}
      <BottomSheet visible={!!menu} onClose={() => setMenu(null)} title={menu?.test.title}>
        {menu ? (
          <View style={{ gap: space.sm }}>
            <PrimaryButton label={menu.state === 'in_progress' ? 'Resume' : menu.attempts_count > 0 ? 'Retake these questions' : 'Start'} onPress={() => { const m = menu; setMenu(null); open(m); }} />
            <SecondaryButton label="New set (same settings, fresh questions)" onPress={() => newSet(menu)} />
            {menu.last_attempt?.status === 'submitted' ? (
              <SecondaryButton label="View last result" onPress={() => { const id = menu.last_attempt!.id; setMenu(null); router.push({ pathname: '/(student)/(practice)/test-result', params: { id, fromHistory: '1' } }); }} />
            ) : null}
            <SecondaryButton label="Rename" onPress={() => { setTitle(menu.test.title); setRenaming(menu); setMenu(null); }} />
            <TextButton label="Delete" onPress={() => { setConfirmDelete(menu); setMenu(null); }} />
          </View>
        ) : null}
      </BottomSheet>

      <BottomSheet visible={!!renaming} onClose={() => setRenaming(null)} title="Rename test" dismissable={!busy}>
        <View style={{ gap: space.md }}>
          <InputField label="Name" value={title} onChangeText={setTitle} />
          <PrimaryButton label="Save" onPress={doRename} loading={busy} disabled={!title.trim()} />
        </View>
      </BottomSheet>

      <BottomSheet visible={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Delete this test?" dismissable={!busy}>
        <Text style={[type['type/body-m'], { color: color('text/secondary') }]}>
          It will disappear from your list. Your scores and progress analytics from past attempts are kept.
        </Text>
        <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.lg }}>
          <SecondaryButton label="Cancel" onPress={() => setConfirmDelete(null)} />
          <PrimaryButton label="Delete" onPress={doDelete} loading={busy} />
        </View>
      </BottomSheet>
    </SafeAreaView>
  );
}
