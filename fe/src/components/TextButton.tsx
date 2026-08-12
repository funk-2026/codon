import { Pressable, StyleProp, StyleSheet, Text, ViewStyle } from 'react-native';
import { useTheme } from '@/src/theme/ThemeProvider';

export type TextButtonProps = {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function TextButton({ label, onPress, disabled, style }: TextButtonProps) {
  const { color, type, space } = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={space.xs}
      style={({ pressed }) => [
        styles.base,
        { opacity: disabled ? 0.6 : pressed ? 0.6 : 1 },
        style,
      ]}
    >
      <Text style={[type['type/body-m-medium'], { color: color('accent/default') }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center' },
});
