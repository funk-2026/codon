import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { CaretLeft, WarningCircle } from 'phosphor-react-native';
import { BottomSheet, EmptyState, ErrorBanner, InputField, PrimaryButton, SecondaryButton, SkeletonBlock, TextButton, useToast } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { useAppConfig } from '@/src/config/AppConfigContext';
import {
  deletePreset, getCustomTestMetrics, getCustomTestSettings, getPoolHealth, listAdminCollections, listPresets, patchCollection, patchCustomTestSettings, updatePreset,
  type AdminPreset, type AdminSetting, type CollectionAdmin, type Metrics, type PoolChapter,
} from '@/src/api/adminCustom';
import { ApiError } from '@/src/api/client';

type Load<T> = { s: 'loading' | 'ready' | 'error'; d?: T };
const L = <T,>(): Load<T> => ({ s: 'loading' });

const isBool = (v: string) => v === 'true' || v === 'false';
const GROUPS: { title: string; match: (k: string) => boolean }[] = [
  { title: 'Feature flags', match: (k) => k.endsWith('.enabled') || k.endsWith('_mode') || k.endsWith('status_filters') || k === 'rich_content.math' || k === 'kyc_required' },
  { title: 'Custom test limits', match: (k) => k.startsWith('custom_test.') },
  { title: 'Media & uploads', match: (k) => k.startsWith('media.') },
  { title: 'Analytics & pool', match: (k) => k.startsWith('analytics.') || k.startsWith('pool.') },
];

const NICE: Record<string, string> = {
  'custom_test.enabled': 'Custom tests', 'custom_test.tutor_mode': 'Tutor mode', 'custom_test.status_filters': 'Question-status filters',
  'bookmarks.enabled': 'Bookmarks', 'reports.enabled': 'Question reports', 'ratings.enabled': 'Ratings', 'rich_content.math': 'Math rendering',
};

