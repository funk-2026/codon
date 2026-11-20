import { useCallback, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Clock, FlagBanner, ShareNetwork, X } from 'phosphor-react-native';
import { EmptyState, PrimaryButton, Screen, SkeletonBlock, TextButton } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { checkBookmarkedQuestion, type BookmarkCheck, type BookmarkRow } from '@/src/api/bookmarks';
import { OptionCard, RichContent, type MediaMap, type OptionState } from '@/src/rich';
import { BookmarkButton } from '@/src/bookmarks/BookmarkButton';
import { getReattempt } from '@/src/bookmarks/reattemptStore';
import { ReportSheet } from '@/src/social/ReportSheet';
import { QuestionTagRow, ReferencesBlock, shareQuestion } from '@/src/question/QuestionMeta';
import { questionShareText, timerLabel } from '@/src/question/logic';
import { useQuestionCountdown } from '@/src/attempt/useQuestionCountdown';
import { plainText } from '@/src/rich';
import { shadow } from '@/src/theme/elevation';

type Letter = 'A' | 'B' | 'C' | 'D';
const LIMIT = 120;

/**
 * Re-attempt a bookmarked list, one question at a time. Nothing here is saved: no attempt, answer, accuracy, goal,
 * streak or analytics changes. The student answers, sees what is right and why, and moves on.
 */
export default function BookmarkSolveRoute() {
  const { color } = useTheme();
  const router = useRouter();
  const { start } = useLocalSearchParams<{ start?: string }>();
  const session = getReattempt();
  const rows: BookmarkRow[] = session?.rows ?? [];
  const [index, setIndex] = useState(() => Math.min(Math.max(0, Number(start) || 0), Math.max(0, rows.length - 1)));
  const row = rows[index];

  if (!session || !row?.question) {
    return (
      <Screen>
        <EmptyState icon={<X size={32} color={color('text/tertiary')} />} title="Nothing to practice" description="Open a bookmarked question from your list." action={<TextButton label="Back" onPress={() => router.back()} />} />
      </Screen>
    );
  }
  const last = index >= rows.length - 1;
  // Keyed by the question, so each one starts clean: no answer, a fresh 2:00.
  return <Panel key={row.id} q={row.question} index={index} total={rows.length} media={session.media} last={last} onNext={() => (last ? router.back() : setIndex((i) => i + 1))} />;
}

