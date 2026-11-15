import { Pressable, Text, View } from 'react-native';
import { CaretRight, Clock, Lock } from 'phosphor-react-native';
import { PrimaryButton, SecondaryButton } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { shadow } from '@/src/theme/elevation';
import { useHasSubscription } from '@/src/queries/curriculum';
import type { ExamCard } from '@/src/api/exams';
import { formatCountdown, KIND_LABEL, type NextUp, type SeriesProgress } from './logic';

const when = (iso?: string) =>
  iso ? new Date(iso).toLocaleString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '';
const meta = (c: ExamCard) => [c.duration_minutes ? `${c.duration_minutes} min` : 'No time limit', `${c.total_questions} Qs`].join(' · ');

/** The one thing to do now. */
export function NextUpCard({ next, now, onOpen, onRemind }: { next: NextUp; now: number; onOpen: (c: ExamCard) => void; onRemind: (c: ExamCard) => void }) {
  const { color, type, space, radius } = useTheme();
  if (next.kind === 'none') return null;
  const c = next.card;
  const ends = c.ends_at ? new Date(c.ends_at).getTime() : null;
  const opens = c.opens_at ? new Date(c.opens_at).getTime() : null;
  const head = { resume: 'RESUME', live: 'LIVE NOW', upcoming: 'NEXT LIVE TEST', first: 'START HERE' }[next.kind];
  const line =
    next.kind === 'resume' ? (ends ? `Ends in ${formatCountdown(ends - now)}` : 'Pick up where you left off')
    : next.kind === 'live' ? (ends ? `Ends in ${formatCountdown(ends - now)}. You can still start.` : 'Open for entry')
    : next.kind === 'upcoming' ? (opens ? `Starts in ${formatCountdown(opens - now)} · ${when(c.opens_at)}` : '')
    : 'Take a full mock first. It sets your baseline, and every test after it shows your progress.';
  return (
    <View style={[{ backgroundColor: color('accent/tint'), borderRadius: radius.lg, padding: space.md, gap: space.xs }, shadow()]}>
      <Text style={[type['type/overline'], { color: color('accent/default') }]}>{head}</Text>
      <Text style={[type['type/h2'], { color: color('text/primary') }]}>{c.title}</Text>
      <Text style={[type['type/caption'], { color: color('text/secondary') }]}>{[KIND_LABEL[c.kind], meta(c)].join(' · ')}</Text>
      {line ? <Text style={[type['type/body-m-medium'], { color: color('text/primary') }]}>{line}</Text> : null}
      <View style={{ marginTop: space.xs }}>
        {next.kind === 'upcoming' ? (
          <SecondaryButton label={c.registered ? 'Reminder on. Tap to turn off' : 'Remind me'} onPress={() => onRemind(c)} />
        ) : (
          <PrimaryButton label={next.kind === 'resume' ? 'Resume' : 'Start'} onPress={() => onOpen(c)} />
        )}
      </View>
    </View>
  );
}

/** A short card for a horizontal row: what it is, and one status. The whole card is the button. */
export function CompactTestCard({ card, onOpen, width = 200 }: { card: ExamCard; onOpen: () => void; width?: number }) {
  const { color, type, space, radius } = useTheme();
  const hasSub = useHasSubscription();
  const locked = card.requires_subscription && !hasSub && !card.my_attempt;
  const taken = card.my_attempt?.status === 'submitted';
  let chip = { text: 'New', tone: 'accent/default' as const };
  if (card.my_attempt?.status === 'in_progress') chip = { text: 'In progress', tone: 'semantic/warning' as never };
  else if (taken) chip = { text: card.results_released ? 'Taken' : 'Result pending', tone: card.results_released ? ('semantic/success' as never) : ('semantic/warning' as never) };
  else if (card.phase === 'upcoming') chip = { text: when(card.opens_at), tone: 'accent/default' };
  else if (card.phase === 'live') chip = { text: 'Live now', tone: 'semantic/success' as never };
  return (
    <Pressable
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={`${card.title}. ${meta(card)}. ${chip.text}${locked ? '. Needs a plan' : ''}`}
      style={({ pressed }) => [{ width, backgroundColor: color('bg/surface'), borderRadius: radius.lg, padding: space.sm, gap: space['2xs'], opacity: pressed ? 0.95 : 1 }, shadow()]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>{card.exam_year ? `${KIND_LABEL[card.kind]} · ${card.exam_year}` : KIND_LABEL[card.kind]}</Text>
        {locked ? <Lock size={14} color={color('text/tertiary')} /> : null}
      </View>
      <Text numberOfLines={2} style={[type['type/body-m-medium'], { color: color('text/primary'), minHeight: 40 }]}>{card.title}</Text>
      <Text style={[type['type/caption'], { color: color('text/secondary') }]}>{meta(card)}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
        {card.phase === 'upcoming' ? <Clock size={12} color={color(chip.tone)} /> : null}
        <Text numberOfLines={1} style={[type['type/caption'], { color: color(chip.tone), fontWeight: '600' }]}>{chip.text}</Text>
      </View>
    </Pressable>
  );
}

/** "NEET Mock Series · 3 of 10 done": a series reads as one collection with progress. */
export function SeriesCard({ series, onOpen }: { series: SeriesProgress; onOpen: () => void }) {
  const { color, type, space, radius } = useTheme();
  const pct = series.total ? (series.done / series.total) * 100 : 0;
  return (
    <Pressable
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={`${series.title}, ${series.done} of ${series.total} done`}
      style={({ pressed }) => [{ backgroundColor: color('bg/surface'), borderRadius: radius.lg, padding: space.md, gap: space.xs, opacity: pressed ? 0.95 : 1 }, shadow()]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Text style={[type['type/h3'], { color: color('text/primary'), flex: 1 }]} numberOfLines={1}>{series.title}</Text>
        <CaretRight size={18} color={color('text/tertiary')} />
      </View>
      <View style={{ height: 6, borderRadius: 3, backgroundColor: color('bg/sunken') }}>
        <View style={{ width: `${pct}%`, height: 6, borderRadius: 3, backgroundColor: color('accent/default') }} />
      </View>
      <Text style={[type['type/caption'], { color: color('text/secondary') }]}>
        {series.done} of {series.total} done{series.next ? ` · Next: ${series.next.title}` : ''}
      </Text>
    </Pressable>
  );
}