export default function CustomTestAdminRoute() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { show } = useToast();
  const app = useAppConfig();

  const [settings, setSettings] = useState<Load<AdminSetting[]>>(L());
  const [metrics, setMetrics] = useState<Load<Metrics>>(L());
  const [pool, setPool] = useState<Load<{ chapters: PoolChapter[]; floor: number; low: number }>>(L());
  const [presets, setPresets] = useState<Load<AdminPreset[]>>(L());
  const [collections, setCollections] = useState<Load<CollectionAdmin[]>>(L());
  const [edit, setEdit] = useState<AdminSetting | null>(null);
  const [val, setVal] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState<{ key: string; to: boolean } | null>(null);

  const run = <T,>(p: Promise<T>, set: (l: Load<T>) => void) => {
    set(L());
    p.then((d) => set({ s: 'ready', d })).catch(() => set({ s: 'error' }));
  };
  const load = useCallback(() => {
    run(getCustomTestSettings().then((r) => r.settings), setSettings);
    run(getCustomTestMetrics(), setMetrics);
    run(getPoolHealth().then((r) => ({ chapters: r.chapters, floor: r.totals.floor, low: r.totals.low_inventory_chapters })), setPool);
    run(listPresets().then((r) => r.presets), setPresets);
    run(listAdminCollections().then((r) => r.collections), setCollections);
  }, []);
  useEffect(load, [load]);

  const save = async (key: string, value: string) => {
    setSaving(true);
    try {
      await patchCustomTestSettings({ [key]: value });
      setSettings((cur) => (cur.d ? { s: 'ready', d: cur.d.map((x) => (x.key === key ? { ...x, value } : x)) } : cur));
      setEdit(null);
      setConfirm(null);
      show('Saved — takes effect within a minute for everyone.', 'success');
      void app.reload();
    } catch (e) {
      show(e instanceof ApiError && e.status === 400 ? `That value isn’t valid for this setting.` : 'Couldn’t save. Try again.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const grouped = useMemo(() => {
    const all = settings.d ?? [];
    const used = new Set<string>();
    const g = GROUPS.map((gr) => {
      const items = all.filter((s) => !used.has(s.key) && gr.match(s.key));
      items.forEach((s) => used.add(s.key));
      return { title: gr.title, items };
    });
    const rest = all.filter((s) => !used.has(s.key));
    if (rest.length) g.push({ title: 'Other', items: rest });
    return g.filter((x) => x.items.length);
  }, [settings.d]);

  const Card = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <View style={{ marginTop: space.xl }}>
      <Text style={[type['type/overline'], { color: color('text/tertiary'), marginBottom: space.sm }]}>{title.toUpperCase()}</Text>
      <View style={{ backgroundColor: color('bg/surface'), borderRadius: radius.lg, padding: space.md, gap: space.sm }}>{children}</View>
    </View>
  );
  const Failed = ({ what }: { what: string }) => <ErrorBanner message={`Couldn’t load ${what}.`} onRetry={load} />;
  const Stat = ({ label, value }: { label: string; value: string | number }) => (
    <View style={{ flex: 1, minWidth: '30%' }} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text style={[type['type/h2'], { color: color('text/primary') }]}>{value}</Text>
      <Text style={[type['type/caption'], { color: color('text/secondary') }]}>{label}</Text>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color('bg/canvas') }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.md, paddingTop: space.md }}>
        <Pressable onPress={() => router.back()} hitSlop={space.xs} accessibilityRole="button" accessibilityLabel="Back" style={{ minWidth: 44, minHeight: 44, justifyContent: 'center' }}>
          <CaretLeft size={24} color={color('text/primary')} />
        </Pressable>
        <Text accessibilityRole="header" style={[type['type/h1'], { color: color('text/primary') }]}>Custom test admin</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: space.md, paddingBottom: space['3xl'] + insets.bottom }} showsVerticalScrollIndicator={false}>
        <Card title="Health (last 24 h)">
          {metrics.s === 'loading' ? <SkeletonBlock height={60} radius={radius.md} /> : metrics.s === 'error' || !metrics.d ? <Failed what="metrics" /> : (
            <>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.md }}>
                <Stat label="Tests generated" value={metrics.d.last_24h.generated_tests} />
                <Stat label="Auto-submitted" value={metrics.d.last_24h.auto_submitted_attempts} />
                <Stat label="Rejected uploads" value={metrics.d.last_24h.rejected_uploads} />
                <Stat label="Open reports" value={metrics.d.now.open_reports} />
                <Stat label="Held for review" value={metrics.d.now.questions_under_review} />
                <Stat label="Active tests" value={metrics.d.now.active_generated_tests} />
              </View>
              <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>
                Since the server started: {metrics.d.process.generated} generated · avg {metrics.d.process.avg_latency_ms} ms · max {metrics.d.process.max_latency_ms} ms · {metrics.d.process.with_relaxations} adjusted · {metrics.d.process.empty_pool_rejections} empty-pool. (Per server instance.)
              </Text>
            </>
          )}
        </Card>

        {settings.s === 'loading' ? <View style={{ marginTop: space.xl }}><SkeletonBlock height={200} radius={radius.lg} /></View>
          : settings.s === 'error' ? <View style={{ marginTop: space.xl }}><Failed what="settings" /></View>
          : grouped.map((g) => (
            <Card key={g.title} title={g.title}>
              {g.items.map((s) => {
                const bool = isBool(s.default) && isBool(s.value);
                const label = NICE[s.key] ?? s.key;
                return (
                  <View key={s.key} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 48 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={[type['type/body-m-medium'], { color: color('text/primary') }]}>{label}</Text>
                      {NICE[s.key] ? <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>{s.key}</Text> : null}
                      {!bool && s.value !== s.default ? <Text style={[type['type/caption'], { color: color('semantic/warning') }]}>default: {s.default}</Text> : null}
                    </View>
                    {bool ? (
                      <Switch value={s.value === 'true'} onValueChange={(v) => (s.key.endsWith('.enabled') ? setConfirm({ key: s.key, to: v }) : void save(s.key, String(v)))} accessibilityLabel={label} />
                    ) : (
                      <Pressable onPress={() => { setEdit(s); setVal(s.value); }} accessibilityRole="button" accessibilityLabel={`${label}: ${s.value}. Edit`} style={{ minHeight: 44, justifyContent: 'center', maxWidth: 160 }}>
                        <Text style={[type['type/body-m'], { color: color('accent/default') }]} numberOfLines={1}>{s.value}</Text>
                      </Pressable>
                    )}
                  </View>
                );
              })}
            </Card>
          ))}

        <Card title="Question pool">
          {pool.s === 'loading' ? <SkeletonBlock height={80} radius={radius.md} /> : pool.s === 'error' || !pool.d ? <Failed what="pool health" /> : (
            <>
              <Text style={[type['type/body-m'], { color: pool.d.low > 0 ? color('semantic/warning') : color('semantic/success') }]}>
                {pool.d.low > 0 ? `${pool.d.low} chapter${pool.d.low > 1 ? 's are' : ' is'} below the floor of ${pool.d.floor} questions` : 'Every chapter has enough questions'}
              </Text>
              {pool.d.chapters.slice(0, 40).map((c) => (
                <View key={c.chapter_id ?? c.chapter} style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={[type['type/body-m'], { color: color('text/primary'), flex: 1 }]} numberOfLines={1}>{c.subject} › {c.chapter}</Text>
                  <Text style={[type['type/body-m-medium'], { color: c.eligible < pool.d!.floor ? color('semantic/danger') : color('text/primary') }]}>{c.eligible}</Text>
                </View>
              ))}
            </>
          )}
        </Card>

        <Card title="Presets shown in the builder">
          {presets.s === 'loading' ? <SkeletonBlock height={60} radius={radius.md} /> : presets.s === 'error' || !presets.d ? <Failed what="presets" /> : presets.d.length === 0 ? (
            <Text style={[type['type/body-m'], { color: color('text/secondary') }]}>No presets yet. Add them through the API; they appear in the builder’s “Start from” row.</Text>
          ) : presets.d.map((p) => (
            <View key={p.id} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
              <View style={{ flex: 1 }}>
                <Text style={[type['type/body-m-medium'], { color: color('text/primary') }]}>{p.title}</Text>
                {p.description ? <Text style={[type['type/caption'], { color: color('text/secondary') }]} numberOfLines={1}>{p.description}</Text> : null}
              </View>
              <Switch value={p.is_active} onValueChange={async (v) => { try { await updatePreset(p.id, { is_active: v }); setPresets((c) => ({ s: 'ready', d: c.d!.map((x) => (x.id === p.id ? { ...x, is_active: v } : x)) })); } catch { show('Couldn’t update the preset.', 'error'); } }} accessibilityLabel={`${p.title} active`} />
              <TextButton label="Delete" onPress={async () => { try { await deletePreset(p.id); setPresets((c) => ({ s: 'ready', d: c.d!.filter((x) => x.id !== p.id) })); } catch { show('Couldn’t delete.', 'error'); } }} />
            </View>
          ))}
        </Card>

        <Card title="Bookmark lists">
          {collections.s === 'loading' ? <SkeletonBlock height={60} radius={radius.md} /> : collections.s === 'error' || !collections.d ? <Failed what="bookmark lists" /> : collections.d.map((c) => (
            <CollectionRow key={c.id} c={c} onSaved={(n) => setCollections((cur) => ({ s: 'ready', d: cur.d!.map((x) => (x.id === n.id ? n : x)) }))} />
          ))}
        </Card>
      </ScrollView>

      <BottomSheet visible={!!edit} onClose={() => setEdit(null)} title={edit?.key} dismissable={!saving}>
        <View style={{ gap: space.md }}>
          <InputField label="Value" value={val} onChangeText={setVal} autoCapitalize="none" autoCorrect={false} />
          <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>Default: {edit?.default}</Text>
          <PrimaryButton label="Save" onPress={() => edit && save(edit.key, val.trim())} loading={saving} disabled={!val.trim() || val.trim() === edit?.value} />
          {edit && edit.value !== edit.default ? <SecondaryButton label="Reset to default" onPress={() => save(edit.key, edit.default)} disabled={saving} /> : null}
        </View>
      </BottomSheet>

      <BottomSheet visible={!!confirm} onClose={() => setConfirm(null)} title={confirm?.to ? 'Turn this on for everyone?' : 'Turn this off for everyone?'} dismissable={!saving}>
        <Text style={[type['type/body-m'], { color: color('text/secondary') }]}>{NICE[confirm?.key ?? ''] ?? confirm?.key} will {confirm?.to ? 'appear for all users' : 'disappear for all users (existing data is kept)'}.</Text>
        <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.lg }}>
          <SecondaryButton label="Cancel" onPress={() => setConfirm(null)} />
          <PrimaryButton label="Confirm" onPress={() => confirm && save(confirm.key, String(confirm.to))} loading={saving} />
        </View>
      </BottomSheet>
    </SafeAreaView>
  );
}

function CollectionRow({ c, onSaved }: { c: CollectionAdmin; onSaved: (c: CollectionAdmin) => void }) {
  const { color, type, space } = useTheme();
  const { show } = useToast();
  const [label, setLabel] = useState(c.label);
  const [busy, setBusy] = useState(false);
  const dirty = label.trim() !== c.label && label.trim().length > 0;
  const save = async (patch: Parameters<typeof patchCollection>[1]) => {
    setBusy(true);
    try {
      const n = await patchCollection(c.id, patch);
      onSaved({ ...c, ...n });
    } catch (e) {
      show(e instanceof ApiError && e.status === 409 ? 'At least one list must stay active.' : 'Couldn’t update the list.', 'error');
      setLabel(c.label);
    } finally {
      setBusy(false);
    }
  };
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
      <View style={{ flex: 1 }}>
        <InputField label={c.key} value={label} onChangeText={setLabel} />
      </View>
      {dirty ? <TextButton label="Save" onPress={() => save({ label: label.trim() })} /> : null}
      <Switch value={c.is_active} disabled={busy} onValueChange={(v) => save({ is_active: v })} accessibilityLabel={`${c.key} active`} />
    </View>
  );
}
