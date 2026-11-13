import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { CaretRight, CheckCircle, Cards, ClipboardText, FileText, Lightbulb, PlayCircle, WarningCircle } from 'phosphor-react-native';
import { EmptyState, SkeletonBlock, TextButton } from '@/src/components';
import { TreeToolbar } from '@/src/screens/CurriculumTree';
import { useTheme } from '@/src/theme/ThemeProvider';
import { shadow } from '@/src/theme/elevation';
import { ROUTES } from '@/src/navigation/routes';
import { countByFilter, DETAIL_TYPE, filterReview, type ReviewFilter, type ReviewItem, type ReviewType } from './reviewItems';

const ICON: Record<ReviewType, React.ComponentType<{ size: number; color: string }>> = {
  Test: ClipboardText,
  Video: PlayCircle,
  Document: FileText,
  'Brain Hack': Lightbulb,
  Deck: Cards,
};

const TYPE_LABEL: Record<ReviewType, string> = { Test: 'Test', Video: 'Video', Document: 'Notes', 'Brain Hack': 'Brain Hack', Deck: 'Deck' };

/** Everything a teacher has submitted, in one list. Longest-waiting first. Every row opens the same review screen. */
export function ContentReviewView({ items, loading, error, onRetry }: { items: ReviewItem[]; loading: boolean; error: boolean; onRetry: () => void }) {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const [filter, setFilter] = useState<ReviewFilter>('all');
  const [query, setQuery] = useState('');

  const counts = useMemo(() => countByFilter(items), [items]);
  const chips: { key: ReviewFilter; label: string }[] = [
    { key: 'all', label: `All ${counts.all}` },
    { key: 'tests', label: `Tests ${counts.tests}` },
    { key: 'lessons', label: `Lessons ${counts.lessons}` },
    { key: 'hacks', label: `Hacks ${counts.hacks}` },
    { key: 'decks', label: `Decks ${counts.decks}` },
  ];
  const shown = useMemo(() => filterReview(items, filter, query), [items, filter, query]);

  const open = (i: ReviewItem) =>
    router.push({
      pathname: ROUTES.admin.contentPreviewDetail,
      params: {
        id: i.id,
        type: DETAIL_TYPE[i.type],
        title: i.title,
        breadcrumb: i.meta,
        teacher: i.author,
        submitted: i.submitted,
        ...(i.test
          ? {
              moduleType: i.test.moduleType,
              questionCount: String(i.test.questionCount),
              ...(i.test.durationMinutes ? { durationMinutes: String(i.test.durationMinutes) } : {}),
              marksCorrect: String(i.test.marksCorrect),
              marksWrong: String(i.test.marksWrong),
            }
          : {}),
      },
    });

  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: space.md, marginTop: space.xs }}>
        <TreeToolbar query={query} onQuery={setQuery} placeholder="Search by title or teacher" chips={{ options: chips, value: filter, onChange: (k) => setFilter(k as ReviewFilter) }} />
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: space.md, paddingTop: space.md, paddingBottom: space['3xl'], gap: space.xs }} showsVerticalScrollIndicator={false}>
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <SkeletonBlock key={i} height={72} radius={radius.md} />)
        ) : error ? (
          <EmptyState
            icon={<WarningCircle size={32} color={color('semantic/danger')} weight="fill" />}
            title="Couldn't load the queue"
            description="Something went wrong fetching what's waiting."
            action={<TextButton label="Retry" onPress={onRetry} />}
          />
        ) : items.length === 0 ? (
          <EmptyState icon={<CheckCircle size={32} color={color('semantic/success')} weight="fill" />} title="All clear" description="Nothing is waiting for approval." />
        ) : shown.length === 0 ? (
          <Text style={[type['type/body-m'], { color: color('text/secondary'), textAlign: 'center', marginTop: space.xl }]}>Nothing matches.</Text>
        ) : (
          shown.map((i) => {
            const Icon = ICON[i.type];
            return (
              <Pressable
                key={`${i.type}-${i.id}`}
                onPress={() => open(i)}
                accessibilityRole="button"
                accessibilityLabel={`${TYPE_LABEL[i.type]}: ${i.title}, by ${i.author}`}
                style={({ pressed }) => [
                  { backgroundColor: color('bg/surface'), borderRadius: radius.md, padding: space.sm, flexDirection: 'row', alignItems: 'center', opacity: pressed ? 0.94 : 1 },
                  shadow(),
                ]}
              >
                <View style={{ width: 40, height: 40, borderRadius: radius.sm, backgroundColor: color('accent/tint'), alignItems: 'center', justifyContent: 'center' }}>
                  <Icon size={22} color={color('accent/default')} />
                </View>
                <View style={{ flex: 1, marginLeft: space.sm }}>
                  <Text style={[type['type/h3'], { color: color('text/primary') }]} numberOfLines={2}>{i.title}</Text>
                  <Text style={[type['type/caption'], { color: color('text/tertiary'), marginTop: 2 }]} numberOfLines={1}>
                    {TYPE_LABEL[i.type]} · {i.meta}
                  </Text>
                  <Text style={[type['type/caption'], { color: color('text/tertiary') }]} numberOfLines={1}>
                    {i.author} · {i.submitted}
                  </Text>
                </View>
                <CaretRight size={18} color={color('text/tertiary')} />
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}
