import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { WarningCircle, X } from 'phosphor-react-native';
import { EmptyState, PrimaryButton, SecondaryButton, SkeletonBlock, TextButton } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { OptionCard, RichContent, type MediaMap, type OptionState } from '@/src/rich';
import { getTeacherTest } from '@/src/api/teacher';
import type { AuthoredQuestion, Test } from '@/src/api/tests';
import { formatClock } from '@/src/attempt/logic';

type Letter = 'A' | 'B' | 'C' | 'D';

/**
 * Preview as student (FE-2.16): the teacher runs their own test with the
 * student-facing components (stem, OptionCard, explanation, timer, score).
 * Entirely local — nothing is saved and no attempt is created (attempt
 * endpoints are student-only). "Check" reveals like tutor mode.
 */
export default function PreviewRunRoute() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { testId } = useLocalSearchParams<{ testId: string }>();

  const [test, setTest] = useState<Test | null>(null);
  const [qs, setQs] = useState<AuthoredQuestion[] | null>(null);
  const [media, setMedia] = useState<MediaMap>({});
  const [error, setError] = useState(false);
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<Record<string, Letter>>({});
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [finished, setFinished] = useState(false);
  const [elapsed, setElapsed] = useState(0); // seconds since the preview opened

  useEffect(() => {
    if (!testId) return;
    getTeacherTest(String(testId))
      .then((r) => {
        setTest(r.test);
        setQs([...(r.questions ?? [])].sort((a, b) => a.order_index - b.order_index));
        setMedia(r.media ?? {});
      })
      .catch(() => setError(true));
  }, [testId]);

  useEffect(() => {
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const q = qs?.[i];
  const limit = test?.duration_minutes ? test.duration_minutes * 60 : null;

  const score = useMemo(() => {
    if (!qs || !test) return null;
    let correct = 0, wrong = 0;
    for (const x of qs) {
      const p = picked[x.id];
      if (!p) continue;
      if (p === x.correct_option) correct++;
      else wrong++;
    }
    return { correct, wrong, skipped: qs.length - correct - wrong, marks: correct * test.marks_per_correct + wrong * test.marks_per_wrong, max: qs.length * test.marks_per_correct };
  }, [qs, test, picked]);

  const stateOf = (letter: Letter): OptionState => {
    if (!q) return 'idle';
    const sel = picked[q.id] === letter;
    if (checked[q.id]) {
      if (q.correct_option === letter) return sel ? 'correct' : 'missed';
      return sel ? 'wrong' : 'idle';
    }
    return sel ? 'selected' : 'idle';
  };

  const header = (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.md, paddingTop: space.md, gap: space.sm }}>
      <Pressable onPress={() => router.back()} hitSlop={space.xs} accessibilityRole="button" accessibilityLabel="Close preview" style={{ minWidth: 44, minHeight: 44, justifyContent: 'center' }}>
        <X size={24} color={color('text/primary')} />
      </Pressable>
      <View style={{ flex: 1 }}>
        <Text style={[type['type/body-m-medium'], { color: color('text/primary') }]} numberOfLines={1}>{test?.title ?? 'Preview'}</Text>
        <Text style={[type['type/caption'], { color: color('semantic/warning') }]}>Student preview · nothing is saved</Text>
      </View>
      {limit ? (
        <Text accessibilityLabel={`Time left ${formatClock(Math.max(0, limit - elapsed))}`} style={[type['type/body-m-medium'], { color: elapsed > limit ? color('semantic/danger') : color('text/primary') }]}>
          {formatClock(Math.max(0, limit - elapsed))}
        </Text>
      ) : null}
    </View>
  );

  if (error) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: color('bg/canvas') }}>
        {header}
        <EmptyState icon={<WarningCircle size={32} color={color('semantic/danger')} weight="fill" />} title="Couldn’t load the test" description="Check your connection and try again." action={<TextButton label="Close" onPress={() => router.back()} />} />
      </SafeAreaView>
    );
  }
  if (!qs || !test) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: color('bg/canvas') }}>
        {header}
        <View style={{ padding: space.md }}><SkeletonBlock height={260} radius={radius.lg} /></View>
      </SafeAreaView>
    );
  }
  if (qs.length === 0) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: color('bg/canvas') }}>
        {header}
        <EmptyState icon={<WarningCircle size={32} color={color('text/tertiary')} />} title="No questions yet" description="Add questions to preview the test." />
      </SafeAreaView>
    );
  }

  if (finished && score) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: color('bg/canvas') }}>
        {header}
        <ScrollView contentContainerStyle={{ padding: space.md, gap: space.md }}>
          <Text style={[type['type/h1'], { color: color('text/primary') }]}>{score.marks} / {score.max}</Text>
          <Text style={[type['type/body-m'], { color: color('text/secondary') }]}>
            {score.correct} correct · {score.wrong} wrong · {score.skipped} skipped · {formatClock(elapsed)} taken
          </Text>
          <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>
            Marking: +{test.marks_per_correct} / {test.marks_per_wrong}. This is how the result is scored for students.
          </Text>
          <PrimaryButton label="Run again" onPress={() => { setPicked({}); setChecked({}); setI(0); setElapsed(0); setFinished(false); }} />
          <SecondaryButton label="Close preview" onPress={() => router.back()} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  const letters: Letter[] = ['A', 'B', 'C', 'D'];
  const isChecked = !!checked[q!.id];
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color('bg/canvas') }}>
      {header}
      <ScrollView contentContainerStyle={{ padding: space.md, gap: space.md, paddingBottom: 140 + insets.bottom }}>
        <View style={{ backgroundColor: color('bg/surface'), borderRadius: radius.lg, padding: space.lg }}>
          <Text style={[type['type/overline'], { color: color('text/tertiary'), marginBottom: space['2xs'] }]}>QUESTION {i + 1} OF {qs.length}</Text>
          <RichContent value={q!.question_text} format={q!.content_format} media={media} variant="stem" />
        </View>
        <View style={{ gap: space.sm }}>
          {letters.map((L) => (
            <OptionCard
              key={L}
              letter={L}
              value={q![`option_${L.toLowerCase()}` as 'option_a']}
              format={q!.content_format}
              media={media}
              state={stateOf(L)}
              disabled={isChecked}
              onPress={() => setPicked((p) => ({ ...p, [q!.id]: L }))}
            />
          ))}
        </View>
        {!isChecked ? (
          <SecondaryButton label="Check answer" onPress={() => setChecked((c) => ({ ...c, [q!.id]: true }))} disabled={!picked[q!.id]} />
        ) : (
          <View style={{ backgroundColor: color('bg/surface'), borderRadius: radius.md, padding: space.md, gap: space.xs }}>
            <Text style={[type['type/body-m-medium'], { color: picked[q!.id] === q!.correct_option ? color('semantic/success') : color('semantic/danger') }]}>
              {picked[q!.id] === q!.correct_option ? 'Correct' : `Incorrect — the answer is ${q!.correct_option}`}
            </Text>
            {q!.explanation ? (
              <RichContent value={q!.explanation} format={q!.content_format} media={media} variant="explanation" />
            ) : (
              <Text style={[type['type/body-m'], { color: color('semantic/warning') }]}>No explanation — students will see this message.</Text>
            )}
          </View>
        )}
      </ScrollView>
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', gap: space.sm, padding: space.md, paddingBottom: space.md + insets.bottom, backgroundColor: color('bg/surface'), borderTopWidth: 1, borderTopColor: color('border/subtle') }}>
        <SecondaryButton label="Previous" onPress={() => setI((n) => Math.max(0, n - 1))} disabled={i === 0} style={{ flex: 1 }} />
        {i < qs.length - 1 ? (
          <PrimaryButton label="Next" onPress={() => setI((n) => n + 1)} style={{ flex: 1 }} />
        ) : (
          <PrimaryButton label="Finish" onPress={() => setFinished(true)} style={{ flex: 1 }} />
        )}
      </View>
    </SafeAreaView>
  );
}
