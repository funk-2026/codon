import { Text, View } from 'react-native';
import { useTheme } from '@/src/theme/ThemeProvider';
import { weekDays, type AttemptLike } from './weekDays';


/** Seven dots for the past week: filled when you practised that day. */
export function WeekStrip({ attempts }: { attempts: AttemptLike[] }) {
  const { color, type, space } = useTheme();
  const days = weekDays(attempts);
  return (
    <View
      accessible
      accessibilityLabel={`Practised on ${days.filter((d) => d.done).length} of the last 7 days`}
      style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: space.sm }}
    >
      {days.map((d, i) => (
        <View key={i} style={{ alignItems: 'center', gap: space['2xs'] }}>
          <View
            style={{
              width: 28,
              height: 28,
              borderRadius: 14,
              backgroundColor: d.done ? color('accent/default') : color('bg/sunken'),
              borderWidth: d.today ? 2 : 0,
              borderColor: color('accent/default'),
            }}
          />
          <Text style={[type['type/caption'], { color: d.today ? color('text/primary') : color('text/tertiary') }]}>{d.label}</Text>
        </View>
      ))}
    </View>
  );
}
