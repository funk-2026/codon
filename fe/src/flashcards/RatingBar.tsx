import { Pressable, Text, View } from 'react-native';
import { useTheme } from '@/src/theme/ThemeProvider';
import type { ReviewResult } from '@/src/api/discover';

/** Three choices: Hard is left out of the UI on purpose (the API still accepts it). */
export const RATINGS: { key: Extract<ReviewResult, 'again' | 'good' | 'easy'>; label: string; hint: string; bg: 'semantic/danger-tint' | 'semantic/success-tint' | 'accent/tint'; fg: 'semantic/danger' | 'semantic/success' | 'accent/default' }[] = [
  { key: 'again', label: 'Again', hint: '10 min', bg: 'semantic/danger-tint', fg: 'semantic/danger' },
  { key: 'good', label: 'Good', hint: 'Tomorrow', bg: 'semantic/success-tint', fg: 'semantic/success' },
  { key: 'easy', label: 'Easy', hint: '3 days', bg: 'accent/tint', fg: 'accent/default' },
];

export function RatingBar({ onRate, disabled }: { onRate: (r: ReviewResult) => void; disabled?: boolean }) {
  const { color, type, space, radius } = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: space.sm }}>
      {RATINGS.map((r) => (
        <Pressable
          key={r.key}
          onPress={() => onRate(r.key)}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel={`${r.label}, see again ${r.hint.toLowerCase()}`}
          style={({ pressed }) => ({
            flex: 1,
            minHeight: 64,
            borderRadius: radius.lg,
            backgroundColor: color(r.bg),
            alignItems: 'center',
            justifyContent: 'center',
            gap: 2,
            opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
            transform: [{ scale: pressed ? 0.97 : 1 }],
          })}
        >
          <Text style={[type['type/h3'], { color: color(r.fg) }]}>{r.label}</Text>
          <Text style={[type['type/caption'], { color: color(r.fg), opacity: 0.8 }]}>{r.hint}</Text>
        </Pressable>
      ))}
    </View>
  );
}
