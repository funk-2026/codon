import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View, type ScrollViewInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { CaretLeft, Check, FlagBanner, FlagPennant, Funnel, NotePencil, ShareNetwork, Timer, Users, WarningCircle, BookmarkSimple } from 'phosphor-react-native';
import { BottomSheet, EmptyState, PrimaryButton, SecondaryButton, SkeletonBlock, TextButton, useToast, Screen, ScreenHeader } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { RichContent, OptionCard, type MediaMap, type OptionState } from '@/src/rich';
import { BookmarkButton } from '@/src/bookmarks/BookmarkButton';
import { ReportSheet } from '@/src/social/ReportSheet';
import { QuestionTagRow, ReferencesBlock, shareQuestion } from '@/src/question/QuestionMeta';
import { questionShareText } from '@/src/question/logic';
import { plainText } from '@/src/rich';
import { deleteCustomTest } from '@/src/api/customTests';
import { ROUTES } from '@/src/navigation/routes';
import { NoteSheet } from '@/src/social/NoteSheet';
import { ExplanationThumbs } from '@/src/social/RatingControl';
import { getAttemptReview, type ReviewFilter, type ReviewItem } from '@/src/api/attempts';
import { formatClock } from '@/src/attempt/logic';
import { useQuestionCountdown } from '@/src/attempt/useQuestionCountdown';
import { kvGet, kvSet } from '@/src/storage/kv';

const REVIEW_LIMIT_SECONDS = 120;
const REVIEW_LIMIT_KEY = 'review-2min-limit';
import { useScreenProtection } from '@/src/security/useScreenProtection';
import { useAttemptResult } from '@/src/queries/attempts';
import { useSafeBack } from '@/src/navigation/useSafeBack';
import { shadow } from '@/src/theme/elevation';

const PAGE = 200;

type Status = 'correct' | 'incorrect' | 'unattempted';
const statusOf = (r: ReviewItem): Status => (r.selected_option == null ? 'unattempted' : r.is_correct ? 'correct' : 'incorrect');

const FILTERS: { id: ReviewFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'bookmarked', label: 'Bookmarked' },
  { id: 'correct', label: 'Correct' },
  { id: 'wrong', label: 'Wrong' },
  { id: 'unattempted', label: 'Skipped' },
];

const EMPTY_TEXT: Record<ReviewFilter, string> = {
  all: 'No questions to show.',
  wrong: 'Nothing here — you got every attempted question right.',
  correct: 'No correct answers to show yet.',
  unattempted: 'Nothing here — you attempted every question.',
  marked: 'You didn’t mark any question for review.',
  bookmarked: 'None of this test’s questions are bookmarked.',
};

