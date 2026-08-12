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
  const { color, type, radius, space } = useTheme();
  const pressed = useSharedValue(0);
  const nonInteractive = disabled || loading;

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: withTiming(pressed.value ? 0.97 : 1, { duration: 90 }) }],
    backgroundColor: interpolateColor(
      pressed.value,
      [0, 1],
      [color('accent/default'), color('accent/pressed')]
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
        <ActivityIndicator color={color('accent/on-accent')} size="small" />
      ) : (
        <Text style={[type['type/body-m-medium'], { color: color('accent/on-accent') }]}>
          {label}
        </Text>
      )}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center', minHeight: 44 },
});
