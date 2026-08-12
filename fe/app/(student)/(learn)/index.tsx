import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, type Href } from 'expo-router';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { PlayCircle, FileText, CaretRight } from 'phosphor-react-native';
import { useTheme } from '@/src/theme/ThemeProvider';

type Category = {
  id: 'video' | 'document';
  title: string;
  descriptor: string;
  icon: React.ReactNode;
  href: Href;
};

type RecentItem = {
  id: string;
  title: string;
  breadcrumb: string;
  kind: 'video' | 'document';
  pct: number;
};

const RECENT: RecentItem[] = [
  { id: '1', title: 'Thermodynamics — Lecture 3', breadcrumb: 'Physics › Thermodynamics', kind: 'video', pct: 72 },
  { id: '2', title: 'Laws of Motion — Notes', breadcrumb: 'Physics › Mechanics', kind: 'document', pct: 100 },
  { id: '3', title: 'Optics — Ray Diagrams', breadcrumb: 'Physics › Optics', kind: 'video', pct: 35 },
  { id: '4', title: 'Modern Physics — Quick Notes', breadcrumb: 'Physics › Modern Physics', kind: 'document', pct: 100 },
];

function Stagger({ delayMs, children }: { delayMs: number; children: React.ReactNode }) {
  const shown = useSharedValue(0);
  useEffect(() => {
    const t = setTimeout(() => {
      shown.value = withTiming(1, { duration: 280 });
    }, delayMs);
    return () => clearTimeout(t);
  }, [delayMs, shown]);
  const style = useAnimatedStyle(() => ({
    opacity: shown.value,
    transform: [{ translateY: (1 - shown.value) * 10 }],
  }));
  return <Animated.View style={style}>{children}</Animated.View>;
}

