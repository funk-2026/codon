import { useRef, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type ViewToken,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  interpolate,
  interpolateColor,
  Extrapolation,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, G, Path } from 'react-native-svg';
import { PrimaryButton } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';

type SlideVariant = 'learn' | 'practice' | 'focus';

type Slide = {
  key: SlideVariant;
  title: string;
  body: string;
};

const SLIDES: Slide[] = [
  {
    key: 'learn',
    title: 'Everything you need to learn, in one place',
    body: 'Video classes, structured chapters, and a question bank built around how NEET, 9th, and 10th syllabi are actually taught.',
  },
  {
    key: 'practice',
    title: 'Practice with purpose',
    body: 'Timed tests, instant scoring, and answer explanations — so every attempt tells you exactly what to study next.',
  },
  {
    key: 'focus',
    title: 'You are not behind',
    body: 'Codon includes Support — a space built into your everyday routine to help you stay steady, not just score high.',
  },
];

function Illustration({ variant, color }: { variant: SlideVariant; color: string }) {
  if (variant === 'practice') {
    return (
      <Svg width={200} height={200} viewBox="0 0 120 120">
        <Circle
          cx={60}
          cy={60}
          r={42}
          stroke={color}
          strokeWidth={3}
          fill="none"
          strokeLinecap="round"
          strokeDasharray="198 66"
          transform="rotate(130 60 60)"
          opacity={0.9}
        />
        <Path
          d="M34 82 L52 64 L66 72 L88 44"
          stroke={color}
          strokeWidth={4}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Path
          d="M78 44 L88 44 L88 54"
          stroke={color}
          strokeWidth={4}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Circle cx={52} cy={64} r={4} fill={color} />
        <Circle cx={66} cy={72} r={4} fill={color} />
      </Svg>
    );
  }

  if (variant === 'focus') {
    return (
      <Svg width={200} height={200} viewBox="0 0 120 120">
        <Circle cx={60} cy={58} r={48} fill={color} opacity={0.08} />
        <Circle cx={60} cy={58} r={46} stroke={color} strokeWidth={2} fill="none" opacity={0.18} />
        <Circle cx={60} cy={58} r={34} stroke={color} strokeWidth={2} fill="none" opacity={0.3} />
        <Circle cx={60} cy={58} r={22} stroke={color} strokeWidth={2} fill="none" opacity={0.45} />
        <Circle cx={60} cy={42} r={9} fill={color} />
        <Path
          d="M60 55 C47 55 43 68 43 76 C43 82 47 84 51 84 L69 84 C73 84 77 82 77 76 C77 68 73 55 60 55 Z"
          fill={color}
        />
        <Path d="M36 86 Q60 75 84 86 Q60 94 36 86 Z" fill={color} />
      </Svg>
    );
  }

  return (
    <Svg width={200} height={200} viewBox="0 0 120 120">
      <Path
        d="M22 70 Q40 63 58 70 L58 98 Q40 91 22 98 Z"
        stroke={color}
        strokeWidth={2.5}
        fill="none"
        strokeLinejoin="round"
      />
      <Path
        d="M98 70 Q80 63 62 70 L62 98 Q80 91 98 98 Z"
        stroke={color}
        strokeWidth={2.5}
        fill="none"
        strokeLinejoin="round"
      />
      <Path d="M60 68 L60 96" stroke={color} strokeWidth={2.5} strokeLinecap="round" />
      <Path
        d="M60 64 L60 52 M60 52 L48 42 M60 52 L74 46 M48 42 L60 30 M74 46 L60 30"
        stroke={color}
        strokeWidth={2}
        fill="none"
        strokeLinecap="round"
      />
      <Circle cx={60} cy={30} r={5} fill={color} />
      <Circle cx={48} cy={42} r={4.5} fill={color} />
      <Circle cx={74} cy={46} r={4.5} fill={color} />
      <Circle cx={60} cy={52} r={4} fill={color} />
    </Svg>
  );
}

function AnimatedPiece({
  scrollX,
  index,
  width,
  rise,
  children,
}: {
  scrollX: SharedValue<number>;
  index: number;
  width: number;
  rise: number;
  children: React.ReactNode;
}) {
  const style = useAnimatedStyle(() => {
    const dist = Math.abs(scrollX.value - index * width) / width;
    const p = interpolate(dist, [0, 0.7], [1, 0], Extrapolation.CLAMP);
    return {
      opacity: p,
      transform: [{ translateY: (1 - p) * rise }],
    };
  });

  return <Animated.View style={style}>{children}</Animated.View>;
}

