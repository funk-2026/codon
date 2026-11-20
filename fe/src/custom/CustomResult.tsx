import { Pressable, ScrollView, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { CaretLeft } from 'phosphor-react-native';
import { PrimaryButton, TextButton } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { shadow } from '@/src/theme/elevation';
import { CodeCard } from './CodeCard';

/** The end of a custom module: a verdict, "X out of Y correct", the percentage ring, REVIEW, Discard and the code. No rank, percentile or leaderboard here. */
export function CustomResult({ title, correct, total, percent, code, onReview, onDiscard, onBack }: { title: string; correct: number; total: number; percent: number; code?: string; onReview: () => void; onDiscard: () => void; onBack: () => void }) {
  const { color, type, space, radius } = useTheme();
  const verdict = percent >= 85 ? 'Excellent work!' : percent >= 60 ? 'Well done!' : percent >= 35 ? 'Keep going!' : 'Needs improvement!';
  const R = 70;
  const C = 2 * Math.PI * R;
  return (
    <ScrollView contentContainerStyle={{ padding: space.md, gap: space.md, paddingBottom: space['3xl'], alignItems: 'stretch' }} showsVerticalScrollIndicator={false}>
      <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel="Close" style={{ minHeight: 44, justifyContent: 'center' }}>
        <CaretLeft size={24} color={color('text/primary')} />
      </Pressable>
      <View style={{ alignItems: 'center', gap: space.xs }}>
        <Text style={[type['type/h1'], { color: color('text/primary'), textAlign: 'center' }]}>{verdict}</Text>
        <Text style={[type['type/body-m'], { color: color('text/secondary') }]}>You got {correct} out of {total} questions correct</Text>
        <View style={{ width: 170, height: 170, alignItems: 'center', justifyContent: 'center', marginTop: space.sm }} accessible accessibilityLabel={`${percent} percent correct`}>
          <Svg width={170} height={170} style={{ position: 'absolute' }}>
            <Circle cx={85} cy={85} r={R} stroke={color('bg/sunken')} strokeWidth={12} fill="none" />
            <Circle cx={85} cy={85} r={R} stroke={color('semantic/success')} strokeWidth={12} fill="none" strokeDasharray={C} strokeDashoffset={C * (1 - Math.max(0, Math.min(100, percent)) / 100)} strokeLinecap="round" rotation={-90} origin="85,85" />
          </Svg>
          <Text style={[type['type/display'], { color: color('text/primary') }]}>{percent}%</Text>
          <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>Correct</Text>
        </View>
      </View>
      <View style={[{ backgroundColor: color('bg/surface'), borderRadius: radius.lg, padding: space.md, flexDirection: 'row', alignItems: 'center', gap: space.sm }, shadow()]}>
        <View style={{ flex: 1 }}>
          <Text style={[type['type/h3'], { color: color('text/primary') }]} numberOfLines={1}>{title}</Text>
          <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>{total} MCQs · Review your answers</Text>
        </View>
        <View style={{ width: 120 }}><PrimaryButton label="Review" onPress={onReview} /></View>
      </View>
      <TextButton label="Discard and create a new Custom Module" onPress={onDiscard} />
      {code ? <CodeCard code={code} /> : null}
    </ScrollView>
  );
}
