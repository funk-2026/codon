import { useState } from 'react';
import { Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Megaphone, Plus, WarningCircle } from 'phosphor-react-native';
import { BottomSheet, Chip, ConfirmDialog, EmptyState, InputField, PrimaryButton, Screen, ScreenHeader, SkeletonBlock, TextButton, useToast } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { adminCreateHomeUpdate, adminDeleteHomeUpdate, adminListHomeUpdates, adminUpdateHomeUpdate, type AdminHomeUpdate } from '@/src/api/adminOps';
import { ROUTES } from '@/src/navigation/routes';
import { shadow } from '@/src/theme/elevation';

/** Where a banner's button can take a student. Only student screens are allowed. */
const DESTINATIONS: { label: string; route: string }[] = [
  { label: 'Practice', route: ROUTES.student.practice },
  { label: 'Learn', route: ROUTES.student.learn },
  { label: 'Support', route: ROUTES.student.support },
  { label: 'Plans', route: ROUTES.student.subscriptionPlans },
  { label: 'Brain Hacks', route: ROUTES.student.brainHacks },
];

type Draft = { id?: string; title: string; body: string; cta_label: string; cta_route: string };
const EMPTY: Draft = { title: '', body: '', cta_label: '', cta_route: '' };

/** The banners at the top of every student's Home. Empty means the carousel is hidden. */
export default function HomeUpdatesRoute() {
  const { color, type, space, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const { show } = useToast();
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ['admin', 'home-updates'], queryFn: adminListHomeUpdates, select: (r) => r.updates ?? [] });
  const [draft, setDraft] = useState<Draft | null>(null);
  const [deleting, setDeleting] = useState<AdminHomeUpdate | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['admin', 'home-updates'] });
  const valid = !!draft && draft.title.trim().length >= 3 && (!draft.cta_route || draft.cta_label.trim().length > 0);

  const save = async () => {
    if (!draft || !valid) return;
    setBusy(true);
    try {
      const body = { title: draft.title.trim(), body: draft.body.trim(), cta_label: draft.cta_route ? draft.cta_label.trim() : '', cta_route: draft.cta_route };
      if (draft.id) await adminUpdateHomeUpdate(draft.id, body);
      else await adminCreateHomeUpdate({ ...body, is_active: true, order_index: (query.data?.length ?? 0) + 1 });
      await refresh();
      setDraft(null);
      show(draft.id ? 'Banner updated' : 'Banner added', 'success');
    } catch {
      show('Couldn’t save the banner. Try again.', 'error');
    } finally {
      setBusy(false);
    }
  };
  const toggle = async (u: AdminHomeUpdate, on: boolean) => {
    try {
      await adminUpdateHomeUpdate(u.id, { is_active: on });
      await refresh();
    } catch {
      show('Couldn’t change that banner.', 'error');
    }
  };
  const remove = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await adminDeleteHomeUpdate(deleting.id);
      await refresh();
      setDeleting(null);
      show('Banner deleted', 'success');
    } catch {
      show('Couldn’t delete. Try again.', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <ScreenHeader
        title="Home banners"
        right={
          <Pressable onPress={() => setDraft(EMPTY)} accessibilityRole="button" accessibilityLabel="Add a banner" style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
            <Plus size={26} weight="bold" color={color('accent/default')} />
          </Pressable>
        }
      />
      <ScrollView contentContainerStyle={{ padding: space.md, gap: space.xs, paddingBottom: space['3xl'] + insets.bottom }} showsVerticalScrollIndicator={false}>
        {query.isPending ? (
          [0, 1].map((i) => <SkeletonBlock key={i} height={84} radius={radius.md} />)
        ) : query.isError ? (
          <EmptyState
            icon={<WarningCircle size={32} color={color('semantic/danger')} weight="fill" />}
            title="Couldn’t load the banners"
            description="Check your connection and try again."
            action={<TextButton label="Retry" onPress={() => void query.refetch()} />}
          />
        ) : (query.data ?? []).length === 0 ? (
          <EmptyState icon={<Megaphone size={32} color={color('text/tertiary')} />} title="No banners" description="Students see nothing at the top of Home. Add one to announce something." action={<TextButton label="Add a banner" onPress={() => setDraft(EMPTY)} />} />
        ) : (
          (query.data ?? []).map((u) => (
            <View key={u.id} style={[{ backgroundColor: color('bg/surface'), borderRadius: radius.md, padding: space.sm, gap: space['2xs'], opacity: u.is_active ? 1 : 0.65 }, shadow()]}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={[type['type/h3'], { color: color('text/primary'), flex: 1 }]} numberOfLines={2}>{u.title}</Text>
                <Switch value={u.is_active} onValueChange={(v) => void toggle(u, v)} accessibilityLabel={`Show ${u.title} to students`} trackColor={{ false: color('border/strong'), true: color('accent/default') }} thumbColor={color('bg/surface')} />
              </View>
              {u.body ? <Text style={[type['type/body-m'], { color: color('text/secondary') }]} numberOfLines={3}>{u.body}</Text> : null}
              {u.cta_route ? <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>Button: {u.cta_label} → {DESTINATIONS.find((d) => d.route === u.cta_route)?.label ?? u.cta_route}</Text> : null}
              <View style={{ flexDirection: 'row', gap: space.xs }}>
                <TextButton label="Edit" onPress={() => setDraft({ id: u.id, title: u.title, body: u.body ?? '', cta_label: u.cta_label ?? '', cta_route: u.cta_route ?? '' })} />
                <TextButton label="Delete" onPress={() => setDeleting(u)} />
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <BottomSheet visible={!!draft} onClose={() => setDraft(null)} title={draft?.id ? 'Edit banner' : 'New banner'} dismissable={!busy}>
        <View style={{ gap: space.md, paddingHorizontal: space.lg, paddingTop: space.sm }}>
          <InputField label="Title" value={draft?.title ?? ''} onChangeText={(v) => setDraft((d) => (d ? { ...d, title: v } : d))} maxLength={100} />
          <InputField label="Message (optional)" value={draft?.body ?? ''} onChangeText={(v) => setDraft((d) => (d ? { ...d, body: v } : d))} multiline maxLength={400} />
          <View style={{ gap: space.xs }}>
            <Text style={[type['type/caption'], { color: color('text/secondary') }]}>Button takes them to (optional)</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs }}>
              <Chip size="sm" label="None" selected={!draft?.cta_route} onPress={() => setDraft((d) => (d ? { ...d, cta_route: '' } : d))} />
              {DESTINATIONS.map((d) => (
                <Chip key={d.route} size="sm" label={d.label} selected={draft?.cta_route === d.route} onPress={() => setDraft((x) => (x ? { ...x, cta_route: d.route } : x))} />
              ))}
            </View>
          </View>
          {draft?.cta_route ? <InputField label="Button label" value={draft.cta_label} onChangeText={(v) => setDraft((d) => (d ? { ...d, cta_label: v } : d))} maxLength={30} /> : null}
          <PrimaryButton label={draft?.id ? 'Save' : 'Add banner'} onPress={save} loading={busy} disabled={!valid} />
        </View>
      </BottomSheet>

      <ConfirmDialog
        visible={!!deleting}
        title="Delete this banner?"
        message={deleting ? `“${deleting.title}” disappears from every student’s Home.` : undefined}
        confirmLabel="Delete"
        tone="danger"
        loading={busy}
        onConfirm={remove}
        onCancel={() => setDeleting(null)}
      />
    </Screen>
  );
}
