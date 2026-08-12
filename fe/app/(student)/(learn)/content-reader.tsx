import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { CaretLeft } from 'phosphor-react-native';
import { useTheme } from '@/src/theme/ThemeProvider';

const SIBLINGS = [
  { id: 's1', title: 'Laws of Thermodynamics — Notes', meta: '8 min read' },
  { id: 's2', title: 'Heat Engines — Notes', meta: '5 min read' },
  { id: 's3', title: 'Entropy — Notes', meta: '6 min read' },
];

const BODY = `Thermodynamics is the branch of physics that deals with heat, work, and temperature, and their relation to energy and the properties of matter. For NEET, you need a clear grip on three laws and a handful of standard processes — nothing more, but nothing less either.

## The Zeroth Law

If two systems are each in thermal equilibrium with a third, they are in thermal equilibrium with each other. This is the basis of temperature measurement — it's why a thermometer works.

## The First Law

Energy is conserved. Mathematically: ΔU = Q - W, where ΔU is the change in internal energy, Q is heat added to the system, and W is work done by the system. The sign convention matters: heat added is positive, work done by the gas is positive.

## The Second Law

The entropy of an isolated system never decreases. Practically: heat flows spontaneously from hot to cold, never the reverse without external work. This is why no engine can be 100% efficient.

## Key Processes

- Isothermal: T constant, ΔU = 0, so Q = W.
- Adiabatic: Q = 0, so ΔU = -W.
- Isochoric: V constant, W = 0, so ΔU = Q.
- Isobaric: P constant, W = PΔV.

Master these four and you can decode almost any thermodynamics question NEET throws at you.`;

export default function ContentReaderRoute() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const [progress, setProgress] = useState(0);
  const [scrolled, setScrolled] = useState(false);

  const topBarBg = useSharedValue(0);

  useEffect(() => {
    topBarBg.value = withTiming(scrolled ? 1 : 0, { duration: 200 });
  }, [scrolled, topBarBg]);

  const topBarStyle = useAnimatedStyle(() => ({
    backgroundColor: topBarBg.value === 1 ? color('bg/surface') : 'transparent',
    borderBottomWidth: topBarBg.value === 1 ? 1 : 0,
  }));

  const onScroll = (e: { nativeEvent: { contentOffset: { y: number }; contentSize: { height: number }; layoutMeasurement: { height: number } } }) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    const y = contentOffset.y;
    const max = contentSize.height - layoutMeasurement.height;
    setProgress(max > 0 ? y / max : 0);
    setScrolled(y > 40);
  };

  const paragraphs = BODY.split('\n\n');

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: color('bg/canvas') }]}>
      {/* Sticky top bar */}
      <Animated.View
        style={[
          {
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            paddingTop: insets.top,
            zIndex: 10,
            borderBottomColor: color('border/subtle'),
          },
          topBarStyle,
        ]}
      >
        <View style={[styles.topBar, { paddingHorizontal: space.lg, paddingVertical: space.md }]}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={space.xs}
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
          >
            <CaretLeft size={24} color={color('text/primary')} />
          </Pressable>
        </View>
        <View style={{ height: 2, backgroundColor: color('bg/sunken') }}>
          <View
            style={{
              width: `${progress * 100}%`,
              height: 2,
              backgroundColor: color('accent/default'),
            }}
          />
        </View>
      </Animated.View>

      <ScrollView
        ref={scrollRef}
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{
          paddingHorizontal: space.lg,
          paddingTop: insets.top + 56,
          paddingBottom: space['3xl'] + insets.bottom,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Content header */}
        <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>
          Physics › Thermodynamics
        </Text>
        <Text style={[type['type/h1'], { color: color('text/primary'), marginTop: space['2xs'] }]}>
          Thermodynamics — Chapter Notes
        </Text>
        <Text
          style={[
            type['type/caption'],
            { color: color('text/tertiary'), marginTop: space['2xs'] },
          ]}
        >
          6 min read
        </Text>

        {/* Body */}
        <View style={{ marginTop: space.lg, gap: space.md }}>
          {paragraphs.map((para, i) => {
            if (para.startsWith('## ')) {
              return (
                <Text
                  key={i}
                  style={[
                    type['type/h3'],
                    { color: color('text/primary'), marginTop: i > 0 ? space.lg : 0 },
                  ]}
                >
                  {para.replace('## ', '')}
                </Text>
              );
            }
            return (
              <Text
                key={i}
                style={[type['type/body-l'], { color: color('text/primary') }]}
              >
                {para}
              </Text>
            );
          })}
        </View>

        {/* End-of-content footer */}
        <View
          style={{
            borderTopWidth: 1,
            borderTopColor: color('border/subtle'),
            marginTop: space.xl,
            paddingTop: space.lg,
          }}
        >
          <Text
            style={[
              type['type/overline'],
              { color: color('text/tertiary'), marginBottom: space.sm },
            ]}
          >
            MORE IN THIS CHAPTER
          </Text>
          <View style={{ gap: space.xs }}>
            {SIBLINGS.map((s) => (
              <Pressable
                key={s.id}
                onPress={() => router.push({ pathname: '/(student)/(learn)/content-reader', params: { id: s.id } })}
                style={({ pressed }) => [
                  styles.siblingRow,
                  {
                    backgroundColor: color('bg/surface'),
                    borderRadius: radius.md,
                    padding: space.sm,
                    opacity: pressed ? 0.94 : 1,
                  },
                  shadow(),
                ]}
              >
                <View style={{ flex: 1 }}>
                  <Text
                    style={[type['type/body-m-medium'], { color: color('text/primary') }]}
                    numberOfLines={1}
                  >
                    {s.title}
                  </Text>
                  <Text style={[type['type/caption'], { color: color('text/tertiary'), marginTop: 2 }]}>
                    {s.meta}
                  </Text>
                </View>
                <CaretLeft size={18} color={color('text/tertiary')} style={{ transform: [{ rotate: '180deg' }] }} />
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function shadow() {
  return {
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  };
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center' },
  siblingRow: { flexDirection: 'row', alignItems: 'center' },
});
