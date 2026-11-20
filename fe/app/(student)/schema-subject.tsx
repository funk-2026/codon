import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CaretDown, CaretRight, ChartLineUp } from 'phosphor-react-native';
import { EmptyState, ErrorBanner, FilterPills, Screen, ScreenHeader, SecondaryButton, SegmentedControl, SkeletonBlock } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { shadow } from '@/src/theme/elevation';
import { chapterAsked, matchesStatus, sortTopics, statusCounts, STATUS_FILTERS, type StatusFilter } from '@/src/study/logic';
import { useSchema, useSchemaSort } from '@/src/study/useSchema';
import { TopicRow } from '@/src/study/TopicRow';
import { StatusBar } from '@/src/study/StatusBar';

/** A subject's chapters. Tapping a chapter opens its topics right below it; several can be open at once. Order and status filter work here too. */
export default function SchemaSubjectRoute() {
  const router = useRouter();
  const { color, type, space, radius } = useTheme();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const q = useSchema();
  const [sort, setSort] = useSchemaSort();
  const [status, setStatus] = useState<StatusFilter>('all');
  const [open, setOpen] = useState<string[]>([]);
  const subject = q.data?.subjects.find((s) => s.id === id);
  const filtering = status !== 'all';
  const chapters = (subject?.chapters ?? [])
    .map((c) => ({ c, topics: c.topics.filter((t) => matchesStatus(t, status)) }))
    .filter(({ topics }) => !filtering || topics.length > 0);

  return (
    <Screen>
      <ScreenHeader title={subject?.name ?? 'Schema'} />
      {subject ? (
        <View style={{ paddingHorizontal: space.md, marginTop: space.sm, gap: space.xs }}>
          <SegmentedControl options={[{ key: 'idx' as const, label: 'Syllabus order' }, { key: 'frq' as const, label: 'Most asked' }]} value={sort} onChange={setSort} />
        </View>
      ) : null}
      {subject ? <FilterPills options={STATUS_FILTERS} value={status} onChange={setStatus} /> : null}
      <ScrollView contentContainerStyle={{ padding: space.md, gap: space.sm, paddingBottom: space['3xl'] }}>
        {q.isPending ? (
          [0, 1, 2].map((i) => <SkeletonBlock key={i} height={88} radius={radius.lg} />)
        ) : q.isError ? (
          <ErrorBanner onRetry={() => void q.refetch()} />
        ) : !subject ? (
          <EmptyState icon={<ChartLineUp size={32} color={color('text/tertiary')} />} title="Subject not found" description="Go back and pick it again." action={<SecondaryButton label="Go back" onPress={() => router.back()} />} />
        ) : chapters.length === 0 ? (
          <EmptyState icon={<ChartLineUp size={32} color={color('text/tertiary')} />} title="Nothing here" description="No topics have this status." action={<SecondaryButton label="Show all" onPress={() => setStatus('all')} />} />
        ) : (
          chapters.map(({ c, topics }) => {
            const isOpen = filtering || open.includes(c.id);
            const counts = statusCounts(c.topics);
            const asked = chapterAsked(c);
            const rows = isOpen ? sortTopics(topics.map((topic) => ({ topic })), sort) : [];
            return (
              <View key={c.id} style={[{ backgroundColor: color('bg/surface'), borderRadius: radius.lg, overflow: 'hidden' }, shadow()]}>
                <Pressable
                  onPress={() => (filtering ? undefined : setOpen((o) => (isOpen ? o.filter((x) => x !== c.id) : [...o, c.id])))}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: isOpen }}
                  accessibilityLabel={`${c.name}. ${counts.confident} of ${c.topics.length} confident. ${asked} questions asked`}
                  style={{ padding: space.md, gap: space.xs }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                    <Text style={[type['type/h3'], { color: color('text/primary'), flex: 1 }]}>{c.name}</Text>
                    {filtering ? null : isOpen ? <CaretDown size={18} color={color('text/tertiary')} /> : <CaretRight size={18} color={color('text/tertiary')} />}
                  </View>
                  <StatusBar counts={counts} />
                  <Text style={[type['type/caption'], { color: color('text/secondary') }]}>
                    {counts.confident} of {c.topics.length} confident · {asked} {asked === 1 ? 'question' : 'questions'} asked
                  </Text>
                </Pressable>
                {isOpen ? (
                  <View style={{ paddingHorizontal: space.md, paddingBottom: space.xs, borderTopWidth: 1, borderTopColor: color('border/subtle') }}>
                    {rows.length === 0 ? <Text style={[type['type/caption'], { color: color('text/tertiary'), paddingVertical: space.sm }]}>No topics in this chapter yet.</Text> : null}
                    {rows.map((r) => <TopicRow key={r.topic.id} topic={r.topic} onStatus={q.setStatus} />)}
                  </View>
                ) : null}
              </View>
            );
          })
        )}
      </ScrollView>
    </Screen>
  );
}
