import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Animated from 'react-native-reanimated';
import { PlayCircle, FileText, Cards, CaretRight } from 'phosphor-react-native';
import { useTheme } from '@/src/theme/ThemeProvider';
import { useRecentContent } from '@/src/queries/attempts';
import { useRefetchOnFocus } from '@/src/queries/useRefetchOnFocus';
import { CollapsingHeader, ErrorBanner, SegmentedControl, useCollapsingHeader } from '@/src/components';
import { CurriculumTree, TreeToolbar } from '@/src/screens/CurriculumTree';
import { ROUTES } from '@/src/navigation/routes';
import { shadow } from '@/src/theme/elevation';

type LearnSegment = 'video' | 'document' | 'flashcards';
const SEGMENTS: { key: LearnSegment; label: string }[] = [
  { key: 'video', label: 'Videos' },
  { key: 'document', label: 'Notes' },
  { key: 'flashcards', label: 'Flashcards' },
];
const TREE_SEGMENTS = ['video', 'document'] as const;
const initialSegment = (k?: string): LearnSegment => (k === 'document' || k === 'flashcards' ? k : 'video');

type RecentItem = {
  id: string;
  title: string;
  breadcrumb: string;
  kind: 'video' | 'document';
  pct: number;
};



export default function LearnHubRoute() {
  const { color, type, space, radius } = useTheme();
  const header = useCollapsingHeader(64);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ kind?: string }>();
  const [segment, setSegmentState] = useState<LearnSegment>(initialSegment(params.kind));
  const [visited, setVisited] = useState<Set<LearnSegment>>(() => new Set([initialSegment(params.kind)]));
  const setSegment = (k: LearnSegment) => {
    setSegmentState(k);
    setVisited((v) => (v.has(k) ? v : new Set(v).add(k)));
  };
  const [query, setQuery] = useState('');
  const isTree = segment !== 'flashcards';
  const recentQuery = useRecentContent();
  useRefetchOnFocus(recentQuery.refetch);
  const recent: RecentItem[] = recentQuery.data?.recent ?? [];
  const loading = recentQuery.isPending;
  const loadError = recentQuery.isError;
  const loadRecent = () => void recentQuery.refetch();
  const isNewUser = !loading && recent.length === 0;

  return (
    <View style={[styles.container, { backgroundColor: color('bg/canvas') }]}>
      <CollapsingHeader
        state={header}
        expanded={
          <View>
            <Text style={[type['type/h1'], { color: color('header/text') }]}>Learn</Text>
            <Text style={[type['type/body-m'], { color: color('header/text-secondary'), marginTop: space['2xs'] }]}>
              Video classes, notes and flashcards
            </Text>
          </View>
        }
        compact={<Text style={[type['type/h3'], { color: color('header/text') }]}>Learn</Text>}
      />
      <Animated.ScrollView
        style={{ flex: 1 }}
        onScroll={header.onScroll}
        scrollEventThrottle={16}
        scrollIndicatorInsets={{ top: header.minHeight }}
        contentContainerStyle={{ paddingHorizontal: space.md, paddingTop: header.maxHeight + space.md, paddingBottom: space['3xl'] + insets.bottom }}
        showsVerticalScrollIndicator={false}
      >
        {loadError ? (
          <View style={{ marginTop: space.md }}>
            <ErrorBanner onRetry={loadRecent} />
          </View>
        ) : null}

        <View style={{ marginTop: space.lg }}>
          <SegmentedControl options={SEGMENTS} value={segment} onChange={setSegment} />
          {/* Toolbar slot: same place and height on every segment, so nothing jumps when switching */}
          <View style={{ marginTop: space.md, minHeight: isTree ? undefined : 40, justifyContent: 'center' }}>
            {isTree ? (
              <TreeToolbar query={query} onQuery={setQuery} />
            ) : (
              <Text style={[type['type/caption'], { color: color('text/secondary') }]}>Flashcard decks for revision.</Text>
            )}
          </View>
          <View style={{ marginTop: space.md }}>
            {/* Each tree mounts on first visit and stays mounted, so open subjects survive switching segments */}
            {TREE_SEGMENTS.filter((k) => visited.has(k)).map((k) => (
              <View key={k} style={{ display: segment === k ? 'flex' : 'none' }}>
                <CurriculumTree kind={k} query={query} />
              </View>
            ))}
            {segment === 'flashcards' ? (
              <Pressable
                onPress={() => router.push(ROUTES.student.flashcards)}
                accessibilityRole="button"
                style={({ pressed }) => [{ backgroundColor: color('bg/surface'), borderRadius: radius.lg, padding: space.md, flexDirection: 'row', alignItems: 'center', gap: space.md, opacity: pressed ? 0.94 : 1 }, shadow()]}
              >
                <View style={{ width: 48, height: 48, backgroundColor: color('accent/tint'), borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' }}>
                  <Cards size={28} color={color('accent/default')} weight="duotone" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[type['type/h3'], { color: color('text/primary') }]}>Flashcard decks</Text>
                  <Text style={[type['type/body-m'], { color: color('text/secondary') }]}>Spaced-repetition review for quick recall.</Text>
                </View>
                <CaretRight size={20} color={color('text/tertiary')} />
              </Pressable>
            ) : null}
          </View>
        </View>

        {/* Recently Watched */}
        <View style={{ marginTop: space.xl }}>
          <View style={[styles.sectionRow, { marginBottom: space.sm }]}>
            <Text style={[type['type/overline'], { color: color('text/tertiary') }]}>
              RECENTLY WATCHED
            </Text>
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
              {recent.map((item) => (
                <Pressable
                  key={item.id}
                  onPress={() =>
                    router.push({
                      pathname:
                        item.kind === 'video'
                          ? ROUTES.student.videoPlayer
                          : ROUTES.student.contentReader,
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
      </Animated.ScrollView>
    </View>
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
