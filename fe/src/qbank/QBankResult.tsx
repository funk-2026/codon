import { Pressable, ScrollView, Text, View } from 'react-native';
import Svg, { Path, Line } from 'react-native-svg';
import { CaretLeft, CheckCircle } from 'phosphor-react-native';
import { PrimaryButton } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { shadow } from '@/src/theme/elevation';

export type QBankResultProps = {
  title: string;
  subject?: string;
  completedOn?: string;
  mcqs: number;
  correct: number;
  wrong: number;
  skipped: number;
  /** Where the student stands among peers, 0 to 100, or undefined while there are too few peers. */
  betterThan?: number;
  percent: number;
  solved?: number;
  total?: number;
  bookmarks: number;
  onReview: () => void;
  onBack: () => void;
  onBookmarks: () => void;
};

/** A bell curve with a marker where the student sits. Drawn only when there are enough peers to place them. */
function Bell({ at, text }: { at: number; text: string }) {
  const { color } = useTheme();
  const W = 240;
  const H = 90;
  const pts = Array.from({ length: 41 }, (_, i) => {
    const x = (i / 40) * W;
    const z = (i / 40 - 0.5) * 6;
    return `${i === 0 ? 'M' : 'L'}${x},${H - 6 - Math.exp(-(z * z) / 2) * (H - 16)}`;
  }).join(' ');
  const mx = (Math.max(2, Math.min(98, at)) / 100) * W;
  return (
    <Svg width={W} height={H} accessibilityLabel={text}>
      <Path d={pts} stroke={color('accent/default')} strokeWidth={2} fill="none" />
      <Line x1={mx} x2={mx} y1={8} y2={H - 6} stroke={color('semantic/success')} strokeWidth={2} strokeDasharray="4 3" />
      <Line x1={0} x2={W} y1={H - 6} y2={H - 6} stroke={color('border/strong')} strokeWidth={1} />
    </Svg>
  );
}

/** The QBank module result: modules solved, a peer comparison, a correct / wrong / skipped bar, REVIEW and the bookmarks count. */
export function QBankResult(p: QBankResultProps) {
  const { color, type, space, radius } = useTheme();
  const n = Math.max(1, p.correct + p.wrong + p.skipped);
  const pct = (v: number) => Math.round((v * 100) / n);
  return (
    <ScrollView contentContainerStyle={{ padding: space.md, gap: space.md, paddingBottom: space['3xl'] }} showsVerticalScrollIndicator={false}>
      <Pressable onPress={p.onBack} accessibilityRole="button" accessibilityLabel="Back" style={{ minHeight: 44, justifyContent: 'center' }}>
        <CaretLeft size={24} color={color('text/primary')} />
      </Pressable>
      <View>
        <Text style={[type['type/h1'], { color: color('text/primary') }]}>{p.title}</Text>
        {p.subject ? <Text style={[type['type/body-m'], { color: color('accent/default') }]}>{p.subject}</Text> : null}
        {p.completedOn ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
            <CheckCircle size={18} color={color('semantic/success')} weight="fill" />
            <Text style={[type['type/caption'], { color: color('text/secondary') }]}>Completed on {p.completedOn}</Text>
          </View>
        ) : null}
        {p.solved != null && p.total ? <Text style={[type['type/caption'], { color: color('text/tertiary'), marginTop: 2 }]}>{p.solved} of {p.total} modules solved in this subject</Text> : null}
      </View>

      <View style={[{ backgroundColor: color('bg/surface'), borderRadius: radius.lg, padding: space.md, flexDirection: 'row', alignItems: 'center', gap: space.sm }, shadow()]}>
        <View style={{ flex: 1 }}>
          <Text style={[type['type/h2'], { color: color('text/primary') }]}>{p.mcqs} MCQs</Text>
          <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>Review your answers</Text>
        </View>
        <View style={{ width: 130 }}><PrimaryButton label="REVIEW" onPress={p.onReview} /></View>
      </View>

      <Pressable onPress={p.onBookmarks} accessibilityRole="button" style={{ minHeight: 44, justifyContent: 'center' }}>
        <Text style={[type['type/body-m-medium'], { color: color('accent/default') }]}>{p.bookmarks} Bookmark{p.bookmarks === 1 ? '' : 's'} →</Text>
      </Pressable>

      <View style={[{ backgroundColor: color('bg/surface'), borderRadius: radius.lg, padding: space.md, alignItems: 'center', gap: space.xs }, shadow()]}>
        <Text style={[type['type/body-m'], { color: color('text/secondary') }]}>You performed</Text>
        <Text style={[type['type/display'], { color: color('accent/default') }]}>{p.percent}%</Text>
        {p.betterThan != null ? (
          <>
            <Bell at={p.betterThan} text={`You performed better than ${p.betterThan} percent of your peers`} />
            <Text style={[type['type/body-m-medium'], { color: color('text/primary') }]}>better than {p.betterThan}% of your peers</Text>
          </>
        ) : (
          <Text style={[type['type/caption'], { color: color('text/tertiary'), textAlign: 'center' }]}>The comparison with peers shows once more students have solved this module.</Text>
        )}
      </View>

      <View style={{ gap: 6 }}>
        <View style={{ flexDirection: 'row', height: 14, borderRadius: 7, overflow: 'hidden', backgroundColor: color('bg/sunken') }}>
          <View style={{ flex: p.correct, backgroundColor: color('semantic/success') }} />
          <View style={{ flex: p.wrong, backgroundColor: color('semantic/danger') }} />
          <View style={{ flex: p.skipped, backgroundColor: color('text/tertiary') }} />
        </View>
        <Text style={[type['type/caption'], { color: color('text/secondary') }]} accessibilityLabel={`${p.correct} correct, ${p.wrong} wrong, ${p.skipped} skipped`}>
          <Text style={{ color: color('semantic/success') }}>{p.correct} correct ({pct(p.correct)}%)</Text>
          {'   '}
          <Text style={{ color: color('semantic/danger') }}>{p.wrong} wrong ({pct(p.wrong)}%)</Text>
          {'   '}
          {p.skipped} skipped ({pct(p.skipped)}%)
        </Text>
      </View>
    </ScrollView>
  );
}
