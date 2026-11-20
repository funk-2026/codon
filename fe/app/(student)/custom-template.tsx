import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BottomSheet, ErrorBanner, InputField, PrimaryButton, Screen, ScreenHeader, SecondaryButton, SkeletonBlock, TextButton, useToast } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { useAuth } from '@/src/auth/AuthContext';
import { ApiError } from '@/src/api/client';
import { getBuilderConfig, listMyTemplates, removeTemplate, saveTemplate } from '@/src/api/customTests';
import { listBookmarkCollections } from '@/src/api/bookmarks';
import { BuilderGroups } from '@/src/custom/BuilderGroups';
import { DEFAULT_STATE, MAX_TEMPLATES, mixValid, toBlueprint, type CustomState, type FilterKey } from '@/src/custom/logic';

const ORDER: FilterKey[] = ['count', 'difficulty', 'from', 'skip', 'order', 'subjects', 'tags', 'mode', 'marking', 'timing'];

/** Create a template: set the filters you want, leave others for test time, and save it. It cannot start a test. */
export default function CustomTemplateRoute() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const { show } = useToast();
  const qc = useQueryClient();
  const { user } = useAuth();
  const courseId = user?.selected_course_id ?? '';
  const cfg = useQuery({ queryKey: ['custom-config', courseId], queryFn: () => getBuilderConfig(courseId), enabled: !!courseId });
  const templates = useQuery({ queryKey: ['custom-templates'], queryFn: listMyTemplates });
  const collections = useQuery({ queryKey: ['bookmark-collections'], queryFn: listBookmarkCollections, select: (r) => r.collections });
  const [s, setS] = useState<CustomState>(DEFAULT_STATE);
  const [asked, setAsked] = useState<FilterKey[]>([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const full = (templates.data?.length ?? 0) >= MAX_TEMPLATES;

  const save = useMutation({
    mutationFn: () => saveTemplate({ title: name.trim(), blueprint: toBlueprint({ ...s, name: '' }, courseId), ask: { keys: asked, state: { ...s, name: '' } } }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['custom-templates'] }); setOpen(false); setName(''); show('Template saved', 'success'); router.back(); },
    onError: (e) => show(e instanceof ApiError && e.code === 'too_many_templates' ? 'You already have 3 saved templates. Delete one first.' : 'Couldn’t save the template. Try again.', 'error'),
  });
  const del = useMutation({ mutationFn: (id: string) => removeTemplate(id), onSuccess: () => void qc.invalidateQueries({ queryKey: ['custom-templates'] }) });

  return (
    <Screen>
      <ScreenHeader title="Create a template" />
      <ScrollView contentContainerStyle={{ padding: space.md, gap: space.md, paddingBottom: space['3xl'] }} keyboardShouldPersistTaps="handled">
        <View style={{ backgroundColor: color('accent/tint'), borderRadius: radius.md, padding: space.md }}>
          <Text style={[type['type/body-m'], { color: color('accent/default') }]}>Create a template here to build a test faster, with the question pattern you have saved.</Text>
        </View>
        {(templates.data ?? []).length ? (
          <View style={{ gap: space.xs }}>
            <Text style={[type['type/overline'], { color: color('text/tertiary') }]}>YOUR TEMPLATES ({templates.data?.length}/{MAX_TEMPLATES})</Text>
            {(templates.data ?? []).map((t) => (
              <View key={t.id} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: color('bg/surface'), borderRadius: radius.md, paddingLeft: space.md }}>
                <Text style={[type['type/body-m-medium'], { color: color('text/primary'), flex: 1 }]}>{t.title}</Text>
                <TextButton label="Delete" onPress={() => del.mutate(t.id)} />
              </View>
            ))}
          </View>
        ) : null}
        {full ? <Text style={[type['type/body-m'], { color: color('semantic/warning') }]}>You have 3 saved templates, the most you can keep. Delete one to make another.</Text> : null}
        {cfg.isPending ? <SkeletonBlock height={200} radius={radius.lg} /> : cfg.isError ? <ErrorBanner onRetry={() => void cfg.refetch()} /> : (
          <BuilderGroups keys={ORDER} s={s} set={(p) => setS((x) => ({ ...x, ...p }))} cfg={cfg.data} collections={collections.data ?? []} askable asked={asked} onAsk={(k) => setAsked((a) => (a.includes(k) ? a.filter((x) => x !== k) : [...a, k]))} />
        )}
      </ScrollView>
      <View style={{ padding: space.md }}>
        <PrimaryButton label="SAVE TEMPLATE" onPress={() => setOpen(true)} disabled={full || !mixValid(s)} />
      </View>
      <BottomSheet visible={open} onClose={() => !save.isPending && setOpen(false)} title="Save this template" dismissable={!save.isPending}>
        <View style={{ gap: space.sm, paddingBottom: space.md }}>
          <InputField label="Name this template" value={name} onChangeText={setName} placeholder="Template name" maxLength={80} autoFocus />
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <View style={{ flex: 1 }}><SecondaryButton label="CANCEL" onPress={() => setOpen(false)} disabled={save.isPending} /></View>
            <View style={{ flex: 1 }}><PrimaryButton label="SAVE" onPress={() => save.mutate()} loading={save.isPending} disabled={!name.trim()} /></View>
          </View>
        </View>
      </BottomSheet>
    </Screen>
  );
}
