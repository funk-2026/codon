import { ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { ChartLineUp } from 'phosphor-react-native';
import { EmptyState, ErrorBanner, Screen, ScreenHeader, SkeletonBlock } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { getSchemaTopic } from '@/src/api/study';

/** An opened topic: total asked till now, the path, and a Year | Subtopic | Qs table, newest year first. */
export default function SchemaTopicRoute() {
  const { color, type, space, radius } = useTheme();
  const { id, years } = useLocalSearchParams<{ id?: string; years?: string }>();
  const q = useQuery({ queryKey: ['schema-topic', id], queryFn: () => getSchemaTopic(String(id)), enabled: !!id });
  const chosen = years ? years.split('|') : [];
  const d = q.data;
  const rows = d ? d.rows.filter((r) => chosen.length === 0 || chosen.includes(r.year)) : [];
  const total = rows.reduce((n, r) => n + r.questions, 0);
  const cell = { padding: space.sm, borderColor: color('border/strong'), borderWidth: 0.5 } as const;

  return (
    <Screen>
      <ScreenHeader title={d?.name ?? 'Topic'} />
      <ScrollView contentContainerStyle={{ padding: space.md, gap: space.sm, paddingBottom: space['3xl'] }}>
        {q.isPending ? (
          <SkeletonBlock height={160} radius={radius.lg} />
        ) : q.isError || !d ? (
          <ErrorBanner onRetry={() => void q.refetch()} />
        ) : (
          <>
            <Text style={[type['type/h3'], { color: color('text/primary') }]}>Total asked till now: {total} question{total === 1 ? '' : 's'}</Text>
            <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>{d.subject} &gt; {d.chapter}{chosen.length ? ` · only ${chosen.join(', ')}` : ''}</Text>
            {rows.length === 0 ? (
              <EmptyState icon={<ChartLineUp size={32} color={color('text/tertiary')} />} title="No questions recorded" description="This topic has no questions on file yet." />
            ) : (
              <View style={{ borderWidth: 0.5, borderColor: color('border/strong'), borderRadius: radius.sm, overflow: 'hidden', backgroundColor: color('bg/surface') }}>
                <View style={{ flexDirection: 'row', backgroundColor: color('bg/sunken') }}>
                  <Text style={[type['type/caption'], cell, { width: 86, color: color('text/secondary') }]}>Year</Text>
                  <Text style={[type['type/caption'], cell, { flex: 1, color: color('text/secondary') }]}>Subtopic</Text>
                  <Text style={[type['type/caption'], cell, { width: 48, color: color('text/secondary'), textAlign: 'right' }]}>Qs</Text>
                </View>
                {rows.map((r, i) => (
                  <View key={i} style={{ flexDirection: 'row' }}>
                    <Text style={[type['type/body-m'], cell, { width: 86, color: color('text/primary') }]}>{r.year}</Text>
                    <Text style={[type['type/body-m'], cell, { flex: 1, color: color('text/primary') }]}>{r.subtopic || `${d.name} (topic level)`}</Text>
                    <Text style={[type['type/body-m'], cell, { width: 48, color: color('text/primary'), textAlign: 'right' }]}>{r.questions}</Text>
                  </View>
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}