function Panel({ q, index, total, media, last, onNext }: { q: NonNullable<BookmarkRow['question']>; index: number; total: number; media: MediaMap; last: boolean; onNext: () => void }) {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [picked, setPicked] = useState<Letter | ''>('');
  const [result, setResult] = useState<BookmarkCheck | null>(null);
  const [checking, setChecking] = useState(false);
  const [failed, setFailed] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const answered = !!result;

  const check = useCallback(async (opt: '' | Letter) => {
    setChecking(true);
    setFailed(false);
    try {
      setResult(await checkBookmarkedQuestion(q.id, opt));
    } catch {
      setFailed(true);
      setPicked('');
    } finally {
      setChecking(false);
    }
  }, [q.id]);

  const pick = (l: Letter) => {
    if (answered || checking) return;
    setPicked(l);
    void check(l);
  };

  // 2 minutes per question. It keeps running while the answer is being read. When it runs out with no answer, the
  // question locks as unattempted and the answer is shown; the student taps NEXT.
  const left = useQuestionCountdown(q.id, LIMIT, true, () => {
    if (!answered && !checking) void check('');
  });

  const optionState = (l: Letter): OptionState => {
    if (result) {
      if (result.correct_option === l) return picked === l ? 'correct' : 'missed';
      return picked === l ? 'wrong' : 'idle';
    }
    return picked === l ? 'selected' : 'idle';
  };
  const opts: [Letter, string][] = [['A', q.option_a], ['B', q.option_b], ['C', q.option_c], ['D', q.option_d]];
  const mergedMedia = { ...media, ...(result?.media ?? {}) };
  const shareText = questionShareText({ text: plainText(q.question_text, q.content_format), a: plainText(q.option_a, q.content_format), b: plainText(q.option_b, q.content_format), c: plainText(q.option_c, q.content_format), d: plainText(q.option_d, q.content_format) });

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.md, paddingTop: space.sm, gap: space.sm }}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Close" hitSlop={space.xs} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
          <X size={24} color={color('text/primary')} />
        </Pressable>
        <Text style={[type['type/body-m'], { color: color('text/secondary'), flex: 1, textAlign: 'center' }]}>Question {index + 1} of {total}</Text>
        <View accessible accessibilityLabel={`Time left ${timerLabel(left ?? LIMIT)}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, minWidth: 64, justifyContent: 'flex-end' }}>
          <Clock size={16} color={left != null && left <= 15 ? color('semantic/danger') : color('text/secondary')} />
          <Text style={[type['type/body-m-medium'], { color: left != null && left <= 15 ? color('semantic/danger') : color('text/secondary') }]}>{timerLabel(left ?? LIMIT)}</Text>
        </View>
      </View>
      <View style={{ marginHorizontal: space.md, marginTop: space.xs, backgroundColor: color('semantic/warning-tint'), borderRadius: radius.sm, paddingHorizontal: space.sm, paddingVertical: 6 }}>
        <Text style={[type['type/caption'], { color: color('highlight/on-tint') }]}>Re-attempts aren’t saved to your stats.</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: space.md, paddingBottom: 120 + insets.bottom }} showsVerticalScrollIndicator={false}>
        <View style={[{ backgroundColor: color('bg/surface'), borderRadius: radius.lg, padding: space.lg }, shadow()]}>
          <RichContent value={q.question_text} format={q.content_format} media={mergedMedia} variant="stem" />
          <QuestionTagRow tags={q.tags} questionId={q.id} />
        </View>

        <View style={{ gap: space.sm, marginTop: space.lg }} accessibilityRole="radiogroup">
          {opts.map(([l, v]) => (
            <OptionCard key={l} letter={l} value={v} format={q.content_format} media={mergedMedia} state={optionState(l)} disabled={answered || checking} share={result?.option_shares?.[l]} onPress={() => pick(l)} />
          ))}
        </View>
        {failed ? <Text style={[type['type/caption'], { color: color('semantic/danger'), marginTop: space.sm }]}>Couldn’t check that. Check your connection and tap an option again.</Text> : null}
        {checking ? <SkeletonBlock height={40} radius={radius.md} /> : null}

        {result ? (
          <View style={{ marginTop: space.lg, gap: space.sm }}>
            {picked ? (
              <Text style={[type['type/body-m-medium'], { color: result.is_correct ? color('semantic/success') : color('semantic/danger') }]}>
                {result.is_correct ? 'Correct' : `Incorrect. The answer is ${result.correct_option}`}
              </Text>
            ) : (
              <Text style={[type['type/body-m-medium'], { color: color('text/secondary') }]}>Time’s up. The answer is {result.correct_option}.</Text>
            )}
            {result.percent_correct != null ? (
              <View style={{ backgroundColor: color('accent/tint'), borderRadius: radius.md, padding: space.sm }}>
                <Text style={[type['type/body-m-medium'], { color: color('accent/default') }]}>{result.percent_correct}% of the people got this right</Text>
              </View>
            ) : null}
            <Text style={[type['type/overline'], { color: color('text/tertiary') }]}>EXPLANATION</Text>
            {result.explanation ? <RichContent value={result.explanation} format={result.content_format} media={mergedMedia} variant="explanation" /> : <Text style={[type['type/body-m'], { color: color('text/tertiary') }]}>No explanation for this question.</Text>}
            <ReferencesBlock book={result.ref_book} edition={result.ref_edition} pages={result.ref_pages} />
          </View>
        ) : null}
      </ScrollView>

      {/* Report and bookmark sit at the bottom left; once answered, share joins them and NEXT closes the row. */}
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', gap: space.xs, backgroundColor: color('bg/surface'), borderTopWidth: 1, borderTopColor: color('border/subtle'), paddingHorizontal: space.md, paddingTop: space.sm, paddingBottom: space.sm + insets.bottom }}>
        <Pressable onPress={() => setReportOpen(true)} accessibilityRole="button" accessibilityLabel="Report a problem with this question" style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
          <FlagBanner size={22} color={color('text/secondary')} />
        </Pressable>
        {answered ? (
          <Pressable onPress={() => void shareQuestion(shareText)} accessibilityRole="button" accessibilityLabel="Share this question" style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
            <ShareNetwork size={22} color={color('text/secondary')} />
          </Pressable>
        ) : null}
        <BookmarkButton questionId={q.id} />
        <View style={{ flex: 1 }} />
        {answered ? <View style={{ width: 160 }}><PrimaryButton label={last ? 'Finish' : 'Next'} onPress={onNext} /></View> : null}
      </View>

      <ReportSheet visible={reportOpen} onClose={() => setReportOpen(false)} questionId={q.id} context="review" />
    </Screen>
  );
}
