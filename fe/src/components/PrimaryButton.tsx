import { ActivityIndicator, Pressable, StyleProp, StyleSheet, Text, ViewStyle } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '@/src/theme/ThemeProvider';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type PrimaryButtonProps = {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function PrimaryButton({ label, onPress, disabled, loading, style }: PrimaryButtonProps) {
  const { color: colorFn, type, radius, space } = useTheme();
  const pressed = useSharedValue(0);
  const nonInteractive = disabled || loading;
  const accentDefault = colorFn('accent/default');
  const accentPressed = colorFn('accent/pressed');
  const onAccent = colorFn('accent/on-accent');

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: withTiming(pressed.value ? 0.97 : 1, { duration: 90 }) }],
    backgroundColor: interpolateColor(
      pressed.value,
      [0, 1],
      [accentDefault, accentPressed]
    ),
  }));

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!nonInteractive, busy: !!loading }}
      disabled={nonInteractive}
      onPress={onPress}
      onPressIn={() => (pressed.value = 1)}
      onPressOut={() => (pressed.value = 0)}
      style={[
        styles.base,
        {
          borderRadius: radius.pill,
          paddingVertical: space.sm,
          paddingHorizontal: space.lg,
          opacity: disabled ? 0.6 : 1,
        },
        animatedStyle,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={onAccent} size="small" />
      ) : (
        <Text style={[type['type/body-m-medium'], { color: onAccent }]}>
          {label}
        </Text>
      )}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center', minHeight: 44 },
});