export default function TestReviewRoute() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const goBack = useSafeBack();
  const { show } = useToast();
  const insets = useSafeAreaInsets();
  const { id, position } = useLocalSearchParams<{ id?: string; position?: string }>();
  // Tests review in ranges of twenty; QBank, Custom Module and the rest in ranges of ten.
  const moduleType = useAttemptResult(id, false).data?.attempt?.test?.module_type;
  const RANGE = moduleType === 'test_series' ? 20 : 10;
  const testIdForDiscard = useAttemptResult(id, false).data?.attempt?.test_id;
  // Opened at a specific question (e.g. "slowest questions" on the result screen) — first load only.
  const startAt = useRef(position ? Number(position) : null);

  useScreenProtection();
  const [filter, setFilter] = useState<ReviewFilter>('all');
  const [subject, setSubject] = useState<string | undefined>();
  const [draftSubject, setDraftSubject] = useState<string | undefined>();
  const [subjects, setSubjects] = useState<{ id: string; name: string }[]>([]);
  const [listOpen, setListOpen] = useState(false);
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [media, setMedia] = useState<MediaMap>({});
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [pendingResults, setPendingResults] = useState(false);
  const [current, setCurrent] = useState(0);
  // Show or hide the answers while reviewing (starts on). The same switch is flipped by a double tap on the card.
  const [showAnswers, setShowAnswers] = useState(true);
  const [filterOpen, setFilterOpen] = useState(false);
  const [draftFilter, setDraftFilter] = useState<ReviewFilter>('all');
  const [reportOpen, setReportOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  // local overrides so a saved note / rating / report shows without refetching
  const [notes, setNotes] = useState<Record<string, string | null>>({});
  const [reported, setReported] = useState<Record<string, boolean>>({});
  const scrollRef = useRef<ScrollViewInstance>(null);
  const reqSeq = useRef(0);

  const load = useCallback(
    async (f: ReviewFilter, sub?: string) => {
      if (!id) return;
      const seq = ++reqSeq.current;
      setLoading(true);
      setLoadError(false);
      try {
        const target = startAt.current;
        // load far enough to include the requested question (server caps a page at 200)
        const limit = target && f === 'all' ? Math.min(200, Math.max(PAGE, target)) : PAGE;
        const res = await getAttemptReview(id, { filter: f, limit, subject_id: sub });
        if (seq !== reqSeq.current) return; // a newer filter tap won
        setItems(res.review);
        if (f === 'all' && !sub) {
          const m = new Map<string, string>();
          for (const r of res.review) if (r.question_meta.subject_id && r.question_meta.subject) m.set(r.question_meta.subject_id, r.question_meta.subject);
          const order = ['Biology', 'Chemistry', 'Physics'];
          setSubjects([...m.entries()].map(([sid, name]) => ({ id: sid, name })).sort((a, b) => (order.indexOf(a.name) < 0 ? 9 : order.indexOf(a.name)) - (order.indexOf(b.name) < 0 ? 9 : order.indexOf(b.name))));
        }
        setMedia(res.media ?? {});
        setCursor(res.next_cursor);
        const at = target ? res.review.findIndex((r) => r.position === target) : -1;
        setCurrent(at >= 0 ? at : 0);
        startAt.current = null;
      } catch (e) {
        if (seq !== reqSeq.current) return;
        console.error('Couldn’t load review. Try again.', e);
        setPendingResults((e as { code?: string })?.code === 'results_pending');
        setLoadError(true);
      } finally {
        if (seq === reqSeq.current) setLoading(false);
      }
    },
    [id],
  );

  useEffect(() => {
    void load(filter, subject);
  }, [filter, subject, load]);

  const loadMore = useCallback(async () => {
    if (!id || !cursor || loadingMore) return;
    const seq = reqSeq.current;
    setLoadingMore(true);
    try {
      const res = await getAttemptReview(id, { filter, limit: PAGE, cursor, subject_id: subject });
      if (seq !== reqSeq.current) return; // filter changed mid-request — this page belongs to the old list
      setItems((prev) => [...prev, ...res.review]);
      setMedia((m) => ({ ...m, ...(res.media ?? {}) }));
      setCursor(res.next_cursor);
    } catch {
      /* the next navigation retries */
    } finally {
      setLoadingMore(false);
    }
  }, [id, cursor, filter, subject, loadingMore]);

  // prefetch the next page when the reader gets within 5 questions of the end
  useEffect(() => {
    if (cursor && items.length > 0 && current >= items.length - 5) void loadMore();
  }, [current, items.length, cursor, loadMore]);

  const go = (i: number) => {
    setCurrent(i);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  };

  const q = items[current];
  const atEnd = current >= items.length - 1 && !cursor;

  // "Max 2 minutes per question" while reviewing: counts down, then moves on.
  // The student can switch it off (remembered on this device).
  const [limitOn, setLimitOn] = useState(true);
  useEffect(() => {
    kvGet<boolean>(REVIEW_LIMIT_KEY, true).then(setLimitOn).catch(() => {});
  }, []);
  const toggleLimit = () =>
    setLimitOn((v) => {
      void kvSet(REVIEW_LIMIT_KEY, !v);
      show(!v ? '2-minute limit on' : '2-minute limit off', 'success');
      return !v;
    });
  const reviewLeft = useQuestionCountdown(q?.question_id, REVIEW_LIMIT_SECONDS, limitOn && !!q, () => {
    if (current < items.length - 1) {
      show('2 minutes up — next question', 'success');
      go(current + 1);
    } else {
      show('2 minutes up for this question', 'success');
    }
  });

  const TopBar = (
    <View>
      <ScreenHeader
        size="small"
        title="Review"
        right={
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
            <Text style={[type['type/caption'], { color: color('text/secondary') }]}>{showAnswers ? 'Hide answers' : 'Show answers'}</Text>
            <Switch value={showAnswers} onValueChange={setShowAnswers} accessibilityLabel="Show answers" trackColor={{ false: color('border/strong'), true: color('accent/default') }} thumbColor={color('bg/surface')} />
            <Pressable
              onPress={() => { setDraftFilter(filter); setDraftSubject(subject); setFilterOpen(true); }}
              accessibilityRole="button"
              accessibilityLabel={filter === 'all' && !subject ? 'Filter' : 'Filter, applied'}
              style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
            >
              <Funnel size={24} weight={filter === 'all' && !subject ? 'regular' : 'fill'} color={filter === 'all' && !subject ? color('text/primary') : color('accent/default')} />
            </Pressable>
          </View>
        }
      />
      <View style={{ paddingHorizontal: space.md, flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        {items.length > 0 ? (
          <>
            <Text style={[type['type/caption'], { color: color('text/secondary') }]}>Question {current + 1}{cursor ? '+' : ''} of {items.length}{cursor ? '+' : ''}</Text>
            <View style={{ flex: 1, height: 3, backgroundColor: color('bg/sunken'), borderRadius: 2 }}>
              <View style={{ width: `${((current + 1) / items.length) * 100}%`, height: 3, backgroundColor: color('accent/default'), borderRadius: 2 }} />
            </View>
          </>
        ) : <View style={{ flex: 1 }} />}
        {items.length > 0 ? (
          <Pressable onPress={() => setListOpen(true)} accessibilityRole="button" accessibilityLabel="Open the list of questions" style={{ minHeight: 36, justifyContent: 'center', paddingHorizontal: space.sm, borderRadius: radius.pill, backgroundColor: color('bg/sunken') }}>
            <Text style={[type['type/caption'], { color: color('text/primary') }]}>List</Text>
          </Pressable>
        ) : null}
        <Pressable
          onPress={toggleLimit}
          accessibilityRole="button"
          accessibilityLabel={reviewLeft != null ? `${formatClock(reviewLeft)} left for this question. Tap to turn the 2-minute limit off` : 'Turn on the 2-minute limit per question'}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 36, minWidth: 64, justifyContent: 'center', paddingHorizontal: space.sm, borderRadius: radius.pill, backgroundColor: reviewLeft != null && reviewLeft <= 30 ? color('semantic/warning-tint') : color('bg/sunken') }}
        >
          <Timer size={14} color={reviewLeft != null && reviewLeft <= 30 ? color('semantic/warning') : color('text/secondary')} />
          <Text style={[type['type/caption'], { color: reviewLeft != null && reviewLeft <= 30 ? color('semantic/warning') : color('text/primary') }]}>{reviewLeft != null ? formatClock(reviewLeft) : '2-min off'}</Text>
        </Pressable>
      </View>
    </View>
  );

  return (
    <Screen>
      {TopBar}
      {items.length > RANGE ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginTop: space.xs }} contentContainerStyle={{ paddingHorizontal: space.md, gap: space.xs }}>
          {Array.from({ length: Math.ceil(items.length / RANGE) }, (_, r) => {
            const from = r * RANGE + 1;
            const to = Math.min(items.length, (r + 1) * RANGE);
            const on = Math.floor(current / RANGE) === r;
            return (
              <Pressable key={r} onPress={() => go(r * RANGE)} accessibilityRole="button" accessibilityState={{ selected: on }} style={{ minHeight: 36, paddingHorizontal: space.md, justifyContent: 'center', borderRadius: radius.pill, backgroundColor: on ? color('accent/tint') : color('bg/surface'), borderWidth: 1, borderColor: on ? color('accent/default') : color('border/subtle') }}>
                <Text style={[type['type/caption'], { color: on ? color('accent/default') : color('text/secondary') }]}>{from}-{to}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}

      {loading ? (
        <View style={{ flex: 1, paddingHorizontal: space.md, paddingTop: space.lg }}>
          <View style={{ backgroundColor: color('bg/surface'), borderRadius: radius.lg, padding: space.lg, gap: space.sm }}>
            <SkeletonBlock width={120} height={16} radius={radius.sm} />
            <SkeletonBlock height={48} radius={radius.md} />
            <SkeletonBlock height={52} radius={radius.md} />
            <SkeletonBlock height={52} radius={radius.md} />
          </View>
        </View>
      ) : loadError && pendingResults ? (
        <EmptyState
          icon={<WarningCircle size={32} color={color('text/tertiary')} />}
          title="Answers open with the results"
          description="This was a live test. You will be notified when results are released, and then you can review every answer."
          style={{ flex: 1, justifyContent: 'center' }}
        />
      ) : loadError ? (
        <EmptyState
          icon={<WarningCircle size={32} color={color('semantic/danger')} weight="fill" />}
          title="Couldn’t load review"
          description="Couldn’t load your test review. Check your connection and try again."
          action={<TextButton label="Retry" onPress={() => load(filter)} />}
          style={{ flex: 1, justifyContent: 'center' }}
        />
      ) : items.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.md, gap: space.xs }}>
          <Check size={28} color={color('semantic/success')} weight="duotone" />
          <Text style={[type['type/body-m'], { color: color('text/secondary'), textAlign: 'center' }]}>{EMPTY_TEXT[filter]}</Text>
        </View>
      ) : q ? (
        <>
          <ScrollView
            ref={scrollRef}
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingHorizontal: space.md, paddingTop: space.lg, paddingBottom: space.lg }}
            showsVerticalScrollIndicator={false}
          >
            <ReviewCard
              q={q}
              media={media}
              note={q.question_id in notes ? notes[q.question_id] : q.my_note ?? null}
              showAnswers={showAnswers}
              onToggleAnswers={() => setShowAnswers((v) => !v)}
              onNote={() => setNoteOpen(true)}
            />
          </ScrollView>

          <View
            style={[
              styles.bottomBar,
              { backgroundColor: color('bg/surface'), borderTopColor: color('border/subtle'), borderTopWidth: 1, paddingHorizontal: space.md, paddingTop: space.sm, paddingBottom: space.sm + insets.bottom },
            ]}
          >
            <Pressable onPress={() => setReportOpen(true)} disabled={reported[q.question_id] ?? q.reported_by_me} accessibilityRole="button" accessibilityLabel={(reported[q.question_id] ?? q.reported_by_me) ? 'You reported this question' : 'Report a problem with this question'} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', opacity: (reported[q.question_id] ?? q.reported_by_me) ? 0.5 : 1 }}>
              <FlagBanner size={22} weight={(reported[q.question_id] ?? q.reported_by_me) ? 'fill' : 'regular'} color={color('text/secondary')} />
            </Pressable>
            <Pressable
              onPress={() => void shareQuestion(questionShareText({ text: plainText(q.question_text, q.content_format), a: plainText(q.option_a, q.content_format), b: plainText(q.option_b, q.content_format), c: plainText(q.option_c, q.content_format), d: plainText(q.option_d, q.content_format) }))}
              accessibilityRole="button"
              accessibilityLabel="Share this question"
              style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
            >
              <ShareNetwork size={22} color={color('text/secondary')} />
            </Pressable>
            <BookmarkButton questionId={q.question_id} />
            <View style={{ flex: 1 }} />
            {current > 0 ? (
              <Pressable onPress={() => go(current - 1)} accessibilityRole="button" accessibilityLabel="Previous question" style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
                <CaretLeft size={22} color={color('text/primary')} />
              </Pressable>
            ) : null}
            <PrimaryButton label={atEnd ? 'Done' : 'Next'} onPress={() => (atEnd ? goBack() : go(Math.min(current + 1, items.length - 1)))} loading={loadingMore && current >= items.length - 1} />
          </View>

          <BottomSheet visible={filterOpen} onClose={() => setFilterOpen(false)} title="Filter">
            <View style={{ gap: space.xs }}>
              <Text style={[type['type/overline'], { color: color('text/tertiary') }]}>ANSWERS</Text>
              {FILTERS.map((f) => {
                const on = draftFilter === f.id;
                return (
                  <Pressable key={f.id} onPress={() => setDraftFilter(f.id)} accessibilityRole="radio" accessibilityState={{ selected: on }} style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                    <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: on ? color('accent/default') : color('border/strong'), alignItems: 'center', justifyContent: 'center' }}>
                      {on ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color('accent/default') }} /> : null}
                    </View>
                    <Text style={[type['type/body-l'], { color: color('text/primary') }]}>{f.label}</Text>
                  </Pressable>
                );
              })}
              {subjects.length > 1 ? (
                <>
                  <Text style={[type['type/overline'], { color: color('text/tertiary'), marginTop: space.sm }]}>SUBJECTS</Text>
                  {[{ id: undefined as string | undefined, name: 'All' }, ...subjects].map((sj) => {
                    const on = draftSubject === sj.id;
                    return (
                      <Pressable key={sj.id ?? 'all'} onPress={() => setDraftSubject(sj.id)} accessibilityRole="radio" accessibilityState={{ selected: on }} style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                        <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: on ? color('accent/default') : color('border/strong'), alignItems: 'center', justifyContent: 'center' }}>
                          {on ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color('accent/default') }} /> : null}
                        </View>
                        <Text style={[type['type/body-l'], { color: color('text/primary') }]}>{sj.name}</Text>
                      </Pressable>
                    );
                  })}
                </>
              ) : null}
              <View style={{ marginTop: space.sm, flexDirection: 'row', gap: space.sm }}>
                <View style={{ flex: 1 }}><SecondaryButton label="Reset" onPress={() => { setDraftFilter('all'); setDraftSubject(undefined); }} /></View>
                <View style={{ flex: 2 }}><PrimaryButton label="Apply" onPress={() => { setFilter(draftFilter); setSubject(draftSubject); setFilterOpen(false); }} /></View>
              </View>
            </View>
          </BottomSheet>

          <BottomSheet visible={listOpen} onClose={() => setListOpen(false)} title={`Questions ${Math.floor(current / RANGE) * RANGE + 1}-${Math.min(items.length, (Math.floor(current / RANGE) + 1) * RANGE)}`} maxHeightPct={0.85}>
            <ScrollView style={{ maxHeight: 480 }}>
              {items.slice(Math.floor(current / RANGE) * RANGE, (Math.floor(current / RANGE) + 1) * RANGE).map((it, k) => {
                const idx = Math.floor(current / RANGE) * RANGE + k;
                const tone = it.selected_option == null ? color('text/tertiary') : it.is_correct ? color('semantic/success') : color('semantic/danger');
                return (
                  <Pressable key={it.question_id} onPress={() => { go(idx); setListOpen(false); }} accessibilityRole="button" style={{ minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: space.sm, borderBottomWidth: 1, borderBottomColor: color('border/subtle') }}>
                    <Text style={[type['type/body-m-medium'], { color: tone, width: 28 }]}>{idx + 1}.</Text>
                    <View style={{ flex: 1 }}>
                      <Text numberOfLines={2} style={[type['type/body-m'], { color: color('text/primary') }]}>{plainText(it.question_text, it.content_format as string)}</Text>
                      <Text style={[type['type/caption'], { color: tone }]}>{it.question_meta.subject ? `${it.question_meta.subject} · ` : ''}{it.selected_option == null ? 'Skipped' : it.is_correct ? 'Correct' : 'Wrong'}</Text>
                    </View>
                    {it.bookmarked ? <BookmarkSimple size={18} color={color('accent/default')} weight="fill" /> : null}
                  </Pressable>
                );
              })}
              {moduleType === 'custom' && Math.floor(current / RANGE) >= Math.ceil(items.length / RANGE) - 1 && testIdForDiscard ? (
                <TextButton label="Discard and create a new custom module" onPress={() => { setListOpen(false); void deleteCustomTest(testIdForDiscard).finally(() => router.dismissTo({ pathname: ROUTES.student.practice, params: { kind: 'custom' } })); }} />
              ) : null}
            </ScrollView>
          </BottomSheet>

          <ReportSheet
            visible={reportOpen}
            onClose={() => setReportOpen(false)}
            questionId={q.question_id}
            attemptId={id}
            context="review"
            onReported={() => setReported((r) => ({ ...r, [q.question_id]: true }))}
          />
          <NoteSheet
            visible={noteOpen}
            onClose={() => setNoteOpen(false)}
            questionId={q.question_id}
            initial={(q.question_id in notes ? notes[q.question_id] : q.my_note) ?? ''}
            onSaved={(b) => setNotes((n) => ({ ...n, [q.question_id]: b }))}
          />
        </>
      ) : null}
    </Screen>
  );
}

