import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { CaretLeft, CheckCircle, WarningCircle } from 'phosphor-react-native';
import { EmptyState, InputField, PrimaryButton, SecondaryButton, SkeletonBlock, TextButton, useToast } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { QuestionPreviewCard, type MediaMap } from '@/src/rich';
import {
  bulkUpdateQuestions, listQuestionBank, searchTags, type MissingKind, type QuestionBankRow, type TagRow,
} from '@/src/api/questionBank';
import type { Difficulty } from '@/src/api/tests';

const DIFFS: { key: Difficulty; label: string }[] = [{ key: 'easy', label: 'Easy' }, { key: 'medium', label: 'Medium' }, { key: 'hard', label: 'Hard' }];
const TITLE: Record<string, string> = { difficulty: 'Set difficulty', tags: 'Add tags', topic: 'Add a topic', ncert: 'Add NCERT page', alt_text: 'Describe images' };

/**
 * Quick-tag queue (FE-2.10): one question at a time from the "missing X"
 * list — one tap for difficulty, chips for tags; topic / NCERT / alt text open
 * the full editor. Swipe left = skip, right = back. Saves are per question and
 * a failed save keeps you on that card.
 */
export default function QuickTagRoute() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { show } = useToast();
  const { missing, chapterId, chapter } = useLocalSearchParams<{ missing: MissingKind; chapterId?: string; chapter?: string }>();

  const [rows, setRows] = useState<QuestionBankRow[] | null>(null);
  const [media, setMedia] = useState<MediaMap>({});
  const [error, setError] = useState(false);
  const [i, setI] = useState(0);
  const [doneIds, setDoneIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [popular, setPopular] = useState<TagRow[]>([]);
  const [tagText, setTagText] = useState('');
  const [picked, setPicked] = useState<string[]>([]);

  const load = useCallback(() => {
    setError(false);
    listQuestionBank({ missing, chapter_id: chapterId, limit: 50 })
      .then((r) => {
        setRows(r.items ?? []);
        setMedia(r.media ?? {});
        setI(0);
      })
      .catch(() => setError(true));
  }, [missing, chapterId]);
  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    if (missing === 'tags') searchTags('').then((r) => setPopular(r.tags ?? [])).catch(() => {});
  }, [missing]);

  const total = rows?.length ?? 0;
  const q = rows?.[i];
  const next = () => {
    setPicked([]);
    setTagText('');
    setI((n) => Math.min(n + 1, total));
  };
  const back = () => setI((n) => Math.max(0, n - 1));

  const save = async (patch: Parameters<typeof bulkUpdateQuestions>[1]) => {
    if (!q) return;
    setSaving(true);
    try {
      await bulkUpdateQuestions([q.id], patch);
      setDoneIds((s) => new Set(s).add(q.id));
      next();
    } catch {
      show('Couldn’t save — try again.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const swipe = Gesture.Pan()
    .activeOffsetX([-30, 30])
    .onEnd((e) => {
      if (e.translationX < -80) runOnJS(next)();
      else if (e.translationX > 80) runOnJS(back)();
    });

  const addTyped = () => {
    const t = tagText.trim();
    if (t && !picked.includes(t)) setPicked((p) => [...p, t]);
    setTagText('');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color('bg/canvas') }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.md, paddingTop: space.md }}>
        <Pressable onPress={() => router.back()} hitSlop={space.xs} accessibilityRole="button" accessibilityLabel="Back" style={{ minWidth: 44, minHeight: 44, justifyContent: 'center' }}>
          <CaretLeft size={24} color={color('text/primary')} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text accessibilityRole="header" style={[type['type/h2'], { color: color('text/primary') }]}>{TITLE[missing] ?? 'Quick tag'}</Text>
          {chapter ? <Text style={[type['type/caption'], { color: color('text/secondary') }]}>{chapter}</Text> : null}
        </View>
      </View>

      {total > 0 ? (
        <View style={{ paddingHorizontal: space.md, marginTop: space.sm, gap: 4 }} accessible accessibilityLabel={`${Math.min(i + 1, total)} of ${total}, ${doneIds.size} saved`}>
          <View style={{ height: 6, borderRadius: 3, backgroundColor: color('bg/sunken') }}>
            <View style={{ width: `${(Math.min(i, total) / total) * 100}%`, height: 6, borderRadius: 3, backgroundColor: color('accent/default') }} />
          </View>
          <Text style={[type['type/caption'], { color: color('text/secondary') }]}>{Math.min(i + 1, total)} of {total} · {doneIds.size} saved</Text>
        </View>
      ) : null}

      {error ? (
        <EmptyState icon={<WarningCircle size={32} color={color('semantic/danger')} weight="fill" />} title="Couldn’t load questions" description="Check your connection and try again." action={<TextButton label="Retry" onPress={load} />} />
      ) : rows == null ? (
        <View style={{ padding: space.md }}><SkeletonBlock height={240} radius={radius.md} /></View>
      ) : !q ? (
        <EmptyState
          icon={<CheckCircle size={32} color={color('semantic/success')} weight="fill" />}
          title={total === 0 ? 'Nothing to fix here' : 'All done'}
          description={total === 0 ? 'Every question in this list already has it.' : `${doneIds.size} of ${total} saved. Reopen to pick up anything you skipped.`}
          action={<TextButton label="Back" onPress={() => router.back()} />}
        />
      ) : (
        <>
          <GestureDetector gesture={swipe}>
            <ScrollView contentContainerStyle={{ padding: space.md, gap: space.sm, paddingBottom: 220 + insets.bottom }} keyboardShouldPersistTaps="handled">
              <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>{q.test.title}{doneIds.has(q.id) ? ' · saved' : ''}</Text>
              <QuestionPreviewCard q={q} index={i} media={media} />
            </ScrollView>
          </GestureDetector>

          <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: color('bg/surface'), borderTopWidth: 1, borderTopColor: color('border/subtle'), padding: space.md, paddingBottom: space.md + insets.bottom, gap: space.sm }}>
            {missing === 'difficulty' ? (
              <View style={{ flexDirection: 'row', gap: space.sm }}>
                {DIFFS.map((d) => (
                  <PrimaryButton key={d.key} label={d.label} onPress={() => save({ difficulty: d.key })} disabled={saving} style={{ flex: 1 }} />
                ))}
              </View>
            ) : missing === 'tags' ? (
              <>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.xs }} keyboardShouldPersistTaps="handled">
                  {[...picked.filter((p) => !popular.some((t) => t.label === p)).map((p) => ({ id: `new:${p}`, label: p })), ...popular].map((t) => {
                    const on = picked.includes(t.label);
                    return (
                      <Pressable
                        key={t.id}
                        onPress={() => setPicked((p) => (on ? p.filter((x) => x !== t.label) : [...p, t.label]))}
                        accessibilityRole="button"
                        accessibilityState={{ selected: on }}
                        style={{ minHeight: 36, paddingHorizontal: space.sm, borderRadius: radius.pill, justifyContent: 'center', borderWidth: 1, borderColor: on ? color('accent/default') : color('border/subtle'), backgroundColor: on ? color('accent/tint') : color('bg/sunken') }}
                      >
                        <Text style={[type['type/caption'], { color: on ? color('accent/default') : color('text/primary') }]}>{t.label}</Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
                <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'flex-end' }}>
                  <View style={{ flex: 1 }}>
                    <InputField label="New tag" value={tagText} onChangeText={setTagText} onSubmitEditing={addTyped} returnKeyType="done" maxLength={40} />
                  </View>
                  <PrimaryButton label="Save" onPress={() => save({ tags_add: picked })} loading={saving} disabled={picked.length === 0} />
                </View>
              </>
            ) : (
              <PrimaryButton
                label="Open in editor"
                onPress={() => {
                  setDoneIds((s) => new Set(s).add(q.id));
                  router.push({ pathname: '/(teacher)/question-editor', params: { testId: q.test.id, questionId: q.id } });
                  next();
                }}
              />
            )}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <SecondaryButton label="← Back" onPress={back} disabled={i === 0 || saving} />
              <SecondaryButton label="Skip →" onPress={next} disabled={saving} />
            </View>
          </View>
        </>
      )}
    </SafeAreaView>
  );
}