function SlideItem({
  slide,
  index,
  scrollX,
  width,
}: {
  slide: Slide;
  index: number;
  scrollX: SharedValue<number>;
  width: number;
}) {
  const { color, type, space } = useTheme();
  const isFocus = slide.key === 'focus';
  const ink = isFocus ? color('wellness/accent') : color('accent/default');

  const content = (
    <View style={[styles.slide, { width, paddingHorizontal: space.lg }]}>
      <AnimatedPiece scrollX={scrollX} index={index} width={width} rise={12}>
        <Illustration variant={slide.key} color={ink} />
      </AnimatedPiece>
      <AnimatedPiece scrollX={scrollX} index={index} width={width} rise={20}>
        <Text
          style={[
            type['type/h1'],
            styles.title,
            { color: color('text/primary'), marginTop: space.xl },
          ]}
          numberOfLines={2}
        >
          {slide.title}
        </Text>
      </AnimatedPiece>
      <AnimatedPiece scrollX={scrollX} index={index} width={width} rise={28}>
        <Text
          style={[
            type['type/body-l'],
            styles.body,
            { color: color('text/secondary'), marginTop: space.sm },
          ]}
          numberOfLines={2}
        >
          {slide.body}
        </Text>
      </AnimatedPiece>
    </View>
  );

  if (isFocus) {
    return (
      <View style={{ width, flex: 1 }}>
        <LinearGradient
          colors={[color('bg/canvas'), color('wellness/bg')]}
          style={StyleSheet.absoluteFill}
        />
        {content}
      </View>
    );
  }

  return content;
}

function Dot({ index, scrollX, width, activeColor, inactiveColor }: {
  index: number;
  scrollX: SharedValue<number>;
  width: number;
  activeColor: string;
  inactiveColor: string;
}) {
  const style = useAnimatedStyle(() => {
    const input = [(index - 1) * width, index * width, (index + 1) * width];
    return {
      width: interpolate(scrollX.value, input, [8, 24, 8], Extrapolation.CLAMP),
      backgroundColor: interpolateColor(
        scrollX.value,
        input,
        [inactiveColor, activeColor, inactiveColor],
      ),
    };
  });

  return <Animated.View style={[styles.dot, style]} />;
}

export default function OnboardingRoute() {
  const { color, type, space } = useTheme();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const screenWidth = typeof window !== 'undefined' && window?.innerWidth ? window.innerWidth : width;

  const listRef = useAnimatedRef<FlatList<Slide>>();
  const scrollX = useSharedValue(0);
  const [index, setIndex] = useState(0);

  const scrollHandler = useAnimatedScrollHandler((e) => {
    scrollX.value = e.contentOffset.x;
  });

  const onViewableItemsChanged = useRef((info: { viewableItems: ViewToken[] }) => {
    const first = info.viewableItems[0];
    if (first?.index != null) setIndex(first.index);
  }).current;

  const isLast = index === SLIDES.length - 1;

  const goToAuth = () => router.replace('/phone-entry');

  const handleNext = () => {
    if (isLast) {
      goToAuth();
      return;
    }
    const nextIndex = index + 1;
    listRef.current?.scrollToOffset({ offset: nextIndex * screenWidth, animated: true });
    setIndex(nextIndex);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: color('bg/canvas') }]}>
      <View style={[styles.header, { paddingHorizontal: space.md }]}>
        <Pressable
          accessibilityRole="button"
          hitSlop={space.xs}
          onPress={goToAuth}
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
        >
          <Text style={[type['type/body-m-medium'], { color: color('text/secondary') }]}>Skip</Text>
        </Pressable>
      </View>

      <Animated.FlatList
        ref={listRef}
        data={SLIDES}
        keyExtractor={(item) => item.key}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
        onScrollToIndexFailed={() => {}}
        getItemLayout={(_, i) => ({ length: screenWidth, offset: screenWidth * i, index: i })}
        renderItem={({ item, index: i }) => (
          <SlideItem slide={item} index={i} scrollX={scrollX} width={screenWidth} />
        )}
      />

      <View style={[styles.footer, { paddingHorizontal: space.lg, gap: space.lg }]}>
        <View style={[styles.dots, { gap: space.xs }]}>
          {SLIDES.map((slide, i) => (
            <Dot
              key={slide.key}
              index={i}
              scrollX={scrollX}
              width={screenWidth}
              activeColor={color('accent/default')}
              inactiveColor={color('border/strong')}
            />
          ))}
        </View>
        <PrimaryButton
          label={isLast ? 'Get Started' : 'Next'}
          onPress={handleNext}
          style={styles.cta}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { height: 44, alignItems: 'flex-end', justifyContent: 'center' },
  slide: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { textAlign: 'center' },
  body: { textAlign: 'center', maxWidth: 320 },
  footer: { paddingBottom: 24 },
  dots: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 8 },
  dot: { height: 8, borderRadius: 4 },
  cta: { alignSelf: 'stretch' },
});