function ReviewCard({
  q, media, note, showAnswers, onToggleAnswers, onNote,
}: { q: ReviewItem; media: MediaMap; note: string | null; showAnswers: boolean; onToggleAnswers: () => void; onNote: () => void }) {
  const { color, type, space, radius } = useTheme();
  // A double tap on the card flips Show / Hide answers, the same as the switch at the top.
  const [lastTap, setLastTap] = useState(0);
  const onTap = () => {
    const now = Date.now();
    if (now - lastTap < 350) {
      onToggleAnswers();
      setLastTap(0);
    } else setLastTap(now);
  };
  const st = statusOf(q);
  const badge = {
    correct: { text: 'Correct', bg: color('semantic/success'), fg: color('text/inverse') },
    incorrect: { text: 'Incorrect', bg: color('semantic/danger'), fg: color('text/inverse') },
    unattempted: { text: 'Unattempted', bg: color('bg/sunken'), fg: color('text/secondary') },
  }[st];

  const stateOf = (letter: string): OptionState => {
    if (!showAnswers) return 'idle';
    if (letter === q.correct_option) return q.selected_option === letter ? 'correct' : 'missed';
    return q.selected_option === letter ? 'wrong' : 'idle';
  };
  const opts: [string, string][] = [['A', q.option_a], ['B', q.option_b], ['C', q.option_c], ['D', q.option_d]];
  const meta = [q.question_meta.subject, q.question_meta.chapter, q.question_meta.difficulty].filter(Boolean) as string[];

  return (
    <Pressable onPress={onTap} accessible={false} style={[{ backgroundColor: color('bg/surface'), borderRadius: radius.lg, padding: space.lg }, shadow()]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: space.sm }}>
        <Text style={[type['type/overline'], { color: color('text/tertiary'), flex: 1 }]}>QUESTION {q.position}</Text>
        {q.marked_for_review ? (
          <View accessible accessibilityLabel="Marked for review">
            <FlagPennant size={18} weight="fill" color={color('semantic/warning')} />
          </View>
        ) : null}
        {showAnswers ? (
          <View style={{ backgroundColor: badge.bg, borderRadius: radius.pill, paddingHorizontal: space.sm, paddingVertical: 2, marginLeft: space.xs }}>
            <Text style={[type['type/caption'], { color: badge.fg }]}>{badge.text}</Text>
          </View>
        ) : null}
      </View>

      {meta.length > 0 ? (
        <Text style={[type['type/caption'], { color: color('text/tertiary'), marginBottom: space.sm }]}>{meta.join(' · ')}</Text>
      ) : null}

      <RichContent value={q.question_text} format={q.content_format} media={media} variant="stem" />
      <QuestionTagRow tags={q.question_meta.tags} questionId={q.question_id} />

      <View style={{ gap: space.sm, marginTop: space.md }}>
        {opts.map(([letter, val]) => (
          <View key={letter}>
            <OptionCard letter={letter} value={val} format={q.content_format} media={media} state={stateOf(letter)} />
            {showAnswers && q.option_shares ? (
              <Text style={[type['type/caption'], { color: color('text/tertiary'), textAlign: 'right', marginTop: 2 }]} accessibilityLabel={`${q.option_shares[letter] ?? 0} percent of students chose option ${letter}`}>
                {q.option_shares[letter] ?? 0}% chose this
              </Text>
            ) : null}
          </View>
        ))}
      </View>

      {/* Stats row */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.md, marginTop: space.md }}>
        {q.time_spent_seconds != null ? (
          <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>You spent {formatClock(q.time_spent_seconds)}</Text>
        ) : null}
        {q.confidence ? <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>Confidence: {q.confidence}</Text> : null}
        {showAnswers && q.cohort_correct_pct != null ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Users size={14} color={color('text/tertiary')} />
            <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>{Math.round(q.cohort_correct_pct)}% of students got this right</Text>
          </View>
        ) : null}
      </View>

      {showAnswers && q.explanation ? (
        <View style={{ backgroundColor: color('bg/sunken'), borderRadius: radius.md, padding: space.md, marginTop: space.md }}>
          <Text style={[type['type/overline'], { color: color('text/tertiary'), marginBottom: 6 }]}>EXPLANATION</Text>
          <RichContent value={q.explanation} format={q.content_format} media={media} variant="explanation" />
        </View>
      ) : null}

      {showAnswers ? <ReferencesBlock book={q.question_meta.ref_book} edition={q.question_meta.ref_edition} pages={q.question_meta.ref_pages} /> : null}

      {showAnswers ? (
        <View style={{ marginTop: space.md }}>
          <ExplanationThumbs questionId={q.question_id} value={q.my_rating ?? null} />
        </View>
      ) : null}

      {note ? (
        <Pressable onPress={onNote} accessibilityRole="button" accessibilityLabel="Edit my note" style={{ backgroundColor: color('accent/tint'), borderRadius: radius.md, padding: space.md, marginTop: space.md }}>
          <Text style={[type['type/overline'], { color: color('text/tertiary'), marginBottom: 4 }]}>MY NOTE</Text>
          <Text style={[type['type/body-m'], { color: color('text/primary') }]}>{note}</Text>
        </Pressable>
      ) : null}

      {/* The note stays on the card; report, share and bookmark live in the bottom bar. */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: space.sm }}>
        <Pressable onPress={onNote} accessibilityRole="button" accessibilityLabel={note ? 'Edit my note' : 'Add a note'} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, paddingHorizontal: space.xs }}>
          <NotePencil size={22} weight={note ? 'fill' : 'regular'} color={note ? color('accent/default') : color('text/primary')} />
          <Text style={[type['type/caption'], { color: color('text/secondary') }]}>{note ? 'Edit note' : 'Add a note'}</Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  bottomBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  legendRow: { flexDirection: 'row', flexWrap: 'wrap' },
  paletteGrid: { flexDirection: 'row', flexWrap: 'wrap' },
});
