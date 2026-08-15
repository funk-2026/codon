import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, type Href } from 'expo-router';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import {
  Stack,
  Exam,
  Lightning,
  CaretRight,
} from 'phosphor-react-native';
import { useTheme } from '@/src/theme/ThemeProvider';
import { getAttempts } from '@/src/api/profile';
import type { StudentAttempt } from '@/src/api/attempts';

type Category = {
  id: 'qbank' | 'test_series' | 'practice';
  title: string;
  descriptor: string;
  icon: React.ReactNode;
  href: Href;
};



function Stagger({ delayMs, children }: { delayMs: number; children: React.ReactNode }) {
  const shown = useSharedValue(0);
  useEffect(() => {
    const t = setTimeout(() => {
      shown.value = withTiming(1, { duration: 300 });
    }, delayMs);
    return () => clearTimeout(t);
  }, [delayMs, shown]);
  const style = useAnimatedStyle(() => ({
    opacity: shown.value,
    transform: [{ translateY: (1 - shown.value) * 10 }],
  }));
  return <Animated.View style={style}>{children}</Animated.View>;
}

export default function PracticeHubRoute() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [attempts, setAttempts] = useState<StudentAttempt[]>([]);

  useEffect(() => {
    async function load() {
      try {
        const res = await getAttempts();
        setAttempts(res.attempts);
      } catch (e) {
        console.error('Failed to load attempts', e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const isNewUser = !loading && attempts.length === 0;

  // Let's compute some basic stats if we have attempts
  const completed = attempts.filter(a => a.status === 'submitted');
  const avgScore = completed.length > 0 
    ? completed.reduce((acc, a) => acc + ((a.score || 0) / (a.total_marks || 1)) * 100, 0) / completed.length 
    : 0;
  
  // To get weekly count, count attempts in last 7 days
  const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const weeklyCount = attempts.filter(a => new Date(a.started_at).getTime() > oneWeekAgo).length;

  // Just grab top 4 for recent
  const recentAttempts = attempts.slice(0, 4);

  const categories: Category[] = [
    {
      id: 'qbank',
      title: 'Q Bank',
      descriptor: 'Topic-wise questions to build your foundation, chapter by chapter.',
      icon: <Stack size={28} color={color('accent/default')} weight="duotone" />,
      href: { pathname: '/(student)/(practice)/hierarchy', params: { kind: 'qbank' } },
    },
    {
      id: 'test_series',
      title: 'Test Series',
      descriptor: 'Full-length, exam-pattern tests that simulate the real thing.',
      icon: <Exam size={28} color={color('accent/default')} weight="duotone" />,
      href: { pathname: '/(student)/(practice)/hierarchy', params: { kind: 'test_series' } },
    },
    {
      id: 'practice',
      title: 'Practice',
      descriptor: 'Short, low-pressure sets to warm up or review a single topic.',
      icon: <Lightning size={28} color={color('accent/default')} weight="duotone" />,
      href: { pathname: '/(student)/(practice)/hierarchy', params: { kind: 'practice' } },
    },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: color('bg/canvas') }]}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: space.md, paddingBottom: space['3xl'] }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[type['type/h1'], { color: color('text/primary'), marginTop: space.lg }]}>
          Practice.
        </Text>

        <View style={{ gap: space.md, marginTop: space.lg }}>
          {categories.map((c, i) => (
            <Stagger key={c.id} delayMs={i * 80}>
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

        {!isNewUser ? (
          <Stagger delayMs={320}>
            <View style={{ marginTop: space.xl }}>
              <View
                style={[
                  styles.summary,
                  {
                    backgroundColor: color('bg/surface'),
                    borderRadius: radius.md,
                    paddingVertical: space.md,
                  },
                  shadow(),
                ]}
              >
                <SummaryStat label="Accuracy" value={completed.length > 0 ? "82%" : "—"} />
                <Divider />
                <SummaryStat label="Avg. Score" value={completed.length > 0 ? `${Math.round(avgScore)}%` : "—"} />
                <Divider />
                <SummaryStat label="This Week" value={`${weeklyCount}`} />
              </View>
            </View>
          </Stagger>
        ) : null}

        <View style={{ marginTop: space.xl }}>
          <View style={[styles.sectionRow, { marginBottom: space.sm }]}>
            <Text style={[type['type/overline'], { color: color('text/tertiary') }]}>
              RECENT TESTS
            </Text>
            <Pressable onPress={() => router.push('/(student)/(practice)/test-history')}>
              <Text style={[type['type/caption'], { color: color('accent/default') }]}>
                View all →
              </Text>
            </Pressable>
          </View>

          {isNewUser ? (
            <View
              style={{
                alignItems: 'center',
                paddingVertical: space.lg,
                gap: space.xs,
              }}
            >
              <Stack size={28} color={color('text/tertiary')} weight="duotone" />
              <Text
                style={[
                  type['type/body-m'],
                  { color: color('text/secondary'), textAlign: 'center' },
                ]}
              >
                Your recent attempts will show up here — start with Q Bank or Practice.
              </Text>
            </View>
          ) : (
            <View style={{ gap: space.xs }}>
              {recentAttempts.map((t) => {
                const breadcrumb = t.test?.subject?.name 
                  ? `${t.test.subject.name} › ${t.test.chapter?.name || 'General'}` 
                  : (t.test?.course?.name || 'General');

                return (
                <Pressable
                  key={t.id}
                  onPress={() =>
                    t.status === 'submitted'
                      ? router.push({
                          pathname: '/(student)/(practice)/test-review',
                          params: { id: t.id },
                        })
                      : router.push({
                          pathname: '/(student)/(practice)/test-question',
                          params: { id: t.test_id },
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
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[type['type/body-m-medium'], { color: color('text/primary') }]}
                      numberOfLines={1}
                    >
                      {t.test?.title || 'Practice Test'}
                    </Text>
                    <Text
                      style={[
                        type['type/caption'],
                        { color: color('text/tertiary'), marginTop: 2 },
                      ]}
                    >
                      {breadcrumb}
                    </Text>
                  </View>
                  {t.status === 'submitted' ? (
                    <View
                      style={[
                        styles.scoreBadge,
                        { backgroundColor: color('accent/tint'), borderRadius: radius.pill },
                      ]}
                    >
                      <Text
                        style={[type['type/caption'], { color: color('accent/default') }]}
                      >
                        {t.score}/{t.total_marks}
                      </Text>
                    </View>
                  ) : (
                    <View
                      style={[
                        styles.scoreBadge,
                        {
                          backgroundColor: color('semantic/warning'),
                          borderRadius: radius.pill,
                        },
                      ]}
                    >
                      <Text
                        style={[type['type/caption'], { color: color('text/primary') }]}
                      >
                        In Progress
                      </Text>
                    </View>
                  )}
                </Pressable>
              )})}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  const { color, type } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={[type['type/h2'], { color: color('text/primary') }]}>{value}</Text>
      <Text style={[type['type/caption'], { color: color('text/secondary'), marginTop: 2 }]}>
        {label}
      </Text>
    </View>
  );
}

function Divider() {
  const { color } = useTheme();
  return <View style={{ width: 1, backgroundColor: color('border/subtle') }} />;
}

function shadow(): {} {
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
  catCard: { justifyContent: 'center' },
  catRow: { flexDirection: 'row', alignItems: 'center' },
  catIcon: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  summary: { flexDirection: 'row', alignItems: 'center' },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  scoreBadge: { paddingHorizontal: 10, paddingVertical: 4 },
});
