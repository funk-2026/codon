import { ScrollView, Text, View } from 'react-native';
import RNSvg, { Circle } from 'react-native-svg';
import { Check } from 'phosphor-react-native';
import { PrimaryButton, SecondaryButton } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';

const SIZE = 132;
const STROKE = 12;

type Props = {
  revise: boolean;
  total: number;
  /** Cards rated Good or Easy (study mode only). */
  knew: number;
  again: number;
  onAgain: () => void;
  onRevise?: () => void;
  onDone: () => void;
};

export function StudyComplete({ revise, total, knew, again, onAgain, onRevise, onDone }: Props) {
  const { color, type, space } = useTheme();
  const r = (SIZE - STROKE) / 2;
  const circ = 2 * Math.PI * r;
  const pct = revise || total === 0 ? 1 : knew / total;
  return (
    <ScrollView contentContainerStyle={{ padding: space.lg, alignItems: 'center', gap: space.md, flexGrow: 1, justifyContent: 'center' }}>
      <View style={{ width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' }}>
        <RNSvg width={SIZE} height={SIZE} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
          <Circle cx={SIZE / 2} cy={SIZE / 2} r={r} stroke={color('bg/sunken')} strokeWidth={STROKE} fill="none" />
          <Circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={r}
            stroke={color('semantic/success')}
            strokeWidth={STROKE}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${circ * pct} ${circ}`}
          />
        </RNSvg>
        {revise ? (
          <Check size={48} weight="bold" color={color('semantic/success')} />
        ) : (
          <Text style={[type['type/numeral-display'], { color: color('text/primary'), fontSize: 34 }]}>{Math.round(pct * 100)}%</Text>
        )}
      </View>
      <Text style={[type['type/h1'], { color: color('text/primary') }]}>{revise ? 'Revision complete' : 'Nice work'}</Text>
      <Text style={[type['type/body-m'], { color: color('text/secondary'), textAlign: 'center' }]}>
        {revise
          ? `You went through ${total} card${total === 1 ? '' : 's'}.`
          : `${total} card${total === 1 ? '' : 's'} reviewed · ${knew} you knew${again > 0 ? ` · ${again} to see again soon` : ''}.`}
      </Text>
      <View style={{ alignSelf: 'stretch', gap: space.sm, marginTop: space.sm }}>
        <PrimaryButton label={revise ? 'Revise again' : 'Study more'} onPress={onAgain} />
        {onRevise ? <SecondaryButton label="Revise all cards" onPress={onRevise} /> : null}
        <SecondaryButton label="Done" onPress={onDone} />
      </View>
    </ScrollView>
  );
}
