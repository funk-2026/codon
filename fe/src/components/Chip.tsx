import { Pressable, StyleProp, Text, ViewStyle } from 'react-native';
import { useTheme } from '@/src/theme/ThemeProvider';

export type ChipProps = {
  label: string;
  /** Selected chips get the accent tint and border (filters, tabs, pickers). */
  selected?: boolean;
  onPress?: () => void;
  size?: 'sm' | 'md';
  /** Static label with no press handler (status, tag). */
  tone?: 'neutral' | 'accent' | 'success' | 'warning' | 'danger';
  style?: StyleProp<ViewStyle>;
};

const TONES = {
  neutral: ['bg/sunken', 'text/secondary'],
  accent: ['accent/tint', 'accent/default'],
  success: ['semantic/success-tint', 'semantic/success'],
  warning: ['semantic/warning-tint', 'semantic/warning'],
  danger: ['semantic/danger-tint', 'semantic/danger'],
} as const;

/** One pill for filters, tabs and tags, so selected/unselected look the same everywhere. */
export function Chip({ label, selected, onPress, size = 'md', tone, style }: ChipProps) {
  const { color, type, space, radius } = useTheme();
  const minHeight = size === 'sm' ? 32 : 40;

  if (tone && !onPress) {
    const [bg, fg] = TONES[tone];
    return (
      <Pressable
        disabled
        style={[{ borderRadius: radius.pill, paddingHorizontal: space.sm, paddingVertical: 4, backgroundColor: color(bg) }, style]}
      >
        <Text style={[type['type/caption'], { color: color(fg) }]}>{label}</Text>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      style={[
        {
          minHeight,
          paddingHorizontal: space.md,
          borderRadius: radius.pill,
          justifyContent: 'center',
          backgroundColor: selected ? color('accent/tint') : color('bg/surface'),
          borderWidth: 1,
          borderColor: selected ? color('accent/default') : color('border/subtle'),
        },
        style,
      ]}
    >
      <Text
        style={[
          size === 'sm' ? type['type/caption'] : type['type/body-m-medium'],
          { color: selected ? color('accent/default') : color('text/primary') },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}
