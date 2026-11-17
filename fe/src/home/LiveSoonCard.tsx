import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Timer } from 'phosphor-react-native';
import { useTheme } from '@/src/theme/ThemeProvider';
import { useAuth } from '@/src/auth/AuthContext';
import { listExams } from '@/src/api/exams';
import { clockOffset, formatCountdown, withPhaseAt } from '@/src/exam/logic';
import { useServerNow } from '@/src/exam/useServerNow';
import { useRefetchOnFocus } from '@/src/queries/useRefetchOnFocus';
import { ROUTES } from '@/src/navigation/routes';
import { shadow } from '@/src/theme/elevation';

const DAY = 24 * 60 * 60 * 1000;

/** A live test that is open now or starts within 24 hours. Shows nothing otherwise, so Home stays calm. */
export function LiveSoonCard() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const courseId = user && 'selected_course_id' in user ? (user.selected_course_id as string | undefined) : undefined;
  const q = useQuery({ queryKey: ['exams', courseId ?? 'all'], queryFn: () => listExams(courseId) });
  useRefetchOnFocus(() => void q.refetch());
  const [receivedAt] = useState(() => Date.now());
  const offset = useMemo(() => (q.data ? clockOffset(q.data.server_now, receivedAt) : 0), [q.data, receivedAt]);
  const now = useServerNow(offset, !!q.data);
  const tests = useMemo(() => withPhaseAt(q.data?.tests ?? [], now), [q.data, now]);

  const pick = tests
    .filter((c) => c.delivery === 'live' && !c.my_attempt && (c.phase === 'live' || (c.phase === 'upcoming' && c.opens_at && new Date(c.opens_at).getTime() - now <= DAY)))
    .sort((a, b) => new Date(a.opens_at ?? 0).getTime() - new Date(b.opens_at ?? 0).getTime())[0];
  if (!pick) return null;

  const opens = pick.opens_at ? new Date(pick.opens_at).getTime() : now;
  const live = pick.phase === 'live';
  return (
    <Pressable
      onPress={() => router.push(ROUTES.student.tests)}
      accessibilityRole="button"
      accessibilityLabel={`${pick.title}. ${live ? 'Live now' : `Starts in ${formatCountdown(opens - now)}`}`}
      style={({ pressed }) => [{ marginTop: space.xl, flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: live ? color('semantic/success-tint') : color('accent/tint'), borderRadius: radius.lg, padding: space.md, opacity: pressed ? 0.94 : 1 }, shadow()]}
    >
      <Timer size={28} color={live ? color('semantic/success') : color('accent/default')} weight="duotone" />
      <View style={{ flex: 1 }}>
        <Text style={[type['type/overline'], { color: color('text/tertiary') }]}>{live ? 'LIVE NOW' : 'LIVE TEST'}</Text>
        <Text style={[type['type/h3'], { color: color('text/primary') }]} numberOfLines={1}>{pick.title}</Text>
        <Text style={[type['type/caption'], { color: color('text/secondary') }]}>{live ? 'You can still start' : `Starts in ${formatCountdown(opens - now)}`}</Text>
      </View>
    </Pressable>
  );
}
