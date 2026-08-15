import { useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type ViewToken,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, type Href } from 'expo-router';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import {
  Flame,
  Exam,
  BookOpen,
  HandHeart,
} from 'phosphor-react-native';
import { useTheme } from '@/src/theme/ThemeProvider';
import { useAuth } from '@/src/auth/AuthContext';
import { getMe, getProgress, getProgressBreakdown, getRecentContent } from '@/src/api/profile';
import type { Subscription } from '@/src/api/profile';

type SubState = 'active' | 'expiring' | 'none';

const UPDATES = [
  { overline: 'NEW', headline: 'Full-Length NEET Mock Test 4 is live', tone: 'accent' as const },
  { overline: 'PROGRESS', headline: 'Your Chemistry accuracy is up 8% this week — keep going', tone: 'accent' as const },
  { overline: 'SUPPORT', headline: 'One step at a time. Visit Support for today\u2019s guidance.', tone: 'wellness' as const },
  { overline: 'OFFER', headline: 'Refer a friend, both of you get 7 days free.', tone: 'accent' as const },
];

const BRAIN_HACKS = [
  { id: '1', title: 'Beat exam-day anxiety in 5 minutes' },
  { id: '2', title: 'The 2-minute recall trick' },
  { id: '3', title: 'How to read a question twice, not once' },
];

const QUICK_ACCESS: { label: string; href: Href; icon: React.ReactNode; wellness?: boolean }[] = [
  { label: 'Q Bank', href: '/(student)/(practice)', icon: <Exam size={24} color="#000" weight="duotone" /> },
  { label: 'Test Series', href: '/(student)/(practice)', icon: <Exam size={24} color="#000" weight="duotone" /> },
  { label: 'Video Classes', href: '/(student)/(learn)', icon: <BookOpen size={24} color="#000" weight="duotone" /> },
  { label: 'Support', href: '/(student)/(support)', icon: <HandHeart size={24} color="#000" weight="duotone" />, wellness: true },
];

function greeting(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return 'Good morning';
  if (h >= 12 && h < 17) return 'Good afternoon';
  if (h >= 17 && h < 21) return 'Good evening';
  return 'Welcome back';
}

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

