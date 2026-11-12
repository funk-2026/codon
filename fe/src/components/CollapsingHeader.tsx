import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/src/theme/ThemeProvider';

/** Height of the slim strip the header shrinks to (excluding the status-bar inset). */
const COMPACT_HEIGHT = 40;

/** Scrolling past this offset collapses the header; coming back above EXPAND_AT expands it. */
const COLLAPSE_AT = 24;
const EXPAND_AT = 6;
const ANIM = { duration: 220, easing: Easing.out(Easing.cubic) };

/**
 * Drives a header that is large at the top of a list and shrinks into a slim strip once
 * the list is scrolled past a small threshold (and expands again near the top).
 *
 * The change is a short timed animation, not tied to scroll distance, so it always ends in
 * a clean state, even on short lists that can barely scroll. The two thresholds differ
 * (hysteresis) so it never flickers around the boundary.
 *
 * Usage: attach `onScroll` (and `scrollEventThrottle={16}`) to an Animated list, give the
 * list `contentContainerStyle={{ paddingTop: maxHeight }}`, and render <CollapsingHeader />.
 */
export function useCollapsingHeader(estimatedContentHeight = 72) {
  const { space } = useTheme();
  const insets = useSafeAreaInsets();
  /** 0 = expanded, 1 = collapsed strip. */
  const progress = useSharedValue(0);
  const target = useSharedValue(0);
  const [contentHeight, setContentHeight] = useState(estimatedContentHeight);

  const onScroll = useAnimatedScrollHandler((e) => {
    const y = e.contentOffset.y;
    if (target.value === 0 && y > COLLAPSE_AT) {
      target.value = 1;
      progress.value = withTiming(1, ANIM);
    } else if (target.value === 1 && y < EXPAND_AT) {
      target.value = 0;
      progress.value = withTiming(0, ANIM);
    }
  });

  const maxHeight = insets.top + space.md + contentHeight + space.lg;
  const minHeight = insets.top + space.sm + COMPACT_HEIGHT + space.sm;

  return { progress, onScroll, contentHeight, setContentHeight, maxHeight, minHeight };
}

export type CollapsingHeaderState = ReturnType<typeof useCollapsingHeader>;

export type CollapsingHeaderProps = {
  state: CollapsingHeaderState;
  /** Full content shown at the top of the list. */
  expanded: React.ReactNode;
  /** Slim content (one line) shown once scrolled. */
  compact: React.ReactNode;
  /** Band colour; defaults to the ice-blue `header/bg`. */
  background?: string;
};

export function CollapsingHeader({ state, expanded, compact, background }: CollapsingHeaderProps) {
  const { color, radius, space } = useTheme();
  const insets = useSafeAreaInsets();
  const { progress, maxHeight, minHeight, contentHeight, setContentHeight } = state;
  const corner = radius.lg;

  const containerStyle = useAnimatedStyle(() => ({
    height: interpolate(progress.value, [0, 1], [maxHeight, minHeight], Extrapolation.CLAMP),
    borderBottomLeftRadius: interpolate(progress.value, [0, 1], [corner, 0], Extrapolation.CLAMP),
    borderBottomRightRadius: interpolate(progress.value, [0, 1], [corner, 0], Extrapolation.CLAMP),
    shadowOpacity: interpolate(progress.value, [0.5, 1], [0, 0.12], Extrapolation.CLAMP),
  }));

  const expandedStyle = useAnimatedStyle(() => {
    const opacity = interpolate(progress.value, [0, 0.5], [1, 0], Extrapolation.CLAMP);
    return {
      opacity,
      transform: [{ translateY: interpolate(progress.value, [0, 1], [0, -10], Extrapolation.CLAMP) }],
      pointerEvents: (opacity > 0.5 ? 'auto' : 'none') as 'auto' | 'none',
    };
  });

  const compactStyle = useAnimatedStyle(() => {
    const opacity = interpolate(progress.value, [0.5, 1], [0, 1], Extrapolation.CLAMP);
    return {
      opacity,
      transform: [{ translateY: interpolate(progress.value, [0.5, 1], [8, 0], Extrapolation.CLAMP) }],
      pointerEvents: (opacity > 0.5 ? 'auto' : 'none') as 'auto' | 'none',
    };
  });

  return (
    <Animated.View
      style={[
        styles.base,
        {
          backgroundColor: background ?? color('header/bg'),
          shadowColor: color('accent/default'),
        },
        containerStyle,
      ]}
    >
      <Animated.View
        style={[styles.layer, { top: insets.top + space.md, left: space.md, right: space.md }, expandedStyle]}
        onLayout={(e) => {
          const h = e.nativeEvent.layout.height;
          if (h > 0 && Math.abs(h - contentHeight) > 0.5) setContentHeight(h);
        }}
      >
        {expanded}
      </Animated.View>
      <Animated.View
        style={[
          styles.layer,
          { top: insets.top + space.sm, left: space.md, right: space.md, height: COMPACT_HEIGHT, justifyContent: 'center' },
          compactStyle,
        ]}
      >
        <View style={styles.compactRow}>{compact}</View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    overflow: 'visible',
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
  },
  layer: { position: 'absolute' },
  compactRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
