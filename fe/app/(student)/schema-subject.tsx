import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { CaretDown, CaretRight, ChartLineUp } from 'phosphor-react-native';
import { EmptyState, ErrorBanner, Screen, ScreenHeader, SkeletonBlock } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { shadow } from '@/src/theme/elevation';
import { chapterProgress, progressText, sortTopics } from '@/src/study/logic';
import { useSchema, useSchemaSort } from '@/src/study/useSchema';
import { TopicRow } from '@/src/study/TopicRow';

/** A subject's chapters. Tapping a chapter opens its topics right below it; several can be open at once. No filter or toggle here. */
export default function SchemaSubjectRoute() {
  const { color, type, space, radius } = useTheme();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const q = useSchema();
  const [sort] = useSchemaSort();
  const [open, setOpen] = useState<string[]>([]);
  const subject = q.data?.subjects.find((s) => s.id === id);

  return (
    <Screen>
      <ScreenHeader title={subject?.name ?? 'Schema'} />
      <ScrollView contentContainerStyle={{ padding: space.md, gap: space.sm, paddingBottom: space['3xl'] }}>
        {q.isPending ? (
          [0, 1, 2].map((i) => <SkeletonBlock key={i} height={64} radius={radius.lg} />)
        ) : q.isError ? (
          <ErrorBanner onRetry={() => void q.refetch()} />
        ) : !subject ? (
          <EmptyState icon={<ChartLineUp size={32} color={color('text/tertiary')} />} title="Subject not found" description="Go back and pick it again." />
        ) : (
          subject.chapters.map((c) => {
            const isOpen = open.includes(c.id);
            const rows = isOpen ? sortTopics(c.topics.map((topic) => ({ topic })), sort) : [];
            return (
              <View key={c.id} style={[{ backgroundColor: color('bg/surface'), borderRadius: radius.lg, overflow: 'hidden' }, shadow()]}>
                <Pressable onPress={() => setOpen((o) => (isOpen ? o.filter((x) => x !== c.id) : [...o, c.id]))} accessibilityRole="button" accessibilityState={{ expanded: isOpen }} style={{ minHeight: 64, flexDirection: 'row', alignItems: 'center', padding: space.md, gap: space.sm }}>
                  <View style={{ flex: 1 }}>
                    <Text style={[type['type/h3'], { color: color('text/primary') }]}>{c.name}</Text>
                    <Text style={[type['type/caption'], { color: color('semantic/success') }]}>{progressText(chapterProgress(c))}</Text>
                  </View>
                  {isOpen ? <CaretDown size={18} color={color('text/tertiary')} /> : <CaretRight size={18} color={color('text/tertiary')} />}
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
