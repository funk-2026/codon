import { useEffect, useState } from 'react';
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
import { SkeletonBlock } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';

type Activity = {
  id: string;
  status: 'approved' | 'rejected' | 'published';
  text: string;
  time: string;
};

const RECENT_ACTIVITY: Activity[] = [
  { id: 'a1', status: 'approved', text: 'Thermodynamics Full Test was approved', time: '2 hours ago' },
  { id: 'a2', status: 'rejected', text: 'Cell Biology — Intro Video needs changes', time: '5 hours ago' },
  { id: 'a3', status: 'published', text: 'The 2-minute recall trick is now live', time: '1 day ago' },
  { id: 'a4', status: 'approved', text: 'Optics Concept Check was approved', time: '2 days ago' },
  { id: 'a5', status: 'rejected', text: '[new] Zoology needs changes', time: '3 days ago' },
];

const IN_REVIEW = 3;
const APPROVED = 2;
const LIVE = 18;
const CHANGES_NEEDED = 2;

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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 450);
    return () => clearTimeout(t);
  }, []);

  const attentionCount = CHANGES_NEEDED;

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
              {greeting()}, Kavya Iyer.
            </Text>
            {attentionCount > 0 ? (
              <Text style={[type['type/body-m'], { color: color('text/secondary'), marginTop: space['2xs'] }]}>
                {attentionCount} items need your attention
              </Text>
            ) : null}
          </View>
        </Stagger>

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
                <StatusTile label="In Review" value={IN_REVIEW} token="semantic/warning" width={tileWidth} />
                <StatusTile label="Approved" value={APPROVED} token="semantic/success" outline width={tileWidth} />
                <StatusTile label="Live" value={LIVE} token="semantic/success" filled width={tileWidth} />
                <PulsingTile pulse={CHANGES_NEEDED > 0}>
                  <StatusTile label="Changes Needed" value={CHANGES_NEEDED} token="semantic/danger" width={tileWidth} />
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
              onPress={() => router.push('/(teacher)/(upload)/create-test')}
            />
            <QuickAction
              label="New Video"
              icon={<VideoCamera size={22} color={color('accent/default')} weight="duotone" />}
              onPress={() => router.push('/(teacher)/(upload)/create-content')}
            />
            <QuickAction
              label="New Brain Hack"
              icon={<Lightbulb size={22} color={color('accent/default')} weight="duotone" />}
              onPress={() => router.push('/(teacher)/(upload)/create-brain-hack')}
            />
          </View>
        </Stagger>

        <Stagger delayMs={240}>
          <Pressable
            onPress={() => router.push('/(teacher)/(home)/course-structure-manager')}
            style={({ pressed }) => [
              styles.structureCard,
              { backgroundColor: color('accent/tint'), borderRadius: radius.lg, padding: space.lg, marginTop: space.lg, opacity: pressed ? 0.94 : 1 },
            ]}
          >
            <TreeStructure size={28} color={color('accent/default')} weight="duotone" />
            <View style={{ flex: 1, marginLeft: space.md }}>
              <Text style={[type['type/h3'], { color: color('text/primary') }]}>Manage Course Structure</Text>
              <Text style={[type['type/caption'], { color: color('text/secondary'), marginTop: 2 }]}>
                Add subjects, chapters, and sub-chapters
              </Text>
            </View>
            <CaretRight size={20} color={color('accent/default')} />
          </Pressable>
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
              {RECENT_ACTIVITY.map((a) => (
                <Pressable
                  key={a.id}
                  onPress={() =>
                    a.status === 'rejected'
                      ? router.push({ pathname: '/(teacher)/(content)/rejected-content-detail', params: { id: a.id } })
                      : router.push({ pathname: '/(teacher)/(content)/content-preview', params: { id: a.id } })
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
