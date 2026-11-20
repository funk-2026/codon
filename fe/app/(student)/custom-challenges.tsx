import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import { BottomSheet, EmptyState, ErrorBanner, InputField, PrimaryButton, Screen, ScreenHeader, SkeletonBlock, useToast, SecondaryButton } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { ApiError } from '@/src/api/client';
import { rememberCustomCode } from '@/src/api/attempts';
import { listChallenges, openByCode, type Marker, type OpenedModule } from '@/src/api/customTests';
import { useRefetchOnFocus } from '@/src/queries/useRefetchOnFocus';
import { ROUTES } from '@/src/navigation/routes';
import { shadow } from '@/src/theme/elevation';
import { usePullRefresh } from '@/src/components/PullRefresh';

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const day = (iso: string) => { const d = new Date(iso); return `${d.getDate()} ${MON[d.getMonth()]} ${d.getFullYear()}`; };

/** Challenges: enter a friend's code (or your own), then your test history with a marker on each row. */
export default function CustomChallengesRoute() {
  const { color, type, space, radius } = useTheme();
  const pull = usePullRefresh();
  const router = useRouter();
  const { show } = useToast();
  const params = useLocalSearchParams<{ code?: string }>();
  const [code, setCode] = useState(() => String(params.code ?? '').toUpperCase().slice(0, 8));
  const [found, setFound] = useState<OpenedModule | null>(null);
  const [all, setAll] = useState(false);
  const q = useQuery({ queryKey: ['custom-challenges'], queryFn: listChallenges });
  useRefetchOnFocus(() => void q.refetch());
  const open = useMutation({
    mutationFn: () => openByCode(code.trim()),
    onSuccess: (r) => { setFound(r); void q.refetch(); },
    onError: (e) => show(e instanceof ApiError && e.code === 'code_not_found' ? 'No custom module has that code.' : 'Couldn’t open that code. Try again.', 'error'),
  });
  const rows = q.data ?? [];
  const shown = all ? rows : rows.slice(0, 5);
  const dot = (m: Marker) => (
    <View accessible accessibilityLabel={m === 'green' ? 'Yours, attempted. Open for the leaderboard' : m === 'red' ? 'Shared with you' : 'Nobody has attempted it'} style={{ width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: m === 'white' ? color('border/strong') : color(m === 'green' ? 'semantic/success' : 'semantic/danger'), backgroundColor: m === 'white' ? 'transparent' : color(m === 'green' ? 'semantic/success' : 'semantic/danger') }} />
  );

  return (
    <Screen>
      <ScreenHeader title="Challenges" />
      <ScrollView refreshControl={pull.control} contentContainerStyle={{ padding: space.md, gap: space.md, paddingBottom: space['3xl'] }} keyboardShouldPersistTaps="handled">
        <View style={{ gap: space.xs }}>
          <InputField label="Enter a custom module code" value={code} onChangeText={(v) => setCode(v.toUpperCase())} autoCapitalize="characters" autoCorrect={false} placeholder="A friend’s or your own code" maxLength={8} />
          <PrimaryButton label="Open" onPress={() => open.mutate()} loading={open.isPending} disabled={code.trim().length < 6} />
        </View>
        <Text style={[type['type/h3'], { color: color('text/primary') }]}>Test history</Text>
        {q.isPending ? <SkeletonBlock height={72} radius={radius.lg} /> : q.isError ? <ErrorBanner onRetry={() => void q.refetch()} /> : rows.length === 0 ? (
          <EmptyState title="No modules yet" description="Modules you make, and modules friends share with you, appear here." action={<SecondaryButton label="Create a custom module" onPress={() => router.push(ROUTES.student.customModule)} />} />
        ) : (
          <>
            {shown.map((r) => (
              <Pressable key={r.test_id} onPress={() => router.push({ pathname: ROUTES.student.customBoard, params: { id: r.test_id } })} accessibilityRole="button" style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: color('bg/surface'), borderRadius: radius.md, padding: space.md, minHeight: 64, opacity: pressed ? 0.94 : 1 }, shadow()]}>
                <View style={{ flex: 1 }}>
                  <Text style={[type['type/body-m-medium'], { color: color('text/primary') }]} numberOfLines={1}>{r.title}</Text>
                  <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>{day(r.at)}{r.my_pct != null ? ` · ${r.my_pct}%` : ''}</Text>
                </View>
                {dot(r.marker)}
              </Pressable>
            ))}
            {rows.length > 5 && !all ? <Pressable onPress={() => setAll(true)} accessibilityRole="button" style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center' }}><Text style={[type['type/body-m-medium'], { color: color('accent/default') }]}>See more</Text></Pressable> : null}
            <View style={{ gap: 4 }}>
              <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>● green: yours and attempted. Open it to see the leaderboard</Text>
              <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>● red: shared with you</Text>
              <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>○ white: nobody has attempted it, so no leaderboard</Text>
            </View>
          </>
        )}
      </ScrollView>
      <BottomSheet visible={!!found} onClose={() => setFound(null)} title={found ? `Module code ${found.code}` : ''}>
        <View style={{ gap: space.sm, paddingBottom: space.md }}>
          <Text style={[type['type/body-m-medium'], { color: color('text/primary') }]}>{found?.title} · {found?.questions} MCQs</Text>
          <Text style={[type['type/body-m'], { color: color('text/secondary') }]}>First attempt counts for the leaderboard and percentage. A second attempt through the code shows your percentage at the end, but never changes the leaderboard or your percentage on record.</Text>
          <PrimaryButton label="Solve" onPress={() => { if (!found) return; rememberCustomCode(found.test_id, found.code); setFound(null); router.push({ pathname: ROUTES.student.testPreStart, params: { id: found.test_id } }); }} />
        </View>
      </BottomSheet>
    </Screen>
  );
}
