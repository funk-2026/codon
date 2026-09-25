import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { CaretLeft, Check, FlagBanner, FlagPennant, GridFour, NotePencil, Users, WarningCircle } from 'phosphor-react-native';
import { BottomSheet, EmptyState, PrimaryButton, SecondaryButton, SkeletonBlock, TextButton } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { RichContent, OptionCard, type MediaMap, type OptionState } from '@/src/rich';
import { BookmarkButton } from '@/src/bookmarks/BookmarkButton';
import { ReportSheet } from '@/src/social/ReportSheet';
import { NoteSheet } from '@/src/social/NoteSheet';
import { ExplanationThumbs } from '@/src/social/RatingControl';
import { getAttemptReview, type ReviewFilter, type ReviewItem } from '@/src/api/attempts';
import { formatClock } from '@/src/attempt/logic';
import { useScreenProtection } from '@/src/security/useScreenProtection';

const PAGE = 50;

type Status = 'correct' | 'incorrect' | 'unattempted';
const statusOf = (r: ReviewItem): Status => (r.selected_option == null ? 'unattempted' : r.is_correct ? 'correct' : 'incorrect');

const FILTERS: { id: ReviewFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'wrong', label: 'Incorrect' },
  { id: 'correct', label: 'Correct' },
  { id: 'unattempted', label: 'Unattempted' },
  { id: 'marked', label: 'Marked' },
  { id: 'bookmarked', label: 'Bookmarked' },
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
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id?: string }>();

  useScreenProtection();
  const [filter, setFilter] = useState<ReviewFilter>('all');
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [media, setMedia] = useState<MediaMap>({});
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [current, setCurrent] = useState(0);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  // local overrides so a saved note / rating / report shows without refetching
  const [notes, setNotes] = useState<Record<string, string | null>>({});
  const [reported, setReported] = useState<Record<string, boolean>>({});
  const scrollRef = useRef<ScrollView>(null);
  const reqSeq = useRef(0);

  const load = useCallback(
    async (f: ReviewFilter) => {
      if (!id) return;
      const seq = ++reqSeq.current;
      setLoading(true);
      setLoadError(false);
      try {
        const res = await getAttemptReview(id, { filter: f, limit: PAGE });
        if (seq !== reqSeq.current) return; // a newer filter tap won
        setItems(res.review);
        setMedia(res.media ?? {});
        setCursor(res.next_cursor);
        setCurrent(0);
      } catch (e) {
        if (seq !== reqSeq.current) return;
        console.error('Failed to load review', e);
        setLoadError(true);
      } finally {
        if (seq === reqSeq.current) setLoading(false);
      }
    },
    [id],
  );

  useEffect(() => {
    void load(filter);
  }, [filter, load]);

  const loadMore = useCallback(async () => {
    if (!id || !cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await getAttemptReview(id, { filter, limit: PAGE, cursor });
      setItems((prev) => [...prev, ...res.review]);
      setMedia((m) => ({ ...m, ...(res.media ?? {}) }));
      setCursor(res.next_cursor);
    } catch {
      /* the next navigation retries */
    } finally {
      setLoadingMore(false);
    }
  }, [id, cursor, filter, loadingMore]);

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

  const counts = useMemo(() => {
    let c = 0, w = 0, u = 0;
    for (const r of items) {
      const s = statusOf(r);
      if (s === 'correct') c++; else if (s === 'incorrect') w++; else u++;
    }
    return { c, w, u };
  }, [items]);

  const TopBar = (
    <View style={{ paddingHorizontal: space.md, paddingTop: space.md }}>
      <View style={styles.topBar}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={space.xs}
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, minWidth: 44, minHeight: 44, justifyContent: 'center' })}
        >
          <CaretLeft size={24} color={color('text/primary')} />
        </Pressable>
        <Text style={[type['type/body-m-medium'], { color: color('text/primary') }]}>
          {items.length > 0 && q ? `Question ${q.position} · ${current + 1}${cursor ? '+' : ''} shown` : 'Review'}
        </Text>
        <View style={{ width: 44 }} />
      </View>
      {items.length > 0 ? (
        <View style={{ height: 3, backgroundColor: color('bg/sunken'), borderRadius: 2, marginTop: space.xs }}>
          <View style={{ width: `${((current + 1) / items.length) * 100}%`, height: 3, backgroundColor: color('accent/default'), borderRadius: 2 }} />
        </View>
      ) : null}
    </View>
  );

  const Chips = (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ marginTop: space.md, maxHeight: 48, flexGrow: 0, flexShrink: 0 }}
      contentContainerStyle={{ paddingHorizontal: space.md, gap: space.xs, alignItems: 'center' }}
    >
      {FILTERS.map((c) => {
        const active = filter === c.id;
        return (
          <Pressable
            key={c.id}
            onPress={() => setFilter(c.id)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={{
              backgroundColor: active ? color('accent/default') : color('bg/sunken'),
              borderRadius: radius.pill, paddingHorizontal: space.md, minHeight: 36, justifyContent: 'center',
            }}
          >
            <Text style={[type['type/caption'], { color: active ? color('accent/on-accent') : color('text/secondary') }]}>{c.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: color('bg/canvas') }]}>
      {TopBar}
      {Chips}

      {loading ? (
        <View style={{ flex: 1, paddingHorizontal: space.md, paddingTop: space.lg }}>
          <View style={{ backgroundColor: color('bg/surface'), borderRadius: radius.lg, padding: space.lg, gap: space.sm }}>
            <SkeletonBlock width={120} height={16} radius={radius.sm} />
            <SkeletonBlock height={48} radius={radius.md} />
            <SkeletonBlock height={52} radius={radius.md} />
            <SkeletonBlock height={52} radius={radius.md} />
          </View>
        </View>
      ) : loadError ? (
        <EmptyState
          icon={<WarningCircle size={32} color={color('semantic/danger')} weight="fill" />}
          title="Couldn’t load review"
          description="Something went wrong fetching your test review."
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
              reported={reported[q.question_id] ?? q.reported_by_me}
              onReport={() => setReportOpen(true)}
              onNote={() => setNoteOpen(true)}
            />
          </ScrollView>

          <View
            style={[
              styles.bottomBar,
              { backgroundColor: color('bg/surface'), borderTopColor: color('border/subtle'), borderTopWidth: 1, paddingHorizontal: space.md, paddingTop: space.sm, paddingBottom: space.sm + insets.bottom },
            ]}
          >
            {current > 0 ? <SecondaryButton label="Previous" onPress={() => go(current - 1)} /> : <View style={{ width: 100 }} />}
            <Pressable
              onPress={() => setPaletteOpen(true)}
              hitSlop={space.xs}
              accessibilityRole="button"
              accessibilityLabel="Review palette"
              style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' })}
            >
              <GridFour size={26} color={color('text/primary')} />
            </Pressable>
            <PrimaryButton label={atEnd ? 'Done' : 'Next'} onPress={() => (atEnd ? router.back() : go(Math.min(current + 1, items.length - 1)))} loading={loadingMore && current >= items.length - 1} />
          </View>

          <BottomSheet visible={paletteOpen} onClose={() => setPaletteOpen(false)} title="Review Palette">
            <View style={[styles.legendRow, { gap: space.md }]}>
              <LegendDot label={`Correct (${counts.c})`} fill={color('semantic/success')} />
              <LegendDot label={`Incorrect (${counts.w})`} fill={color('semantic/danger')} />
              <LegendDot label={`Unattempted (${counts.u})`} fill={color('bg/sunken')} border={color('border/strong')} />
            </View>
            <View style={[styles.paletteGrid, { marginTop: space.md, gap: space.sm }]}>
              {items.map((item, i) => {
                const st = statusOf(item);
                const isCurrent = i === current;
                return (
                  <Pressable
                    key={item.question_id}
                    onPress={() => { setPaletteOpen(false); go(i); }}
                    accessibilityRole="button"
                    accessibilityLabel={`Question ${item.position}, ${st}${isCurrent ? ', current' : ''}`}
                    style={{
                      width: 44, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
                      backgroundColor: st === 'correct' ? color('semantic/success') : st === 'incorrect' ? color('semantic/danger') : color('bg/sunken'),
                      borderWidth: isCurrent ? 2 : 1,
                      borderColor: isCurrent ? color('text/primary') : color('border/strong'),
                    }}
                  >
                    <Text style={[type['type/body-m-medium'], { color: st === 'unattempted' ? color('text/secondary') : color('text/inverse') }]}>{item.position}</Text>
                  </Pressable>
                );
              })}
            </View>
            {cursor ? (
              <TextButton label={loadingMore ? 'Loading…' : 'Load more'} onPress={() => void loadMore()} />
            ) : null}
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
    </SafeAreaView>
  );
}

function ReviewCard({
  q, media, note, reported, onReport, onNote,
}: { q: ReviewItem; media: MediaMap; note: string | null; reported: boolean; onReport: () => void; onNote: () => void }) {
  const { color, type, space, radius } = useTheme();
  const st = statusOf(q);
  const badge = {
    correct: { text: 'Correct', bg: color('semantic/success'), fg: color('text/inverse') },
    incorrect: { text: 'Incorrect', bg: color('semantic/danger'), fg: color('text/inverse') },
    unattempted: { text: 'Unattempted', bg: color('bg/sunken'), fg: color('text/secondary') },
  }[st];

  const stateOf = (letter: string): OptionState => {
    if (letter === q.correct_option) return q.selected_option === letter ? 'correct' : 'missed';
    return q.selected_option === letter ? 'wrong' : 'idle';
  };
  const opts: [string, string][] = [['A', q.option_a], ['B', q.option_b], ['C', q.option_c], ['D', q.option_d]];
  const meta = [q.question_meta.subject, q.question_meta.chapter, q.question_meta.difficulty].filter(Boolean) as string[];

  return (
    <View style={[{ backgroundColor: color('bg/surface'), borderRadius: radius.lg, padding: space.lg }, shadow()]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: space.sm }}>
        <Text style={[type['type/overline'], { color: color('text/tertiary'), flex: 1 }]}>QUESTION {q.position}</Text>
        {q.marked_for_review ? (
          <View accessible accessibilityLabel="Marked for review">
            <FlagPennant size={18} weight="fill" color={color('semantic/warning')} />
          </View>
        ) : null}
        <View style={{ backgroundColor: badge.bg, borderRadius: radius.pill, paddingHorizontal: space.sm, paddingVertical: 2, marginLeft: space.xs }}>
          <Text style={[type['type/caption'], { color: badge.fg }]}>{badge.text}</Text>
        </View>
      </View>

      {meta.length > 0 ? (
        <Text style={[type['type/caption'], { color: color('text/tertiary'), marginBottom: space.sm }]}>{meta.join(' · ')}</Text>
      ) : null}

      <RichContent value={q.question_text} format={q.content_format} media={media} variant="stem" />

      <View style={{ gap: space.sm, marginTop: space.md }}>
        {opts.map(([letter, val]) => (
          <OptionCard key={letter} letter={letter} value={val} format={q.content_format} media={media} state={stateOf(letter)} />
        ))}
      </View>

      {/* Stats row */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.md, marginTop: space.md }}>
        {q.time_spent_seconds != null ? (
          <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>You spent {formatClock(q.time_spent_seconds)}</Text>
        ) : null}
        {q.confidence ? <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>Confidence: {q.confidence}</Text> : null}
        {q.cohort_correct_pct != null ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Users size={14} color={color('text/tertiary')} />
            <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>{Math.round(q.cohort_correct_pct)}% of students got this right</Text>
          </View>
        ) : null}
      </View>

      {q.explanation ? (
        <View style={{ backgroundColor: color('bg/sunken'), borderRadius: radius.md, padding: space.md, marginTop: space.md }}>
          <Text style={[type['type/overline'], { color: color('text/tertiary'), marginBottom: 6 }]}>EXPLANATION</Text>
          <RichContent value={q.explanation} format={q.content_format} media={media} variant="explanation" />
        </View>
      ) : null}

      <View style={{ marginTop: space.md }}>
        <ExplanationThumbs questionId={q.question_id} value={q.my_rating ?? null} />
      </View>

      {note ? (
        <Pressable onPress={onNote} accessibilityRole="button" accessibilityLabel="Edit my note" style={{ backgroundColor: color('accent/tint'), borderRadius: radius.md, padding: space.md, marginTop: space.md }}>
          <Text style={[type['type/overline'], { color: color('text/tertiary'), marginBottom: 4 }]}>MY NOTE</Text>
          <Text style={[type['type/body-m'], { color: color('text/primary') }]}>{note}</Text>
        </Pressable>
      ) : null}

      {/* Actions */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: space.sm }}>
        <BookmarkButton questionId={q.question_id} />
        <Pressable onPress={onNote} accessibilityRole="button" accessibilityLabel={note ? 'Edit my note' : 'Add a note'} style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
          <NotePencil size={22} weight={note ? 'fill' : 'regular'} color={note ? color('accent/default') : color('text/primary')} />
        </Pressable>
        <View style={{ flex: 1 }} />
        <Pressable
          onPress={onReport}
          disabled={reported}
          accessibilityRole="button"
          accessibilityLabel={reported ? 'You reported this question' : 'Report a problem with this question'}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, paddingHorizontal: space.xs, opacity: reported ? 0.6 : 1 }}
        >
          <FlagBanner size={20} weight={reported ? 'fill' : 'regular'} color={color('text/secondary')} />
          <Text style={[type['type/caption'], { color: color('text/secondary') }]}>{reported ? 'Reported' : 'Report'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function LegendDot({ label, fill, border }: { label: string; fill: string; border?: string }) {
  const { color, type } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: fill, borderWidth: 1, borderColor: border ?? fill }} />
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
  bottomBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  legendRow: { flexDirection: 'row', flexWrap: 'wrap' },
  paletteGrid: { flexDirection: 'row', flexWrap: 'wrap' },
});
