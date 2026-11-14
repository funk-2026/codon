import { Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useTheme } from '@/src/theme/ThemeProvider';
import { getReviewStats, getTeacherImpact } from '@/src/api/teacher';
import { describeWait } from './schedule';
import { shadow } from '@/src/theme/elevation';

/** What the teacher's live work has done for students, plus how long review is taking right now. */
export function ImpactCard() {
  const { color, type, space, radius } = useTheme();
  const impact = useQuery({ queryKey: ['teacher', 'impact'], queryFn: getTeacherImpact, staleTime: 5 * 60_000 });
  const review = useQuery({ queryKey: ['teacher', 'review-stats'], queryFn: getReviewStats, staleTime: 5 * 60_000 });
  const d = impact.data;
  if (!d) return null;
  const live = d.published_tests + d.published_lessons + d.published_hacks + d.published_decks;
  const wait = describeWait(review.data?.median_hours);
  if (live === 0) {
    return wait ? (
      <Text style={[type['type/caption'], { color: color('text/tertiary'), marginTop: space.lg }]}>Reviews are taking {wait} right now.</Text>
    ) : null;
  }
  const stats: { n: number; label: string }[] = [
    { n: d.test_students, label: 'students took your tests' },
    { n: d.test_attempts, label: 'test attempts' },
    { n: d.lesson_viewers, label: 'students opened your lessons' },
  ];
  return (
    <View style={{ marginTop: space.xl }}>
      <Text style={[type['type/overline'], { color: color('text/tertiary'), marginBottom: space.xs }]}>YOUR IMPACT</Text>
      <View style={[{ backgroundColor: color('bg/surface'), borderRadius: radius.md, padding: space.md, gap: space.sm }, shadow()]}>
        <Text style={[type['type/body-m'], { color: color('text/secondary') }]}>{live} live item{live === 1 ? '' : 's'} for students.</Text>
        <View style={{ flexDirection: 'row', gap: space.md }}>
          {stats.map((s) => (
            <View key={s.label} style={{ flex: 1 }}>
              <Text style={[type['type/h2'], { color: color('text/primary') }]}>{s.n}</Text>
              <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>{s.label}</Text>
            </View>
          ))}
        </View>
        {wait ? <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>Reviews are taking {wait} right now.</Text> : null}
      </View>
    </View>
  );
}
