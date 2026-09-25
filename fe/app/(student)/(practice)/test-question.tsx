import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, BackHandler, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { X, GridFour, WarningCircle, FlagPennant, FlagBanner, Lock } from 'phosphor-react-native';
import {
  BottomSheet, EmptyState, ErrorBanner, PrimaryButton, SecondaryButton, SkeletonBlock, TextButton, useToast,
} from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { RichContent, OptionCard, type OptionState } from '@/src/rich';
import { BookmarkButton } from '@/src/bookmarks/BookmarkButton';
import { ReportSheet } from '@/src/social/ReportSheet';
import { submitAttempt, type Option } from '@/src/api/attempts';
import { ApiError } from '@/src/api/client';
import { useAttemptSession } from '@/src/attempt/useAttemptSession';
import { useAttemptTimer } from '@/src/attempt/useAttemptTimer';
import { formatClock, nextUnanswered, paletteCounts, paletteStatus, timerLevel } from '@/src/attempt/logic';
import { track } from '@/src/analytics/track';
import { useScreenProtection } from '@/src/security/useScreenProtection';

const LETTERS: Option[] = ['A', 'B', 'C', 'D'];

export default function TestQuestionRoute() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { show } = useToast();
  const { id } = useLocalSearchParams<{ id?: string }>();

  useScreenProtection();
  const S = useAttemptSession(id as string | undefined);
  const { questions, ids, answers, media, attempt, tutor, sync } = S;

  const [current, setCurrent] = useState(0);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [exitOpen, setExitOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [revealing, setRevealing] = useState(false);
  const [tookOver, setTookOver] = useState(false);
  const [busyTakeover, setBusyTakeover] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const q = questions[current];
  const total = questions.length;
  const a = q ? answers[q.id] : undefined;
  const reveal = q ? S.reveals[q.id] : undefined;
  const counts = useMemo(() => paletteCounts(ids, answers), [ids, answers]);

  // ── navigation between questions ──
  const go = useCallback(
    (idx: number) => {
      if (idx < 0 || idx >= total) return;
      setCurrent(idx);
      scrollRef.current?.scrollTo({ y: 0, animated: false });
    },
    [total],
  );

  // bank time spent on the question we just left
  useEffect(() => {
    S.visit(q?.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q?.id]);
  useEffect(() => () => S.visit(undefined), []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── finishing ──
  const toResult = useCallback(
    (attemptId: string, expired = false) => {
      router.replace({ pathname: '/(student)/(practice)/test-result', params: { id: attemptId, ...(expired ? { expired: '1' } : {}) } });
    },
    [router],
  );

  const finish = useCallback(
    async (opts: { force?: boolean; expired?: boolean } = {}) => {
      if (!attempt) return;
      setSubmitting(true);
      setSubmitError(null);
      try {
        const saved = await sync.flushNow();
        if (!saved && !opts.force) {
          setSubmitError(`${sync.pending || 'Some'} answer${sync.pending === 1 ? '' : 's'} haven't saved yet — check your connection.`);
          setSubmitting(false);
          return;
        }
        await submitAttempt(attempt.id);
        track('custom.submitted', { mode: attempt.mode ?? 'exam', answered: counts.answered, total: counts.total, expired: !!opts.expired });
        setSubmitOpen(false);
        toResult(attempt.id, opts.expired);
      } catch (e) {
        if (e instanceof ApiError && e.code === 'attempt_expired') {
          // the server already finalised it — that's a success from the student's point of view
          toResult(attempt.id, true);
          return;
        }
        setSubmitError('Couldn’t submit. Check your connection and try again.');
        setSubmitting(false);
      }
    },
    [attempt, sync, counts, toResult],
  );

  // server said the deadline passed while we were saving
  useEffect(() => {
    if (S.phase === 'expired' && S.expiredAttemptId) toResult(S.expiredAttemptId, true);
  }, [S.phase, S.expiredAttemptId, toResult]);

  const left = useAttemptTimer(S.phase === 'ready' ? S.deadline : null, () => {
    void finish({ force: true, expired: true });
  });
  const level = timerLevel(left);
  useEffect(() => {
    if (left === 300) AccessibilityInfo.announceForAccessibility('5 minutes left');
    if (left === 60) AccessibilityInfo.announceForAccessibility('1 minute left');
  }, [left]);

  // permanently-refused saves (e.g. answer already revealed) → resync from the server
  useEffect(() => {
    if (S.rejected.length > 0) {
      show('Some answers couldn’t be saved and were refreshed.', 'error');
      void S.reload();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [S.rejected.length]);

  // Android back → exit dialog, never a silent exit mid-test
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (paletteOpen || submitOpen || reportOpen) return false; // sheets handle their own back
      setExitOpen(true);
      return true;
    });
    return () => sub.remove();
  }, [paletteOpen, submitOpen, reportOpen]);

  const locked = S.lockedElsewhere;

  const onReveal = async () => {
    if (!q) return;
    setRevealing(true);
    try {
      await S.reveal(q.id);
    } catch {
      show('Couldn’t check the answer. Try again.', 'error');
    } finally {
      setRevealing(false);
    }
  };

  const doTakeover = async () => {
    setBusyTakeover(true);
    try {
      await S.takeover();
      setTookOver(true);
    } catch {
      show('Couldn’t switch to this device. Try again.', 'error');
    } finally {
      setBusyTakeover(false);
    }
  };

  const optionState = (letter: Option): OptionState => {
    const selected = a?.selected === letter;
    if (reveal) {
      if (reveal.correct_option === letter) return selected ? 'correct' : 'missed';
      return selected ? 'wrong' : 'idle';
    }
    return selected ? 'selected' : 'idle';
  };

  const opts: [Option, string][] = q
    ? [['A', q.option_a], ['B', q.option_b], ['C', q.option_c], ['D', q.option_d]]
    : [];

  const isLast = current >= total - 1;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: color('bg/canvas') }]}>
      {/* Top bar */}
      <View style={{ paddingHorizontal: space.md, paddingTop: space.md }}>
        <View style={styles.topBar}>
          <Pressable
            onPress={() => setExitOpen(true)}
            hitSlop={space.xs}
            accessibilityRole="button"
            accessibilityLabel="Exit test"
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, minWidth: 44, minHeight: 44, justifyContent: 'center' })}
          >
            <X size={24} color={color('text/primary')} />
          </Pressable>
          <Text style={[type['type/body-m-medium'], { color: color('text/primary') }]}>
            {total > 0 ? `Question ${current + 1} of ${total}` : 'Loading…'}
          </Text>
          {left != null ? (
            <View
              accessible
              accessibilityRole="timer"
              accessibilityLabel={`Time left ${formatClock(left)}`}
              style={{
                backgroundColor: level === 'danger' ? color('semantic/danger') : level === 'warning' ? color('semantic/warning') : color('bg/sunken'),
                borderRadius: radius.pill, paddingHorizontal: space.sm, paddingVertical: 4, minWidth: 64, alignItems: 'center',
              }}
            >
              <Text style={[type['type/body-m-medium'], { color: level === 'normal' ? color('text/primary') : color('text/inverse') }]}>
                {formatClock(left)}
              </Text>
            </View>
          ) : (
            <View style={{ width: 44 }} />
          )}
        </View>
        <View style={{ height: 3, backgroundColor: color('bg/sunken'), borderRadius: 2, marginTop: space.xs }}>
          <View style={{ width: `${total ? ((current + 1) / total) * 100 : 0}%`, height: 3, backgroundColor: color('accent/default'), borderRadius: 2 }} />
        </View>
      </View>

      {S.phase === 'loading' ? (
        <View style={{ flex: 1, paddingHorizontal: space.md, marginTop: space.xl }}>
          <SkeletonBlock height={120} radius={radius.lg} />
          <View style={{ gap: space.sm, marginTop: space.lg }}>
            {[0, 1, 2, 3].map((i) => <SkeletonBlock key={i} height={56} radius={radius.md} />)}
          </View>
        </View>
      ) : S.phase === 'error' || S.phase === 'expired' ? (
        <EmptyState
          icon={<WarningCircle size={32} color={color('semantic/danger')} weight="fill" />}
          title="Couldn’t load this test"
          description={
            S.error instanceof ApiError && S.error.status === 403
              ? 'This test needs an active subscription.'
              : 'Something went wrong loading your questions. Check your connection and try again.'
          }
          action={<TextButton label="Retry" onPress={S.reload} />}
          style={{ flex: 1, justifyContent: 'center' }}
        />
      ) : !q ? (
        <EmptyState
          icon={<WarningCircle size={32} color={color('semantic/danger')} weight="fill" />}
          title="No questions available"
          description="This test doesn’t have any questions to show right now."
          action={<TextButton label="Retry" onPress={S.reload} />}
          style={{ flex: 1, justifyContent: 'center' }}
        />
      ) : (
        <>
          <ScrollView
            ref={scrollRef}
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingHorizontal: space.md, paddingTop: space.md, paddingBottom: space.xl }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {locked ? (
              <View style={[styles.banner, { backgroundColor: color('semantic/warning-tint'), borderRadius: radius.md, padding: space.md, marginBottom: space.md }]}>
                <Lock size={20} color={color('semantic/warning')} weight="fill" />
                <View style={{ flex: 1 }}>
                  <Text style={[type['type/body-m-medium'], { color: color('text/primary') }]}>This test is open on another device</Text>
                  <Text style={[type['type/caption'], { color: color('text/secondary') }]}>You can look around, but answers can only be changed from one device.</Text>
                </View>
                <SecondaryButton label="Continue here" onPress={doTakeover} loading={busyTakeover} />
              </View>
            ) : null}
            {tookOver && !locked ? (
              <Text style={[type['type/caption'], { color: color('text/tertiary'), marginBottom: space.sm }]}>Moved to this device.</Text>
            ) : null}
            {sync.pending > 0 && sync.status === 'retrying' ? (
              <ErrorBanner
                message={`${sync.pending} answer${sync.pending === 1 ? '' : 's'} not saved yet — retrying.`}
                onRetry={() => void sync.flushNow()}
                style={{ marginBottom: space.md }}
              />
            ) : null}

            {/* Question tools */}
            <View style={[styles.tools, { marginBottom: space.xs }]}>
              <Pressable
                onPress={() => S.toggleMark(q.id)}
                disabled={locked}
                accessibilityRole="button"
                accessibilityState={{ selected: !!a?.marked, disabled: locked }}
                accessibilityLabel={a?.marked ? 'Remove mark for review' : 'Mark for review'}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, paddingHorizontal: space.xs, opacity: locked ? 0.4 : 1 }}
              >
                <FlagPennant size={20} weight={a?.marked ? 'fill' : 'regular'} color={a?.marked ? color('semantic/warning') : color('text/secondary')} />
                <Text style={[type['type/body-m'], { color: a?.marked ? color('semantic/warning') : color('text/secondary') }]}>
                  {a?.marked ? 'Marked for review' : 'Mark for review'}
                </Text>
              </Pressable>
              <View style={{ flex: 1 }} />
              <BookmarkButton questionId={q.id} />
              <Pressable
                onPress={() => setReportOpen(true)}
                hitSlop={space.xs}
                accessibilityRole="button"
                accessibilityLabel="Report a problem with this question"
                style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' })}
              >
                <FlagBanner size={22} color={color('text/secondary')} />
              </Pressable>
            </View>

            <View style={[{ backgroundColor: color('bg/surface'), borderRadius: radius.lg, padding: space.lg }, shadow()]}>
              <Text style={[type['type/overline'], { color: color('text/tertiary'), marginBottom: space['2xs'] }]}>QUESTION {current + 1}</Text>
              <RichContent value={q.question_text} format={q.content_format} media={media} variant="stem" />
            </View>

            <View style={{ gap: space.sm, marginTop: space.lg }} accessibilityRole="radiogroup">
              {opts.map(([letter, val]) => (
                <OptionCard
                  key={letter}
                  letter={letter}
                  value={val}
                  format={q.content_format}
                  media={media}
                  state={optionState(letter)}
                  disabled={locked || !!reveal}
                  onPress={() => S.select(q.id, letter)}
                />
              ))}
            </View>

            {a?.selected && !reveal && !locked ? (
              <View style={{ alignItems: 'center', marginTop: space.sm }}>
                <TextButton label="Clear my response" onPress={() => S.clear(q.id)} />
              </View>
            ) : null}

            {tutor && !reveal ? (
              <PrimaryButton
                label="Check answer"
                onPress={onReveal}
                loading={revealing}
                disabled={!a?.selected || locked}
                style={{ marginTop: space.lg }}
              />
            ) : null}

            {reveal ? (
              <View style={{ marginTop: space.lg, backgroundColor: color('bg/surface'), borderRadius: radius.md, padding: space.md, gap: space.xs, borderWidth: 1, borderColor: color('border/subtle') }}>
                <Text style={[type['type/body-m-medium'], { color: reveal.is_correct ? color('semantic/success') : color('semantic/danger') }]}>
                  {reveal.is_correct ? 'Correct' : `Incorrect — the answer is ${reveal.correct_option}`}
                </Text>
                {reveal.explanation ? (
                  <RichContent value={reveal.explanation} format={reveal.content_format} media={media} variant="explanation" />
                ) : (
                  <Text style={[type['type/body-m'], { color: color('text/tertiary') }]}>No explanation for this question.</Text>
                )}
              </View>
            ) : null}
          </ScrollView>

          {/* Bottom bar */}
          <View
            style={[
              styles.bottomBar,
              {
                backgroundColor: color('bg/surface'), borderTopColor: color('border/subtle'), borderTopWidth: 1,
                paddingHorizontal: space.md, paddingTop: space.sm, paddingBottom: space.sm + insets.bottom,
              },
            ]}
          >
            {current > 0 ? <SecondaryButton label="Previous" onPress={() => go(current - 1)} /> : <View style={{ width: 100 }} />}
            <Pressable
              onPress={() => setPaletteOpen(true)}
              hitSlop={space.xs}
              accessibilityRole="button"
              accessibilityLabel={`Question palette. ${counts.answered} of ${counts.total} answered`}
              style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' })}
            >
              <GridFour size={26} color={color('text/primary')} />
            </Pressable>
            <PrimaryButton
              label={isLast ? 'Review & Submit' : 'Next'}
              onPress={() => (isLast ? setSubmitOpen(true) : go(current + 1))}
            />
          </View>

          {/* Palette */}
          <BottomSheet visible={paletteOpen} onClose={() => setPaletteOpen(false)} title="Question Palette">
            <View style={[styles.legendRow, { gap: space.md, flexWrap: 'wrap' }]}>
              <LegendDot label="Answered" bg={color('accent/default')} border={color('accent/default')} />
              <LegendDot label="Not answered" bg={color('bg/sunken')} border={color('border/strong')} />
              <LegendDot label="Marked" bg="transparent" border={color('semantic/warning')} />
            </View>
            <Text style={[type['type/caption'], { color: color('text/secondary'), marginTop: space.xs }]}>
              {counts.answered} answered · {counts.unanswered} not answered · {counts.marked} marked
            </Text>
            <View style={[styles.paletteGrid, { marginTop: space.md, gap: space.sm }]}>
              {ids.map((qid, i) => {
                const st = paletteStatus(answers[qid]);
                const answered = st === 'answered' || st === 'answered_marked';
                const marked = st === 'marked' || st === 'answered_marked';
                const isCurrent = i === current;
                return (
                  <Pressable
                    key={qid}
                    onPress={() => { setPaletteOpen(false); go(i); }}
                    accessibilityRole="button"
                    accessibilityLabel={`Question ${i + 1}, ${answered ? 'answered' : 'not answered'}${marked ? ', marked for review' : ''}${isCurrent ? ', current' : ''}`}
                    style={{
                      width: 44, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
                      backgroundColor: answered ? color('accent/default') : color('bg/sunken'),
                      borderWidth: isCurrent || marked ? 2 : 1,
                      borderColor: marked ? color('semantic/warning') : isCurrent ? color('text/primary') : color('border/strong'),
                    }}
                  >
                    <Text style={[type['type/body-m-medium'], { color: answered ? color('accent/on-accent') : color('text/secondary') }]}>{i + 1}</Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.lg }}>
              <SecondaryButton
                label="Next unanswered"
                disabled={counts.unanswered === 0}
                onPress={() => {
                  const n = nextUnanswered(ids, answers, current);
                  setPaletteOpen(false);
                  if (n >= 0) go(n);
                }}
              />
              <PrimaryButton label="Submit Test" onPress={() => { setPaletteOpen(false); setSubmitOpen(true); }} />
            </View>
          </BottomSheet>

          {/* Submit confirmation */}
          <BottomSheet visible={submitOpen} onClose={() => setSubmitOpen(false)} title={counts.unanswered === 0 ? 'All done — ready to submit?' : 'Ready to submit?'} dismissable={!submitting}>
            <View style={{ gap: space.xs }}>
              <Text style={[type['type/body-m'], { color: color('text/secondary') }]}>
                You answered {counts.answered} of {counts.total} questions.
                {counts.unanswered > 0 ? ` ${counts.unanswered} unanswered ${counts.unanswered === 1 ? 'question scores' : 'questions score'} zero — they’re not counted as wrong.` : ''}
              </Text>
              {counts.marked > 0 ? (
                <Text style={[type['type/body-m'], { color: color('semantic/warning') }]}>{counts.marked} still marked for review.</Text>
              ) : null}
              {submitError ? (
                <Text style={[type['type/body-m'], { color: color('semantic/danger') }]} accessibilityLiveRegion="polite">{submitError}</Text>
              ) : null}
            </View>
            <View style={{ gap: space.sm, marginTop: space.lg }}>
              <PrimaryButton label="Submit" onPress={() => void finish()} loading={submitting} />
              {submitError && sync.pending > 0 ? (
                <TextButton label={`Submit anyway (${sync.pending} unsaved answer${sync.pending === 1 ? '' : 's'} won’t count)`} onPress={() => void finish({ force: true })} />
              ) : null}
              <SecondaryButton label="Keep working" onPress={() => setSubmitOpen(false)} disabled={submitting} />
            </View>
          </BottomSheet>

          <ReportSheet
            visible={reportOpen}
            onClose={() => setReportOpen(false)}
            questionId={q.id}
            attemptId={attempt?.id}
            context={tutor && reveal ? 'tutor' : 'runtime'}
          />
        </>
      )}

      {/* Exit confirmation */}
      <BottomSheet visible={exitOpen} onClose={() => setExitOpen(false)} title="Exit test?">
        <Text style={[type['type/body-m'], { color: color('text/secondary') }]}>
          Your answers are saved — you can resume anytime from Practice.
          {left != null ? ' The clock keeps running while you’re away.' : ''}
        </Text>
        <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.lg }}>
          <SecondaryButton
            label="Exit"
            onPress={() => {
              void sync.flushNow();
              router.replace('/(student)/(practice)');
            }}
          />
          <PrimaryButton label="Stay" onPress={() => setExitOpen(false)} />
        </View>
      </BottomSheet>
    </SafeAreaView>
  );
}

function LegendDot({ label, bg, border }: { label: string; bg: string; border: string }) {
  const { color, type } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: bg, borderWidth: 2, borderColor: border }} />
      <Text style={[type['type/caption'], { color: color('text/secondary') }]}>{label}</Text>
    </View>
  );
}

function shadow() {
  return { shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 };
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  tools: { flexDirection: 'row', alignItems: 'center' },
  bottomBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  legendRow: { flexDirection: 'row', alignItems: 'center' },
  paletteGrid: { flexDirection: 'row', flexWrap: 'wrap' },
});
