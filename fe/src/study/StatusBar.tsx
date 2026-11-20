import { View } from 'react-native';
import { useTheme } from '@/src/theme/ThemeProvider';
import { STATUS_TONE, type StatusCounts } from './logic';

/** One thin bar split by status: green confident, amber to revise, red yet to read. Empty when there are no topics. */
export function StatusBar({ counts }: { counts: StatusCounts }) {
  const { color, radius } = useTheme();
  const total = counts.yet_to_read + counts.yet_to_revise + counts.confident;
  if (total === 0) return null;
  const order = ['confident', 'yet_to_revise', 'yet_to_read'] as const;
  return (
    <View
      accessibilityLabel={`${counts.confident} confident, ${counts.yet_to_revise} to revise, ${counts.yet_to_read} yet to read`}
      style={{ flexDirection: 'row', height: 6, borderRadius: radius.pill, overflow: 'hidden', backgroundColor: color('bg/sunken') }}
    >
      {order.map((k) => (counts[k] > 0 ? <View key={k} style={{ flex: counts[k], backgroundColor: color(STATUS_TONE[k]), opacity: k === 'yet_to_read' ? 0.35 : 1 }} /> : null))}
    </View>
  );
}