export default function HomeDashboardRoute() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const { user } = useAuth();

  const { width: screenWidth } = useWindowDimensions();
  const cardWidth = screenWidth - space.md * 2;
  const bhCardWidth = Math.max(130, Math.min(200, (screenWidth - space.md * 2) / 2.6));

  const [subState, setSubState] = useState<SubState>('none');
  const [subText, setSubText] = useState('');

  const [stats, setStats] = useState({ attempted: 0, avgScore: 0 });
  const [streak, setStreak] = useState(0);
  const [isNewUser, setIsNewUser] = useState(true);
  const [recentItem, setRecentItem] = useState<any>(null);

  const flatRef = useRef<FlatList<typeof UPDATES[number]>>(null);
  const [slide, setSlide] = useState(0);
  const paused = useRef(false);

  useEffect(() => {
    async function loadData() {
      try {
        const [meRes, progRes, breakdownRes, recentRes] = await Promise.all([
          getMe(),
          getProgress(),
          getProgressBreakdown(),
          getRecentContent()
        ]);

        if (recentRes.recent && recentRes.recent.length > 0) {
          setRecentItem(recentRes.recent[0]);
        }

        setStreak(breakdownRes.day_streak);
        if (meRes.active_subscription) {
          const end = new Date(meRes.active_subscription.end_date);
          const diffDays = Math.ceil((end.getTime() - Date.now()) / (1000 * 3600 * 24));
          const planName = meRes.active_subscription.plan?.name || 'Pro';

          if (diffDays <= 7) {
            setSubState('expiring');
            setSubText(`Your ${planName} plan expires in ${diffDays} days — renew to keep access.`);
          } else {
            setSubState('active');
            setSubText(`${planName} — active until ${end.toLocaleDateString()}`);
          }
        } else {
          setSubState('none');
        }

        if (progRes.attempted_count > 0) {
          setStats({ attempted: progRes.attempted_count, avgScore: progRes.avg_score });
          setIsNewUser(false);
        }
      } catch (err) {
        console.error('Failed to load home data', err);
      }
    }
    loadData();
  }, []);

  useEffect(() => {
    if (paused.current) return;
    const t = setInterval(() => {
      flatRef.current?.scrollToIndex({
        index: (slide + 1) % UPDATES.length,
        animated: true,
      });
    }, 5000);
    return () => clearInterval(t);
  }, [slide]);

  const onViewable = useRef((info: { viewableItems: ViewToken[] }) => {
    const first = info.viewableItems[0];
    if (first?.index != null) setSlide(first.index);
  }).current;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: color('bg/canvas') }]}>
      <FlatList
        data={[{}]}
        keyExtractor={() => 'root'}
        renderItem={() => (
          <View style={{ paddingHorizontal: space.md, paddingBottom: space['3xl'] }}>
            {/* Header */}
            <Stagger delayMs={0}>
              <View style={[styles.headerRow, { marginTop: space.lg }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[type['type/h2'], { color: color('text/primary') }]}>
                    {greeting()}, {user?.name?.split(' ')[0] || 'Student'}
                  </Text>
                  <View style={[styles.streakRow, { gap: space['2xs'], marginTop: space['2xs'] }]}>
                    <Flame size={16} color={color('semantic/warning')} weight="fill" />
                    <Text style={[type['type/caption'], { color: color('text/secondary') }]}>
                      {streak} day streak
                    </Text>
                  </View>
                </View>
                <Pressable
                  onPress={() => router.push('/(student)/(profile)')}
                  hitSlop={space.xs}
                >
                  <View
                    style={[
                      styles.avatar,
                      {
                        width: 40,
                        height: 40,
                        borderRadius: 20,
                        backgroundColor: color('accent/tint'),
                      },
                    ]}
                  >
                    <Text style={[type['type/h3'], { color: color('accent/default') }]}>
                      {(user?.name || 'A').charAt(0).toUpperCase()}
                    </Text>
                  </View>
                </Pressable>
              </View>
            </Stagger>

            {/* Updates carousel */}
            {/* <Stagger delayMs={80}>
              <View style={{ marginTop: space.lg }}>
                <FlatList
                  ref={flatRef}
                  data={UPDATES}
                  keyExtractor={(_, i) => String(i)}
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  onScrollToIndexFailed={() => {}}
                  getItemLayout={(_, i) => ({ length: cardWidth, offset: cardWidth * i, index: i })}
                  onViewableItemsChanged={onViewable}
                  viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
                  onScrollBeginDrag={() => (paused.current = true)}
                  onScrollEndDrag={() => (paused.current = false)}
                  renderItem={({ item }) => (
                    <UpdateCard item={item} width={cardWidth - 12} />
                  )}
                  style={{ width: cardWidth }}
                />
                <View style={[styles.dots, { gap: space.xs, marginTop: space.xs }]}>
                  {UPDATES.map((_, i) => (
                    <View
                      key={i}
                      style={{
                        width: i === slide ? 24 : 8,
                        height: 8,
                        borderRadius: 4,
                        backgroundColor:
                          i === slide ? color('accent/default') : color('border/strong'),
                      }}
                    />
                  ))}
                </View>
              </View>
            </Stagger> */}

            {/* Continue Learning */}
            {recentItem ? (
              <Stagger delayMs={160}>
                <View style={{ marginTop: space.xl }}>
                  <Text
                    style={[
                      type['type/overline'],
                      { color: color('text/tertiary'), marginBottom: space.xs },
                    ]}
                  >
                    CONTINUE LEARNING
                  </Text>
                  <View
                    style={[
                      styles.continueCard,
                      {
                        backgroundColor: color('bg/surface'),
                        borderRadius: radius.lg,
                        padding: space.md,
                      },
                      shadow(),
                    ]}
                  >
                    <View style={styles.cardRow}>
                      <View
                        style={[
                          styles.continueIcon,
                          { backgroundColor: color('accent/tint'), borderRadius: radius.md },
                        ]}
                      >
                        {recentItem.kind === 'video' ? (
                          <BookOpen size={28} color={color('accent/default')} weight="duotone" />
                        ) : (
                          <Exam size={28} color={color('accent/default')} weight="duotone" />
                        )}
                      </View>
                      <View style={{ flex: 1, marginLeft: space.md }}>
                        <Text
                          style={[type['type/h3'], { color: color('text/primary') }]}
                          numberOfLines={1}
                        >
                          Resume: {recentItem.title || 'Content'}
                        </Text>
                        <Text
                          style={[
                            type['type/caption'],
                            { color: color('text/secondary'), marginTop: 2 },
                          ]}
                        >
                          {recentItem.pct === 100 ? 'Completed' : `${recentItem.pct}% Completed`}
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
                          width: `${recentItem.pct}%`,
                          height: 4,
                          backgroundColor: color('accent/default'),
                          borderRadius: 2,
                        }}
                      />
                    </View>
                    <Pressable
                      onPress={() => {
                        if (recentItem.id) {
                          router.push({ pathname: '/(student)/(learn)/video-player', params: { id: recentItem.id } });
                        }
                      }}
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
                        style={[
                          type['type/body-m-medium'],
                          { color: color('accent/on-accent') },
                        ]}
                      >
                        Continue Now
                      </Text>
                    </Pressable>
                  </View>
                </View>
              </Stagger>
            ) : null}

            {/* Quick Access */}
            <Stagger delayMs={240}>
              <View style={{ marginTop: space.xl }}>
                <Text
                  style={[
                    type['type/overline'],
                    { color: color('text/tertiary'), marginBottom: space.sm },
                  ]}
                >
                  EXPLORE
                </Text>
                <View style={[styles.grid, { gap: space.sm }]}>
                  {QUICK_ACCESS.map((q) => (
                    <Pressable
                      key={q.label}
                      onPress={() => router.push(q.href)}
                      style={({ pressed }) => [
                        styles.qaCard,
                        {
                          backgroundColor: color('bg/surface'),
                          borderRadius: radius.md,
                          padding: space.md,
                          opacity: pressed ? 0.92 : 1,
                        },
                        shadow(),
                      ]}
                    >
                      {(() => {
                        const ink = q.wellness ? color('wellness/accent') : color('accent/default');
                        if (q.label === 'Q Bank') return <Exam size={26} color={ink} weight="duotone" />;
                        if (q.label === 'Test Series') return <Exam size={26} color={ink} weight="duotone" />;
                        if (q.label === 'Video Classes') return <BookOpen size={26} color={ink} weight="duotone" />;
                        return <HandHeart size={26} color={ink} weight="duotone" />;
                      })()}
                      <Text
                        style={[
                          type['type/h3'],
                          { color: color('text/primary'), marginTop: space.xs },
                        ]}
                      >
                        {q.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </Stagger>

            {/* Subscription strip */}
            <Stagger delayMs={320}>
              <View style={{ marginTop: space.xl }}>
                <SubscriptionStrip
                  state={subState}
                  text={subText}
                  onViewPlans={() =>
                    router.push('/(student)/(profile)/subscription-plans')
                  }
                />
              </View>
            </Stagger>

            {/* Progress snapshot */}
            <Stagger delayMs={400}>
              <View style={{ marginTop: space.xl }}>
                <View style={[styles.sectionRow, { marginBottom: space.sm }]}>
                  <Text style={[type['type/overline'], { color: color('text/tertiary') }]}>
                    YOUR PROGRESS
                  </Text>
                  <Pressable onPress={() => router.push('/(student)/(profile)/progress-detail')}>
                    <Text style={[type['type/caption'], { color: color('accent/default') }]}>
                      View all →
                    </Text>
                  </Pressable>
                </View>
                <View style={[styles.statRow, { gap: space.xs }]}>
                  <StatTile label="Tests Taken" value={isNewUser ? '0' : stats.attempted.toString()} />
                  <StatTile label="Avg. Score" value={isNewUser ? '—' : `${Math.round(stats.avgScore)}%`} />
                  <StatTile label="Day Streak" value={isNewUser ? '0' : '12'} />
                </View>
              </View>
            </Stagger>

            {/* Brain Hacks shelf */}
            <Stagger delayMs={480}>
              <View style={{ marginTop: space.xl }}>
                <View style={[styles.sectionRow, { marginBottom: space.sm }]}>
                  <Text style={[type['type/overline'], { color: color('text/tertiary') }]}>
                    FREE BRAIN HACKS
                  </Text>
                  <Pressable onPress={() => router.push('/(student)/(home)/brain-hacks')}>
                    <Text style={[type['type/caption'], { color: color('accent/default') }]}>
                      See all →
                    </Text>
                  </Pressable>
                </View>
                <FlatList
                  data={BRAIN_HACKS}
                  keyExtractor={(item) => item.id}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  renderItem={({ item }) => (
                    <Pressable
                      onPress={() =>
                        router.push({
                          pathname: '/(student)/(home)/brain-hack-detail',
                          params: { id: item.id },
                        })
                      }
                      style={({ pressed }) => [
                        styles.bhCard,
                        {
                          width: bhCardWidth,
                          backgroundColor: color('bg/surface'),
                          borderRadius: radius.md,
                          padding: space.sm,
                          marginRight: space.sm,
                          opacity: pressed ? 0.92 : 1,
                        },
                        shadow(),
                      ]}
                    >
                      <View
                        style={[
                          styles.bhIcon,
                          { backgroundColor: color('accent/tint'), borderRadius: radius.sm },
                        ]}
                      >
                        <Flame size={20} color={color('accent/default')} weight="duotone" />
                      </View>
                      <Text
                        style={[
                          type['type/h3'],
                          { color: color('text/primary'), marginTop: space.xs, fontSize: 15 },
                        ]}
                        numberOfLines={2}
                      >
                        {item.title}
                      </Text>
                    </Pressable>
                  )}
                />
              </View>
            </Stagger>
          </View>
        )}
      />
    </SafeAreaView>
  );
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

function UpdateCard({
  item,
  width,
}: {
  item: (typeof UPDATES)[number];
  width: number;
}) {
  const { color, type, space, radius } = useTheme();
  const ink = item.tone === 'wellness' ? color('wellness/accent') : color('accent/default');
  const bg = item.tone === 'wellness' ? color('wellness/bg') : color('accent/tint');
  return (
    <View
      style={[
        styles.updateCard,
        {
          width,
          height: 140,
          backgroundColor: bg,
          borderRadius: radius.lg,
          padding: space.md,
          marginRight: 12,
        },
      ]}
    >
      <Text style={[type['type/overline'], { color: ink }]}>{item.overline}</Text>
      <Text
        style={[
          type['type/h3'],
          { color: color('text/primary'), marginTop: space['2xs'], flexShrink: 1 },
        ]}
        numberOfLines={3}
      >
        {item.headline}
      </Text>
    </View>
  );
}

function SubscriptionStrip({
  state,
  text,
  onViewPlans,
}: {
  state: SubState;
  text?: string;
  onViewPlans: () => void;
}) {
  const { color, type, space, radius } = useTheme();
  if (state === 'active') {
    return (
      <View
        style={[
          styles.strip,
          { backgroundColor: color('bg/surface'), borderRadius: radius.md, padding: space.md },
        ]}
      >
        <Text style={[type['type/body-m'], { color: color('text/primary'), flex: 1 }]}>
          {text || 'Pro — active'}
        </Text>
        <Text style={[type['type/caption'], { color: color('semantic/success') }]}>Active</Text>
      </View>
    );
  }
  if (state === 'expiring') {
    return (
      <View
        style={[
          styles.strip,
          {
            backgroundColor: color('semantic/warning'),
            borderRadius: radius.md,
            padding: space.md,
          },
        ]}
      >
        <Text style={[type['type/body-m'], { color: color('text/primary') }]}>
          {text || 'Your plan is expiring soon.'}
        </Text>
      </View>
    );
  }
  return (
    <View
      style={[
        styles.strip,
        { backgroundColor: color('accent/tint'), borderRadius: radius.md, padding: space.md },
      ]}
    >
      <Text style={[type['type/body-m'], { color: color('text/primary'), flex: 1 }]}>
        You&apos;re on Free access. Unlock full Test Series and Video Classes.
      </Text>
      <Pressable onPress={onViewPlans}>
        <Text style={[type['type/body-m-medium'], { color: color('accent/default') }]}>
          View Plans
        </Text>
      </Pressable>
    </View>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  const { color, type, space, radius } = useTheme();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: color('bg/surface'),
        borderRadius: radius.md,
        padding: space.sm,
      }}
    >
      <Text style={[type['type/numeral-display'], { color: color('text/primary'), fontSize: 26 }]}>
        {value}
      </Text>
      <Text style={[type['type/caption'], { color: color('text/secondary'), marginTop: 2 }]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  streakRow: { flexDirection: 'row', alignItems: 'center' },
  avatar: { alignItems: 'center', justifyContent: 'center' },
  dots: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  cardRow: { flexDirection: 'row', alignItems: 'center' },
  continueCard: {},
  continueIcon: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  resumeBtn: { alignSelf: 'flex-end', paddingHorizontal: 16, paddingVertical: 8, minHeight: 36 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  qaCard: { width: '48%', minHeight: 96, justifyContent: 'center' },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statRow: { flexDirection: 'row' },
  strip: { flexDirection: 'row', alignItems: 'center' },
  bhCard: { minHeight: 120 },
  bhIcon: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  updateCard: { justifyContent: 'flex-end' },
});
