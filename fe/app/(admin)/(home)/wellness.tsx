import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { CaretLeft, HandHeart, Plus, WarningCircle } from 'phosphor-react-native';
import { BottomSheet, EmptyState, InputField, PrimaryButton, SecondaryButton, SelectField, SkeletonBlock, TextButton, useToast } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { RichField, plainText, type MediaMap, type MediaView } from '@/src/rich';
import { ApiError } from '@/src/api/client';
import {
  adminCreateWellness, adminDeleteWellness, adminUpdateWellness, listWellness, type WellnessCategory, type WellnessContent,
} from '@/src/api/wellness';
import { WELLNESS_CATEGORIES, readMinutes } from '@/src/wellness/shelves';

const MAX_BODY = 8000;
type Draft = { id?: string; title: string; category?: WellnessCategory; body: string };

/**
 * Admin: wellness articles for the student Support tab (FE-6.5). Write with
 * the rich editor (formatting + images), edit, hide (deactivate) or delete.
 * Only active items are listed — the API has no admin listing of hidden ones.
 */
export default function AdminWellnessRoute() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { show } = useToast();

  const [items, setItems] = useState<WellnessContent[] | null>(null);
  const [media, setMedia] = useState<MediaMap>({});
  const [error, setError] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [confirm, setConfirm] = useState<{ kind: 'hide' | 'delete'; item: WellnessContent } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setError(false);
    listWellness()
      .then((r) => {
        setItems(r.content);
        setMedia(r.media);
      })
      .catch(() => setError(true));
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const titleOk = !!draft && draft.title.trim().length >= 3 && draft.title.trim().length <= 120;
  const bodyOk = !!draft && (plainText(draft.body, 'rich_v1').trim().length >= 20 || /!\[/.test(draft.body)) && draft.body.length <= MAX_BODY;
  const canSave = titleOk && bodyOk && !!draft?.category;

  const save = async () => {
    if (!draft || !canSave) return;
    setBusy(true);
    const body = { title: draft.title.trim(), category: draft.category!, body_text: draft.body.trim(), content_format: 'rich_v1' as const };
    try {
      if (draft.id) {
        const saved = await adminUpdateWellness(draft.id, body);
        setItems((p) => p?.map((x) => (x.id === draft.id ? { ...x, ...saved, ...body } : x)) ?? p);
        show('Saved — students see the update now', 'success');
      } else {
        const saved = await adminCreateWellness(body);
        setItems((p) => [saved, ...(p ?? [])]);
        show('Published to Support', 'success');
      }
      setDraft(null);
    } catch (e) {
      show(e instanceof ApiError && e.message ? `Couldn’t save: ${e.message}` : 'Couldn’t save. Your text is still here — try again.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const runConfirm = async () => {
    if (!confirm) return;
    setBusy(true);
    try {
      if (confirm.kind === 'hide') await adminUpdateWellness(confirm.item.id, { is_active: false });
      else await adminDeleteWellness(confirm.item.id);
      setItems((p) => p?.filter((x) => x.id !== confirm.item.id) ?? p);
      show(confirm.kind === 'hide' ? 'Hidden from students' : 'Deleted', 'success');
      setConfirm(null);
    } catch {
      show('Something went wrong. Try again.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const label = (k: WellnessCategory) => WELLNESS_CATEGORIES.find((c) => c.key === k)?.label ?? k;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color('bg/canvas') }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.md, paddingTop: space.md }}>
        <Pressable onPress={() => router.back()} hitSlop={space.xs} accessibilityRole="button" accessibilityLabel="Back" style={{ minWidth: 44, minHeight: 44, justifyContent: 'center' }}>
          <CaretLeft size={24} color={color('text/primary')} />
        </Pressable>
        <Text accessibilityRole="header" style={[type['type/h1'], { color: color('text/primary'), flex: 1 }]}>Wellness</Text>
        <Pressable onPress={() => setDraft({ title: '', body: '' })} accessibilityRole="button" accessibilityLabel="New article" style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
          <Plus size={26} weight="bold" color={color('accent/default')} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: space.md, gap: space.sm, paddingBottom: space['3xl'] + insets.bottom }}>
        {error ? (
          <EmptyState icon={<WarningCircle size={32} color={color('semantic/danger')} weight="fill" />} title="Couldn’t load articles" description="Check your connection and try again." action={<TextButton label="Retry" onPress={load} />} />
        ) : items == null ? (
          [0, 1, 2].map((i) => <SkeletonBlock key={i} height={72} radius={radius.md} />)
        ) : items.length === 0 ? (
          <EmptyState
            icon={<HandHeart size={32} color={color('text/tertiary')} />}
            title="No articles yet"
            description="Until you add some, students see the built-in starter articles on the Support tab."
            action={<TextButton label="Write the first one" onPress={() => setDraft({ title: '', body: '' })} />}
          />
        ) : (
          items.map((w) => (
            <View key={w.id} style={{ backgroundColor: color('bg/surface'), borderRadius: radius.md, padding: space.md }}>
              <Text style={[type['type/body-m-medium'], { color: color('text/primary') }]}>{w.title}</Text>
              <Text style={[type['type/caption'], { color: color('text/secondary') }]}>
                {label(w.category)} · {readMinutes(w.body_text, w.content_format)} min read{w.content_format !== 'rich_v1' ? ' · plain text' : ''}
              </Text>
              <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.xs }}>
                <TextButton label="Edit" onPress={() => setDraft({ id: w.id, title: w.title, category: w.category, body: w.body_text })} />
                <TextButton label="Hide" onPress={() => setConfirm({ kind: 'hide', item: w })} />
                <TextButton label="Delete" onPress={() => setConfirm({ kind: 'delete', item: w })} />
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <BottomSheet visible={!!draft} onClose={() => setDraft(null)} title={draft?.id ? 'Edit article' : 'New article'} dismissable={!busy} maxHeightPct={0.94}>
        {draft ? (
          <View style={{ gap: space.md }}>
            <InputField label="Title" value={draft.title} onChangeText={(v) => setDraft((d) => (d ? { ...d, title: v } : d))} maxLength={120} />
            <SelectField
              label="Shelf"
              value={draft.category}
              options={WELLNESS_CATEGORIES.map((c) => ({ value: c.key, label: c.label }))}
              onChange={(v) => setDraft((d) => (d ? { ...d, category: v as WellnessCategory } : d))}
            />
            <RichField
              label="Article"
              required
              value={draft.body}
              onChange={(v) => setDraft((d) => (d ? { ...d, body: v } : d))}
              media={media}
              onMedia={(v: MediaView) => setMedia((m) => ({ ...m, [v.id]: v }))}
              purpose="wellness_image"
              maxChars={MAX_BODY}
              minLines={10}
              maxImages={4}
              placeholder="Warm, plain language. For a reflection prompt, one or two sentences of framing is enough."
            />
            <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>
              About {readMinutes(draft.body, 'rich_v1')} min read · goes live as soon as you save.
            </Text>
            <PrimaryButton label={draft.id ? 'Save' : 'Publish'} onPress={save} loading={busy} disabled={!canSave} />
          </View>
        ) : null}
      </BottomSheet>

      <BottomSheet visible={!!confirm} onClose={() => setConfirm(null)} title={confirm?.kind === 'hide' ? 'Hide this article?' : 'Delete this article?'} dismissable={!busy}>
        <Text style={[type['type/body-m'], { color: color('text/secondary') }]}>
          {confirm?.kind === 'hide'
            ? 'Students stop seeing it right away. Hidden articles don’t appear in this list, so you can’t bring it back from the app.'
            : 'It is removed permanently.'}
        </Text>
        <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.lg }}>
          <SecondaryButton label="Cancel" onPress={() => setConfirm(null)} style={{ flex: 1 }} />
          <PrimaryButton label={confirm?.kind === 'hide' ? 'Hide' : 'Delete'} onPress={runConfirm} loading={busy} style={{ flex: 1 }} />
        </View>
      </BottomSheet>
    </SafeAreaView>
  );
}
