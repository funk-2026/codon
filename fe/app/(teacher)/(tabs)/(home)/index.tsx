import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withSequence, withTiming } from 'react-native-reanimated';
import {
  CheckCircle,
  XCircle,
  ClipboardText,
  VideoCamera,
  Lightbulb,
  TreeStructure,
  CaretRight,
} from 'phosphor-react-native';
import { ErrorBanner, SkeletonBlock } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { listTeacherTests, listTeacherContent } from '@/src/api/teacher';
import { useAuth } from '@/src/auth/AuthContext';

type Activity = {
  id: string;
  status: 'approved' | 'rejected' | 'published';
  text: string;
  time: string;
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

function shadow(): {} {
  return {
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  };
}

function greeting(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return 'Good morning';
  if (h >= 12 && h < 17) return 'Good afternoon';
  if (h >= 17 && h < 21) return 'Good evening';
  return 'Welcome back';
}

function PulsingTile({ children, pulse }: { children: React.ReactNode; pulse: boolean }) {
  const glow = useSharedValue(0);
  useEffect(() => {
    if (!pulse) return;
    glow.value = withDelay(500, withSequence(withTiming(1, { duration: 500 }), withTiming(0, { duration: 500 })));
  }, [pulse, glow]);
  const style = useAnimatedStyle(() => ({
    shadowOpacity: 0.3 * glow.value,
  }));
  return <Animated.View style={[{ shadowColor: '#F26E6E', shadowRadius: 12 }, style]}>{children}</Animated.View>;
}

export default function TeacherHomeRoute() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();
  const tileWidth = (screenWidth - space.md * 2 - space.xs) / 2;
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [stats, setStats] = useState({ inReview: 0, approved: 0, live: 0, changesNeeded: 0 });
  const [recentActivity, setRecentActivity] = useState<Activity[]>([]);

  const loadData = useCallback(() => {
    setLoading(true);
    Promise.all([listTeacherTests(), listTeacherContent()])
      .then(([testsRes, contentRes]) => {
        let inReview = 0, approved = 0, live = 0, changesNeeded = 0;
        const acts: Activity[] = [];
        
        const processItem = (item: any) => {
          if (item.status === 'in_review') inReview++;
          if (item.status === 'approved') approved++;
          if (item.status === 'published') live++;
          if (item.status === 'rejected') changesNeeded++;
          
          if (item.status === 'approved' || item.status === 'published' || item.status === 'rejected') {
            let text = `${item.title} was ${item.status}`;
            if (item.status === 'rejected') text = `${item.title} needs changes`;
            acts.push({
              id: item.id,
              status: item.status as Activity['status'],
              text,
              time: new Date(item.updated_at || Date.now()).toLocaleDateString(),
            });
          }
        };
        
        (testsRes.tests || []).forEach(t => processItem(t));
        (contentRes.content || []).forEach(c => processItem(c));
        
        setStats({ inReview, approved, live, changesNeeded });
        setRecentActivity(acts.slice(0, 5));
        setLoadError(false);
      })
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const attentionCount = stats.changesNeeded;

  const activityIcon = (status: Activity['status']) => {
    if (status === 'approved') return <CheckCircle size={18} color={color('semantic/success')} weight="regular" />;
    if (status === 'rejected') return <XCircle size={18} color={color('semantic/danger')} weight="regular" />;
    return <CheckCircle size={18} color={color('semantic/success')} weight="fill" />;
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: color('bg/canvas') }]}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: space.md, paddingBottom: space['3xl'] }}
        showsVerticalScrollIndicator={false}
      >
        <Stagger delayMs={0}>
          <View style={{ marginTop: space.lg }}>
            <Text style={[type['type/h1'], { color: color('text/primary') }]}>
              {greeting()}, {user?.name || 'Teacher'}.
            </Text>
            {attentionCount > 0 ? (
              <Text style={[type['type/body-m'], { color: color('text/secondary'), marginTop: space['2xs'] }]}>
                {attentionCount} items need your attention
              </Text>
            ) : null}
          </View>
        </Stagger>

        {loadError ? (
          <View style={{ marginTop: space.md }}>
            <ErrorBanner onRetry={loadData} />
          </View>
        ) : null}

        <Stagger delayMs={80}>
          <View style={[styles.grid2, { gap: space.xs, marginTop: space.xl }]}>
            {loading ? (
              <>
                <SkeletonBlock height={92} radius={radius.md} style={{ width: tileWidth }} />
                <SkeletonBlock height={92} radius={radius.md} style={{ width: tileWidth }} />
                <SkeletonBlock height={92} radius={radius.md} style={{ width: tileWidth }} />
                <SkeletonBlock height={92} radius={radius.md} style={{ width: tileWidth }} />
              </>
            ) : (
              <>
                <StatusTile label="In Review" value={stats.inReview} token="semantic/warning" width={tileWidth} />
                <StatusTile label="Approved" value={stats.approved} token="semantic/success" outline width={tileWidth} />
                <StatusTile label="Live" value={stats.live} token="semantic/success" filled width={tileWidth} />
                <PulsingTile pulse={stats.changesNeeded > 0}>
                  <StatusTile label="Changes Needed" value={stats.changesNeeded} token="semantic/danger" width={tileWidth} />
                </PulsingTile>
              </>
            )}
          </View>
        </Stagger>

        <Stagger delayMs={160}>
          <View style={[styles.grid3, { gap: space.xs, marginTop: space.xl }]}>
            <QuickAction
              label="New Test"
              icon={<ClipboardText size={22} color={color('accent/default')} weight="duotone" />}
              onPress={() => router.push('/(teacher)/create-test')}
            />
            <QuickAction
              label="New Video"
              icon={<VideoCamera size={22} color={color('accent/default')} weight="duotone" />}
              onPress={() => router.push('/(teacher)/create-content')}
            />
            <QuickAction
              label="New Brain Hack"
              icon={<Lightbulb size={22} color={color('accent/default')} weight="duotone" />}
              onPress={() => router.push('/(teacher)/create-brain-hack')}
            />
          </View>
        </Stagger>


        <View style={{ marginTop: space.xl }}>
          <Text style={[type['type/overline'], { color: color('text/tertiary'), marginBottom: space.sm }]}>
            RECENT ACTIVITY
          </Text>
          {loading ? (
            <View style={{ gap: space.sm }}>
              <SkeletonBlock height={56} radius={radius.md} />
              <SkeletonBlock height={56} radius={radius.md} />
              <SkeletonBlock height={56} radius={radius.md} />
            </View>
          ) : (
            <View style={{ gap: space.sm }}>
              {recentActivity.map((a) => (
                <Pressable
                  key={a.id}
                  onPress={() =>
                    a.status === 'rejected'
                      ? router.push({ pathname: '/(teacher)/(tabs)/(content)/rejected-content-detail', params: { id: a.id } })
                      : router.push({ pathname: '/(teacher)/(tabs)/(content)/content-preview', params: { id: a.id } })
                  }
                  style={({ pressed }) => [
                    styles.activityRow,
                    { backgroundColor: color('bg/surface'), borderRadius: radius.md, padding: space.md, opacity: pressed ? 0.94 : 1 },
                    shadow(),
                  ]}
                >
                  {activityIcon(a.status)}
                  <Text style={[type['type/body-m'], { color: color('text/primary'), flex: 1, marginLeft: space.sm }]} numberOfLines={2}>
                    {a.text}
                  </Text>
                  <Text style={[type['type/caption'], { color: color('text/tertiary'), marginLeft: space.xs }]}>
                    {a.time}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatusTile({
  label,
  value,
  token,
  outline,
  filled,
  width,
}: {
  label: string;
  value: number;
  token: 'semantic/warning' | 'semantic/success' | 'semantic/danger';
  outline?: boolean;
  filled?: boolean;
  width: number;
}) {
  const { color, type, space, radius } = useTheme();
  return (
    <View
      style={[
        {
          width,
          minHeight: 92,
          justifyContent: 'center',
          backgroundColor: filled ? color(token) : color('bg/surface'),
          borderRadius: radius.md,
          padding: space.md,
          borderWidth: outline ? 1.5 : 0,
          borderColor: outline ? color(token) : 'transparent',
        },
      ]}
    >
      <Text
        style={[
          type['type/numeral-display'],
          { color: filled ? color('text/inverse') : color(token), fontSize: 30 },
        ]}
      >
        {value}
      </Text>
      <Text
        style={[
          type['type/body-m-medium'],
          { color: filled ? color('text/inverse') : color('text/secondary'), marginTop: 2 },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

function QuickAction({ label, icon, onPress }: { label: string; icon: React.ReactNode; onPress: () => void }) {
  const { color, type, space, radius } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.quickAction,
        { backgroundColor: color('bg/surface'), borderRadius: radius.md, padding: space.sm, opacity: pressed ? 0.92 : 1 },
        shadow(),
      ]}
    >
      {icon}
      <Text style={[type['type/caption'], { color: color('text/primary'), marginTop: space.xs, textAlign: 'center' }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  grid2: { flexDirection: 'row', flexWrap: 'wrap' },
  grid3: { flexDirection: 'row' },
  quickAction: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 76 },
  structureCard: { flexDirection: 'row', alignItems: 'center' },
  activityRow: { flexDirection: 'row', alignItems: 'center' },
});
