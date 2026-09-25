import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { CaretLeft } from 'phosphor-react-native';
import { InputField, PrimaryButton, SecondaryButton, SelectField, TextButton, useToast } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { RichField, plainText, type MediaMap, type MediaView } from '@/src/rich';
import { ApiError } from '@/src/api/client';
import { createBrainHackApi, getBrainHackCategories, submitBrainHack, updateBrainHackApi } from '@/src/api/discover';

const DEFAULT_CATS = ['Focus', 'Memory', 'Exam Day'];
const MAX_BODY = 4000;

/** Reading time at ~200 words/minute, minimum 1. */
const readMinutes = (body: string) => Math.max(1, Math.round(plainText(body, 'rich_v1').split(/\s+/).filter(Boolean).length / 200));

export default function CreateBrainHackRoute() {
  const { color, type, space } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { show } = useToast();

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<string | undefined>();
  const [cats, setCats] = useState<string[]>(DEFAULT_CATS);
  const [body, setBody] = useState('');
  const [media, setMedia] = useState<MediaMap>({});
  const [savedId, setSavedId] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | 'draft' | 'submit'>(null);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    getBrainHackCategories().then((r) => setCats((r.categories as any[]).map((c) => (typeof c === 'string' ? c : c.label ?? c.key)))).catch(() => {});
  }, []);

  const errors = useMemo(() => ({
    title: title.trim().length < 3 ? 'Give it a title (at least 3 characters).' : title.length > 120 ? 'Keep the title under 120 characters.' : null,
    category: category ? null : 'Pick a category.',
    body: plainText(body, 'rich_v1').trim().length < 20 && !/!\[/.test(body) ? 'Write the tip (at least a couple of sentences).' : body.length > MAX_BODY ? 'Too long.' : null,
  }), [title, category, body]);
  const valid = !errors.title && !errors.category && !errors.body;

  const save = async (submit: boolean) => {
    setTouched(true);
    if (!valid) return show('Fix the highlighted fields first.', 'error');
    setBusy(submit ? 'submit' : 'draft');
    try {
      const payload = { title: title.trim(), category: category!, body: body.trim(), read_minutes: readMinutes(body) };
      let id = savedId;
      if (id) await updateBrainHackApi(id, payload);
      else id = (await createBrainHackApi(payload)).id;
      setSavedId(id);
      if (submit) {
        await submitBrainHack(id);
        show('Submitted for review', 'success');
        router.replace('/(teacher)/(tabs)/(content)');
      } else show('Draft saved', 'success');
    } catch (e) {
      show(e instanceof ApiError && e.status === 403 ? 'You don’t have permission to do that.' : 'Couldn’t save. Your text is still here — try again.', 'error');
    } finally {
      setBusy(null);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color('bg/canvas') }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.md, paddingTop: space.md }}>
        <Pressable onPress={() => router.back()} hitSlop={space.xs} accessibilityRole="button" accessibilityLabel="Back" style={{ minWidth: 44, minHeight: 44, justifyContent: 'center' }}>
          <CaretLeft size={24} color={color('text/primary')} />
        </Pressable>
        <Text accessibilityRole="header" style={[type['type/h1'], { color: color('text/primary'), flex: 1 }]}>New Brain Hack</Text>
        <TextButton label={busy === 'draft' ? 'Saving…' : 'Save draft'} onPress={() => save(false)} disabled={!!busy} />
      </View>

      <ScrollView contentContainerStyle={{ padding: space.md, gap: space.lg, paddingBottom: 120 + insets.bottom }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <InputField label="Title" value={title} onChangeText={setTitle} error={touched ? errors.title ?? undefined : undefined} />
        <SelectField label="Category" value={category} options={cats.map((c) => ({ value: c, label: c }))} onChange={setCategory} error={touched ? errors.category : null} />
        <RichField
          label="The tip" required value={body} onChange={setBody} media={media} onMedia={(v: MediaView) => setMedia((m) => ({ ...m, [v.id]: v }))}
          purpose="brain_hack_image" maxChars={MAX_BODY} minLines={8} placeholder="Explain the tip in plain, friendly language. Add a picture if it helps." error={touched ? errors.body : null} maxImages={3}
        />
        <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>About {readMinutes(body)} min read · goes to an admin for review before students see it.</Text>
      </ScrollView>

      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: color('bg/surface'), borderTopWidth: 1, borderTopColor: color('border/subtle'), padding: space.md, paddingBottom: space.md + insets.bottom }}>
        <PrimaryButton label="Submit for review" onPress={() => save(true)} loading={busy === 'submit'} disabled={!!busy} />
      </View>
    </SafeAreaView>
  );
}