export default function LearnHubRoute() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isNewUser = false;

  const categories: Category[] = [
    {
      id: 'video',
      title: 'Video Classes',
      descriptor: 'Recorded lectures, organized by chapter.',
      icon: <PlayCircle size={28} color={color('accent/default')} weight="duotone" />,
      href: { pathname: '/(student)/(learn)/hierarchy', params: { kind: 'video' } } as Href,
    },
    {
      id: 'document',
      title: 'Chapter Notes',
      descriptor: 'Structured reading notes for quick revision.',
      icon: <FileText size={28} color={color('accent/default')} weight="duotone" />,
      href: { pathname: '/(student)/(learn)/hierarchy', params: { kind: 'document' } } as Href,
    },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: color('bg/canvas') }]}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: space.md, paddingBottom: space['3xl'] + insets.bottom }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[type['type/h1'], { color: color('text/primary'), marginTop: space.lg }]}>
          Learn.
        </Text>

        {/* Continue Watching */}
        {!isNewUser ? (
          <Stagger delayMs={0}>
            <View style={{ marginTop: space.lg }}>
              <Text
                style={[
                  type['type/overline'],
                  { color: color('text/tertiary'), marginBottom: space.xs },
                ]}
              >
                CONTINUE WATCHING
              </Text>
              <View
                style={[
                  {
                    backgroundColor: color('bg/surface'),
                    borderRadius: radius.lg,
                    padding: space.md,
                  },
                  shadow(),
                ]}
              >
                <View style={styles.row}>
                  <View
                    style={[
                      styles.iconWrap,
                      { backgroundColor: color('accent/tint'), borderRadius: radius.md },
                    ]}
                  >
                    <PlayCircle size={28} color={color('accent/default')} weight="duotone" />
                  </View>
                  <View style={{ flex: 1, marginLeft: space.md }}>
                    <Text
                      style={[type['type/h3'], { color: color('text/primary') }]}
                      numberOfLines={1}
                    >
                      Thermodynamics — Lecture 3
                    </Text>
                    <Text
                      style={[
                        type['type/caption'],
                        { color: color('text/secondary'), marginTop: 2 },
                      ]}
                    >
                      14:22 of 20:00
                    </Text>
                  </View>
                </View>
                <View
                  style={{
                    height: 4,
                    backgroundColor: color('bg/sunken'),
                    borderRadius: 2,
                    marginTop: space.sm,
                  }}
                >
                  <View
                    style={{
                      width: '72%',
                      height: 4,
                      backgroundColor: color('accent/default'),
                      borderRadius: 2,
                    }}
                  />
                </View>
                <Pressable
                  onPress={() => router.push('/(student)/(learn)/video-player')}
                  style={({ pressed }) => [
                    styles.resumeBtn,
                    {
                      backgroundColor: pressed
                        ? color('accent/pressed')
                        : color('accent/default'),
                      borderRadius: radius.pill,
                      marginTop: space.md,
                      opacity: 0.95,
                    },
                  ]}
                >
                  <Text
                    style={[type['type/body-m-medium'], { color: color('accent/on-accent') }]}
                  >
                    Resume
                  </Text>
                </Pressable>
              </View>
            </View>
          </Stagger>
        ) : null}

        {/* Category cards */}
        <View style={{ gap: space.md, marginTop: space.lg }}>
          {categories.map((c, i) => (
            <Stagger key={c.id} delayMs={(isNewUser ? 0 : 80) + i * 80}>
              <Pressable
                onPress={() => router.push(c.href)}
                style={({ pressed }) => [
                  styles.catCard,
                  {
                    backgroundColor: color('bg/surface'),
                    borderRadius: radius.lg,
                    padding: space.md,
                    minHeight: 88,
                    opacity: pressed ? 0.94 : 1,
                  },
                  shadow(),
                ]}
              >
                <View style={styles.catRow}>
                  <View
                    style={[
                      styles.catIcon,
                      { backgroundColor: color('accent/tint'), borderRadius: radius.md },
                    ]}
                  >
                    {c.icon}
                  </View>
                  <View style={{ flex: 1, marginLeft: space.md }}>
                    <Text style={[type['type/h3'], { color: color('text/primary') }]}>
                      {c.title}
                    </Text>
                    <Text
                      style={[
                        type['type/body-m'],
                        { color: color('text/secondary'), marginTop: 2 },
                      ]}
                      numberOfLines={1}
                    >
                      {c.descriptor}
                    </Text>
                  </View>
                  <CaretRight size={20} color={color('text/tertiary')} />
                </View>
              </Pressable>
            </Stagger>
          ))}
        </View>

        {/* Recently Watched */}
        <View style={{ marginTop: space.xl }}>
          <View style={[styles.sectionRow, { marginBottom: space.sm }]}>
            <Text style={[type['type/overline'], { color: color('text/tertiary') }]}>
              RECENTLY WATCHED
            </Text>
            <Pressable
              onPress={() =>
                router.push({
                  pathname: '/(student)/(learn)/hierarchy',
                  params: { kind: 'video' },
                })
              }
            >
              <Text style={[type['type/caption'], { color: color('accent/default') }]}>
                View all →
              </Text>
            </Pressable>
          </View>

          {isNewUser ? (
            <View style={{ alignItems: 'center', paddingVertical: space.lg, gap: space.xs }}>
              <PlayCircle size={28} color={color('text/tertiary')} weight="duotone" />
              <Text
                style={[
                  type['type/body-m'],
                  { color: color('text/secondary'), textAlign: 'center' },
                ]}
              >
                Videos and notes you&apos;ve opened will show up here.
              </Text>
            </View>
          ) : (
            <View style={{ gap: space.xs }}>
              {RECENT.map((item) => (
                <Pressable
                  key={item.id}
                  onPress={() =>
                    router.push({
                      pathname:
                        item.kind === 'video'
                          ? '/(student)/(learn)/video-player'
                          : '/(student)/(learn)/content-reader',
                      params: { id: item.id },
                    })
                  }
                  style={({ pressed }) => [
                    {
                      backgroundColor: color('bg/surface'),
                      borderRadius: radius.md,
                      padding: space.sm,
                      flexDirection: 'row',
                      alignItems: 'center',
                      opacity: pressed ? 0.94 : 1,
                    },
                    shadow(),
                  ]}
                >
                  <View
                    style={[
                      styles.recentIcon,
                      { backgroundColor: color('accent/tint'), borderRadius: radius.sm },
                    ]}
                  >
                    {item.kind === 'video' ? (
                      <PlayCircle size={20} color={color('accent/default')} weight="duotone" />
                    ) : (
                      <FileText size={20} color={color('accent/default')} weight="duotone" />
                    )}
                  </View>
                  <View style={{ flex: 1, marginLeft: space.sm }}>
                    <Text
                      style={[type['type/body-m-medium'], { color: color('text/primary') }]}
                      numberOfLines={1}
                    >
                      {item.title}
                    </Text>
                    <Text
                      style={[
                        type['type/caption'],
                        { color: color('text/tertiary'), marginTop: 2 },
                      ]}
                    >
                      {item.breadcrumb}
                    </Text>
                  </View>
                  <ProgressRing pct={item.pct} />
                </Pressable>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function ProgressRing({ pct }: { pct: number }) {
  const { color } = useTheme();
  const R = 8;
  const CIRC = 2 * Math.PI * R;
  return (
    <View style={{ width: 16, height: 16 }}>
      {(() => {
        const Svg = require('react-native-svg').Svg;
        const Circle = require('react-native-svg').Circle;
        return (
          <Svg width={16} height={16}>
            <Circle cx={8} cy={8} r={R} stroke={color('bg/sunken')} strokeWidth={2} fill="none" />
            <Circle
              cx={8}
              cy={8}
              r={R}
              stroke={color('accent/default')}
              strokeWidth={2}
              fill="none"
              strokeDasharray={CIRC}
              strokeDashoffset={CIRC * (1 - pct / 100)}
              strokeLinecap="round"
              rotation={-90}
              origin="8,8"
            />
          </Svg>
        );
      })()}
    </View>
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
  row: { flexDirection: 'row', alignItems: 'center' },
  iconWrap: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  resumeBtn: { alignSelf: 'flex-end', paddingHorizontal: 16, paddingVertical: 8, minHeight: 36 },
  catCard: { justifyContent: 'center' },
  catRow: { flexDirection: 'row', alignItems: 'center' },
  catIcon: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  recentIcon: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
});
