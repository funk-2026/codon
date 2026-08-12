import { ActivityIndicator, Pressable, StyleProp, StyleSheet, Text, ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '@/src/theme/ThemeProvider';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type SecondaryButtonProps = {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'default' | 'danger';
  style?: StyleProp<ViewStyle>;
};

export function SecondaryButton({
  label,
  onPress,
  disabled,
  loading,
  variant = 'default',
  style,
}: SecondaryButtonProps) {
  const { color, type, radius, space } = useTheme();
  const pressed = useSharedValue(0);
  const nonInteractive = disabled || loading;
  const tint = variant === 'danger' ? color('semantic/danger') : color('text/primary');
  const borderColor = variant === 'danger' ? color('semantic/danger') : color('border/strong');

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: withTiming(pressed.value ? 0.97 : 1, { duration: 90 }) }],
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
          borderWidth: 1.5,
          borderColor,
          paddingVertical: space.sm,
          paddingHorizontal: space.lg,
          opacity: disabled ? 0.6 : 1,
        },
        animatedStyle,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={tint} size="small" />
      ) : (
        <Text style={[type['type/body-m-medium'], { color: tint }]}>{label}</Text>
      )}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    backgroundColor: 'transparent',
  },
});
