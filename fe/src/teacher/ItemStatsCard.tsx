import { Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { SkeletonBlock } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { getContentStats, getTestStats } from '@/src/api/teacher';

function Stat({ value, label }: { value: string; label: string }) {
  const { color, type } = useTheme();
  return (
    <View style={{ flex: 1, minWidth: 90 }}>
      <Text style={[type['type/h3'], { color: color('text/primary') }]}>{value}</Text>
      <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>{label}</Text>
    </View>
  );
}

const pct = (n: number) => `${Math.round(n)}%`;

/** How a live test or lecture is doing with students. Shown on the item's own screen once it is live. */
export function ItemStatsCard({ kind, id }: { kind: 'test' | 'lesson'; id: string }) {
  return kind === 'test' ? <TestStatsBody id={id} /> : <LessonStatsBody id={id} />;
}

function useBox() {
  const { color, space, radius } = useTheme();
  return { backgroundColor: color('bg/surface'), borderRadius: radius.lg, padding: space.md, marginTop: space.md };
}

function TestStatsBody({ id }: { id: string }) {
  const { color, type, space, radius } = useTheme();
  const box = useBox();
  const q = useQuery({ queryKey: ['teacher', 'stats', 'test', id], queryFn: () => getTestStats(id), staleTime: 60_000 });
  if (q.isPending) return <SkeletonBlock height={90} radius={radius.lg} style={{ marginTop: space.md }} />;
  if (q.isError) return null;
  const d = q.data;
  return (
    <View style={box}>
      <Text style={[type['type/overline'], { color: color('text/tertiary') }]}>HOW IT IS DOING</Text>
      {d.started === 0 ? (
        <Text style={[type['type/body-m'], { color: color('text/secondary'), marginTop: space.xs }]}>No student has attempted it yet.</Text>
      ) : (
        <>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.md, marginTop: space.sm }}>
            <Stat value={String(d.students)} label="students" />
            <Stat value={String(d.submitted)} label="finished" />
            <Stat value={pct(d.completion_pct)} label="finish what they start" />
            <Stat value={pct(d.avg_percent)} label="average score" />
            <Stat value={`${Math.round(d.avg_minutes)} min`} label="average time" />
          </View>
          {d.hardest_questions.length > 0 ? (
            <Text style={[type['type/caption'], { color: color('text/secondary'), marginTop: space.sm }]}>
              Hardest: {d.hardest_questions.map((h) => `Q${h.position} (${pct(h.correct_pct)} right)`).join(', ')}
            </Text>
          ) : null}
        </>
      )}
    </View>
  );
}

function LessonStatsBody({ id }: { id: string }) {
  const { color, type, space, radius } = useTheme();
  const box = useBox();
  const q = useQuery({ queryKey: ['teacher', 'stats', 'lesson', id], queryFn: () => getContentStats(id), staleTime: 60_000 });
  if (q.isPending) return <SkeletonBlock height={90} radius={radius.lg} style={{ marginTop: space.md }} />;
  if (q.isError) return null;
  const d = q.data;
  return (
    <View style={box}>
      <Text style={[type['type/overline'], { color: color('text/tertiary') }]}>HOW IT IS DOING</Text>
      {d.viewers === 0 ? (
        <Text style={[type['type/body-m'], { color: color('text/secondary'), marginTop: space.xs }]}>No student has opened it yet.</Text>
      ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.md, marginTop: space.sm }}>
          <Stat value={String(d.viewers)} label="students" />
          <Stat value={pct(d.completion_pct)} label="finished it" />
          <Stat value={`${Math.round(d.avg_minutes_watched)} min`} label="average watched" />
        </View>
      )}
    </View>
  );
}
