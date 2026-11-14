import { useEffect } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, {
  interpolate,
  interpolateColor,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { ArrowsClockwise } from 'phosphor-react-native';
import { useTheme } from '@/src/theme/ThemeProvider';
import { RichContent, type MediaMap } from '@/src/rich';
import { shadow } from '@/src/theme/elevation';

export type SwipeDir = 'left' | 'right';

type Props = {
  front: string;
  back: string;
  format: string;
  media: MediaMap;
  flipped: boolean;
  onFlip: () => void;
  /** Called after a horizontal swipe past the threshold. Omit to turn swiping off. */
  onSwipe?: (dir: SwipeDir) => void;
  /** Text shown while dragging toward each side, e.g. { left: 'Again', right: 'Good' }. */
  swipeHints?: { left: string; right: string };
  deckTitle: string;
};

const THRESHOLD = 90;

/** A card that flips in 3D on tap and can be dragged left or right. Both faces stay mounted so content never reloads. */
export function FlipCard({ front, back, format, media, flipped, onFlip, onSwipe, swipeHints, deckTitle }: Props) {
  const { color, type, space, radius } = useTheme();
  const spin = useSharedValue(0);
  const dx = useSharedValue(0);
  // Resolve theme colours here, on the JS thread: animation worklets run on the UI thread and can't call color().
  const dangerInk = color('semantic/danger');
  const successInk = color('semantic/success');

  useEffect(() => {
    spin.value = withTiming(flipped ? 1 : 0, { duration: 320 });
  }, [flipped, spin]);

  const pan = Gesture.Pan()
    .enabled(!!onSwipe)
    .activeOffsetX([-24, 24])
    .failOffsetY([-24, 24])
    .onUpdate((e) => {
      dx.value = e.translationX;
    })
    .onEnd((e) => {
      if (onSwipe && Math.abs(e.translationX) > THRESHOLD) {
        const dir: SwipeDir = e.translationX < 0 ? 'left' : 'right';
        dx.value = 0;
        runOnJS(onSwipe)(dir);
      } else {
        dx.value = withTiming(0, { duration: 180 });
      }
    });
  const tapGesture = Gesture.Tap().maxDistance(12).onEnd((_e, ok) => {
    if (ok) runOnJS(onFlip)();
  });
  const gesture = Gesture.Race(pan, tapGesture);

  const wrap = useAnimatedStyle(() => ({
    transform: [{ translateX: dx.value }, { rotateZ: `${interpolate(dx.value, [-200, 200], [-6, 6])}deg` }],
  }));
  const frontStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: 1200 }, { rotateY: `${interpolate(spin.value, [0, 1], [0, 180])}deg` }],
  }));
  const backStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: 1200 }, { rotateY: `${interpolate(spin.value, [0, 1], [180, 360])}deg` }],
  }));
  const edge = useAnimatedStyle(() => ({
    borderColor: interpolateColor(
      dx.value,
      [-THRESHOLD, 0, THRESHOLD],
      [dangerInk, 'rgba(0,0,0,0)', successInk],
    ),
  }));
  const hintLeft = useAnimatedStyle(() => ({ opacity: interpolate(dx.value, [-THRESHOLD, -20, 0], [1, 0.2, 0], 'clamp') }));
  const hintRight = useAnimatedStyle(() => ({ opacity: interpolate(dx.value, [0, 20, THRESHOLD], [0, 0.2, 1], 'clamp') }));

  const face = (kind: 'front' | 'back') => (
    <Animated.View
      key={kind}
      pointerEvents={(kind === 'back') === flipped ? 'auto' : 'none'}
      style={[
        StyleSheet.absoluteFill,
        styles.face,
        { backgroundColor: color('bg/surface'), borderRadius: radius.lg },
        shadow(),
        kind === 'front' ? frontStyle : backStyle,
      ]}
    >
      <View style={{ paddingHorizontal: space.md, paddingTop: space.sm, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text numberOfLines={1} style={[type['type/caption'], { color: color('text/tertiary'), flex: 1 }]}>{deckTitle}</Text>
        <View style={{ backgroundColor: kind === 'front' ? color('bg/sunken') : color('accent/tint'), borderRadius: radius.pill, paddingHorizontal: space.sm, paddingVertical: 2 }}>
          <Text style={[type['type/overline'], { color: kind === 'front' ? color('text/secondary') : color('accent/default') }]}>
            {kind === 'front' ? 'QUESTION' : 'ANSWER'}
          </Text>
        </View>
      </View>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: space.lg }} showsVerticalScrollIndicator={false}>
        <RichContent value={kind === 'front' ? front : back} format={format} media={media} variant="stem" />
      </ScrollView>
      {kind === 'front' ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingBottom: space.md }}>
          <ArrowsClockwise size={16} color={color('text/tertiary')} />
          <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>Tap to flip</Text>
        </View>
      ) : null}
    </Animated.View>
  );

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        accessible
        accessibilityRole="button"
        accessibilityLabel={flipped ? 'Answer side. Tap to see the question.' : 'Question side. Tap to reveal the answer.'}
        style={[{ flex: 1 }, wrap]}
      >
        <Animated.View style={[StyleSheet.absoluteFill, { borderRadius: radius.lg, borderWidth: 3 }, edge]} pointerEvents="none" />
        {face('front')}
        {face('back')}
        {swipeHints ? (
          <>
            <Animated.Text style={[styles.hint, { left: space.md, color: color('semantic/danger') }, type['type/h3'], hintLeft]}>{swipeHints.left}</Animated.Text>
            <Animated.Text style={[styles.hint, { right: space.md, color: color('semantic/success') }, type['type/h3'], hintRight]}>{swipeHints.right}</Animated.Text>
          </>
        ) : null}
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  face: { backfaceVisibility: 'hidden', overflow: 'hidden' },
  hint: { position: 'absolute', top: 56 },
});
