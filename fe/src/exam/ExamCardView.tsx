import { Pressable, Text, View } from 'react-native';
import { Clock, Lock } from 'phosphor-react-native';
import { PrimaryButton, SecondaryButton } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { shadow } from '@/src/theme/elevation';
import type { ExamCard } from '@/src/api/exams';
import { cardAction, formatCountdown, KIND_LABEL, STYLE_LABEL } from './logic';

const when = (iso?: string) =>
  iso ? new Date(iso).toLocaleString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '';

/** One test on the Tests tab: what it is, when it runs, and the one thing to do next. */
export function ExamCardView({ card, now, onOpen, onRemind, onResult }: {
  card: ExamCard;
  now: number;
  onOpen: () => void;
  onRemind: () => void;
  onResult: () => void;
}) {
  const { color, type, space, radius } = useTheme();
  const action = cardAction(card);
  const opens = card.opens_at ? new Date(card.opens_at).getTime() : null;
  const ends = card.ends_at ? new Date(card.ends_at).getTime() : null;
  const lastStart = card.last_start_at ? new Date(card.last_start_at).getTime() : null;

  let status: { text: string; tone: 'semantic/success' | 'semantic/warning' | 'text/tertiary' | 'accent/default' } | null = null;
  if (card.phase === 'upcoming' && opens) status = { text: `Starts in ${formatCountdown(opens - now)}`, tone: 'accent/default' };
  else if (card.phase === 'live' && ends) {
    const canStart = lastStart != null && now <= lastStart;
    status = card.my_attempt?.status === 'in_progress'
      ? { text: `In progress, ends in ${formatCountdown(ends - now)}`, tone: 'semantic/warning' }
      : canStart ? { text: `Live now. You can still start for ${formatCountdown((lastStart ?? now) - now)}`, tone: 'semantic/success' }
        : { text: 'Live now. Late entry is closed', tone: 'semantic/warning' };
  } else if (card.phase === 'ended' && card.delivery === 'live') status = { text: 'Live event ended. Take it as practice', tone: 'text/tertiary' };
  if (card.my_attempt?.status === 'submitted' && !card.results_released && card.results_at) {
    status = { text: `Submitted. Results ${when(card.results_at)}`, tone: 'semantic/warning' };
  }

  const meta = [
    KIND_LABEL[card.kind],
    card.exam_year ? String(card.exam_year) : null,
    card.duration_minutes ? `${card.duration_minutes} min` : 'Untimed',
    `${card.total_questions} questions`,
  ].filter(Boolean).join(' · ');

  return (
    <Pressable
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={`${card.title}. ${meta}. ${status?.text ?? ''}`}
      style={({ pressed }) => [{ backgroundColor: color('bg/surface'), borderRadius: radius.lg, padding: space.md, gap: space.xs, opacity: pressed ? 0.95 : 1 }, shadow()]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
        <View style={{ backgroundColor: color('accent/tint'), borderRadius: radius.pill, paddingHorizontal: space.sm, paddingVertical: 2 }}>
          <Text style={[type['type/caption'], { color: color('accent/default') }]}>{STYLE_LABEL[card.exam_style]}</Text>
        </View>
        {card.delivery === 'live' ? (
          <View style={{ backgroundColor: color('semantic/warning-tint'), borderRadius: radius.pill, paddingHorizontal: space.sm, paddingVertical: 2 }}>
            <Text style={[type['type/caption'], { color: color('semantic/warning') }]}>Live event</Text>
          </View>
        ) : null}
        {card.requires_subscription ? <Lock size={14} color={color('text/tertiary')} /> : null}
      </View>
      <Text style={[type['type/h3'], { color: color('text/primary') }]}>{card.title}</Text>
      {card.series ? <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>{card.series.title}</Text> : null}
      <Text style={[type['type/caption'], { color: color('text/secondary') }]}>{meta}</Text>
      {card.delivery === 'live' && card.opens_at ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Clock size={14} color={color('text/tertiary')} />
          <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>{when(card.opens_at)}</Text>
        </View>
      ) : null}
      {status ? <Text style={[type['type/body-m-medium'], { color: color(status.tone) }]}>{status.text}</Text> : null}
      <View style={{ marginTop: space.xs }}>
        {action === 'remind' ? (
          <SecondaryButton label="Remind me" onPress={onRemind} />
        ) : action === 'reminded' ? (
          <SecondaryButton label="Reminder on. Tap to turn off" onPress={onRemind} />
        ) : action === 'result' ? (
          <SecondaryButton label={card.results_released ? 'View result' : 'Submitted'} onPress={card.results_released ? onResult : onOpen} />
        ) : (
          <PrimaryButton label={action === 'resume' ? 'Resume' : action === 'practice' ? 'Take it as practice' : 'Start'} onPress={onOpen} />
        )}
      </View>
    </Pressable>
  );
}
