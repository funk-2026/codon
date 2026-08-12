import { useEffect } from 'react';
import { DimensionValue, StyleProp, ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useTheme } from '@/src/theme/ThemeProvider';

export type SkeletonBlockProps = {
  width?: DimensionValue;
  height?: DimensionValue;
  radius?: number;
  style?: StyleProp<ViewStyle>;
};

export function SkeletonBlock({ width = '100%', height = 16, radius, style }: SkeletonBlockProps) {
  const { color, radius: radiusTokens } = useTheme();
  const progress = useSharedValue(0.4);

  useEffect(() => {
    progress.value = withRepeat(
      withTiming(1, { duration: 900, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, [progress]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: progress.value }));

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius: radius ?? radiusTokens.sm,
          backgroundColor: color('bg/sunken'),
        },
        animatedStyle,
        style,
      ]}
    />
  );
}
