import { useState } from 'react';
import { Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { UsersThree } from 'phosphor-react-native';
import { BottomSheet, ConfirmDialog, EmptyState, ErrorBanner, InputField, PrimaryButton, Screen, ScreenHeader, SecondaryButton, SkeletonBlock, TextButton, useToast } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { adminAddFaculty, adminDeleteFaculty, adminListFaculty, adminUpdateFaculty, type Faculty } from '@/src/api/reference';
import { useMediaUpload } from '@/src/media/useMediaUpload';
import { MediaImage } from '@/src/rich/MediaImage';
import { ApiError } from '@/src/api/client';

type Draft = { id?: string; name: string; title: string; summary: string; about: string; mediaId?: string };
const EMPTY: Draft = { name: '', title: '', summary: '', about: '' };

/** The people shown under "Our team and faculty". Only what you enter here is shown to students. */
export default function FacultyRoute() {
  const { color, type, space, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const { show } = useToast();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['admin', 'faculty'], queryFn: adminListFaculty });
  const [draft, setDraft] = useState<Draft | null>(null);
  const [deleting, setDeleting] = useState<Faculty | null>(null);
  const [busy, setBusy] = useState(false);
  const photo = useMediaUpload('faculty_photo', { onReady: (it) => setDraft((d) => (d ? { ...d, mediaId: it.mediaId } : d)) });
  const refresh = () => qc.invalidateQueries({ queryKey: ['admin', 'faculty'] });
  const uploading = photo.items.some((i) => i.stage !== 'ready' && i.stage !== 'failed');
  const savedView = draft?.mediaId ? q.data?.media?.[draft.mediaId] : undefined;
  const preview = photo.items.find((i) => i.stage === 'ready')?.view ?? savedView;
  const valid = !!draft && draft.name.trim().length >= 2;

  const open = (d: Draft) => { photo.clear(); setDraft(d); };

  const save = async () => {
    if (!draft || !valid || uploading) return;
    setBusy(true);
    try {
      const body = { name: draft.name.trim(), title: draft.title.trim(), summary: draft.summary.trim(), about: draft.about.trim(), media_id: draft.mediaId ?? '' };
      if (draft.id) await adminUpdateFaculty(draft.id, body);
      else await adminAddFaculty({ ...body, order_index: (q.data?.faculty.length ?? 0) + 1 });
      await refresh();
      setDraft(null);
      show(draft.id ? 'Saved' : 'Added', 'success');
    } catch (e) {
      show(e instanceof ApiError ? e.message : 'Couldn’t save.', 'error');
    } finally {
      setBusy(false);
    }
  };
  const toggle = async (f: Faculty, on: boolean) => {
    try { await adminUpdateFaculty(f.id, { is_active: on }); await refresh(); } catch { show('Couldn’t change that.', 'error'); }
  };
  const remove = async () => {
    if (!deleting) return;
    try { await adminDeleteFaculty(deleting.id); await refresh(); show('Removed', 'success'); } catch { show('Couldn’t remove.', 'error'); } finally { setDeleting(null); }
  };

  return (
    <Screen>
      <ScreenHeader title="Faculty" right={<TextButton label="Add" onPress={() => open({ ...EMPTY })} />} />
      <ScrollView contentContainerStyle={{ padding: space.md, gap: space.sm, paddingBottom: space['3xl'] + insets.bottom }}>
        {q.isPending ? (
          <SkeletonBlock height={120} radius={radius.lg} />
        ) : q.isError ? (
          <ErrorBanner onRetry={() => void q.refetch()} />
        ) : q.data.faculty.length === 0 ? (
          <EmptyState icon={<UsersThree size={32} color={color('text/tertiary')} />} title="No one added yet" description="Students see an empty “Meet the team soon” page until you add people." action={<PrimaryButton label="Add a person" onPress={() => open({ ...EMPTY })} />} />
        ) : (
          q.data.faculty.map((f) => (
            <Pressable key={f.id} onPress={() => open({ id: f.id, name: f.name, title: f.title ?? '', summary: f.summary ?? '', about: f.about ?? '', mediaId: f.media_id })} accessibilityRole="button" style={({ pressed }) => [{ backgroundColor: color('bg/surface'), borderRadius: radius.md, padding: space.sm, flexDirection: 'row', alignItems: 'center', gap: space.sm, opacity: pressed ? 0.94 : 1 }]}>
              <View style={{ width: 48, height: 48, borderRadius: 24, overflow: 'hidden', backgroundColor: color('accent/tint'), alignItems: 'center', justifyContent: 'center' }}>
                {f.media_id && q.data?.media?.[f.media_id] ? <MediaImage media={q.data.media[f.media_id]} variant="thumb" maxHeight={48} /> : <Text style={[type['type/h3'], { color: color('accent/default') }]}>{f.name.charAt(0).toUpperCase()}</Text>}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[type['type/body-m-medium'], { color: color('text/primary') }]} numberOfLines={1}>{f.name}</Text>
                {f.title ? <Text style={[type['type/caption'], { color: color('text/tertiary') }]} numberOfLines={1}>{f.title}</Text> : null}
              </View>
              <Switch value={f.is_active} onValueChange={(v) => void toggle(f, v)} accessibilityLabel={`${f.name} is shown to students`} />
            </Pressable>
          ))
        )}
      </ScrollView>

      <BottomSheet visible={!!draft} onClose={() => !busy && setDraft(null)} title={draft?.id ? 'Edit person' : 'Add a person'} maxHeightPct={0.92} dismissable={!busy}>
        {draft ? (
          <ScrollView contentContainerStyle={{ gap: space.md, paddingBottom: space.lg }} keyboardShouldPersistTaps="handled">
            <InputField label="Name" value={draft.name} onChangeText={(t) => setDraft({ ...draft, name: t })} maxLength={100} />
            <InputField label="Title or subject" value={draft.title} onChangeText={(t) => setDraft({ ...draft, title: t })} maxLength={120} placeholder="Biology faculty" />
            <InputField label="Short line on the card" value={draft.summary} onChangeText={(t) => setDraft({ ...draft, summary: t })} multiline maxLength={300} />
            <InputField label="Full introduction" value={draft.about} onChangeText={(t) => setDraft({ ...draft, about: t })} multiline maxLength={3000} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
              <View style={{ width: 72, height: 72, borderRadius: 36, overflow: 'hidden', backgroundColor: color('bg/sunken'), alignItems: 'center', justifyContent: 'center' }}>
                {preview ? <MediaImage media={preview} variant="thumb" maxHeight={72} /> : <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>No photo</Text>}
              </View>
              <View style={{ flex: 1, gap: space.xs }}>
                <SecondaryButton label={preview ? 'Change photo' : 'Choose photo'} onPress={() => void photo.pickFromLibrary(false)} disabled={uploading} />
                {draft.mediaId ? <TextButton label="Remove photo" onPress={() => { photo.clear(); setDraft({ ...draft, mediaId: undefined }); }} /> : null}
              </View>
            </View>
            <PrimaryButton label="Save" onPress={() => void save()} loading={busy} disabled={!valid || uploading} />
            {draft.id ? <TextButton label="Remove this person" onPress={() => { const f = q.data?.faculty.find((x) => x.id === draft.id); if (f) { setDraft(null); setDeleting(f); } }} /> : null}
          </ScrollView>
        ) : null}
      </BottomSheet>
      <ConfirmDialog visible={!!deleting} tone="danger" title="Remove this person?" message={`${deleting?.name ?? ''} disappears from Our team and faculty.`} confirmLabel="Remove" onConfirm={() => void remove()} onCancel={() => setDeleting(null)} />
    </Screen>
  );
}
