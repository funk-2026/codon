import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { CheckSquare, Square } from 'phosphor-react-native';
import { BottomSheet, EmptyState, PrimaryButton, Screen, ScreenHeader, SkeletonBlock, TextButton } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { useAuth } from '@/src/auth/AuthContext';
import { getQBankOverview } from '@/src/api/qbank';
import { solvedLine } from '@/src/qbank/logic';
import { kvGet, kvSet } from '@/src/storage/kv';
import { ROUTES } from '@/src/navigation/routes';
import { shadow } from '@/src/theme/elevation';

const HIDE_KEY = 'qbank-notice-hidden';
const CONDITIONS = [
  'Each module can be solved only once.',
  'You get 2 minutes for every question.',
  'The timer also runs while you read the answer.',
  'Your result is saved on the chapter.',
  'To solve it again, reset the whole QBank from Edit Profile.',
];

/** A chapter's page: its MCQ count and SOLVE. A solved chapter opens its result instead of a new attempt. */
export default function QBankChapterRoute() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const { testId } = useLocalSearchParams<{ testId?: string }>();
  const q = useQuery({ queryKey: ['qbank-overview', user?.selected_course_id], queryFn: () => getQBankOverview(user?.selected_course_id ?? undefined) });
  const subject = q.data?.find((s) => s.modules.some((m) => m.test_id === testId));
  const m = subject?.modules.find((x) => x.test_id === testId);
  const [notice, setNotice] = useState(false);
  const [agree, setAgree] = useState(false);
  const [dontShow, setDontShow] = useState(false);
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    void kvGet<boolean>(HIDE_KEY, false).then(setHidden);
  }, []);

  const begin = () => router.push({ pathname: ROUTES.student.testQuestion, params: { id: String(testId) } });
  const solve = () => {
    if (!m) return;
    if (m.locked) return router.push(ROUTES.student.subscriptionPlans);
    if (m.state === 'completed' && m.attempt_id) return router.push({ pathname: ROUTES.student.testResult, params: { id: m.attempt_id, fromHistory: '1' } });
    if (m.state === 'paused' || hidden) return begin();
    setAgree(false);
    setDontShow(false);
    setNotice(true);
  };

  const label = !m ? '' : m.locked ? 'Unlock with a plan' : m.state === 'completed' ? 'Review' : m.state === 'paused' ? 'Resume' : 'Solve';

  return (
    <Screen>
      <ScreenHeader title={m?.chapter_name ?? 'QBank'} eyebrow={subject?.name} />
      <ScrollView contentContainerStyle={{ padding: space.md, gap: space.md }}>
        {q.isPending ? (
          <SkeletonBlock height={110} radius={radius.lg} />
        ) : !m ? (
          <EmptyState icon={<Square size={32} color={color('text/tertiary')} />} title="This chapter isn’t available" description="It may have been removed." action={<TextButton label="Back" onPress={() => router.back()} />} />
        ) : (
          <View style={[{ backgroundColor: color('bg/surface'), borderRadius: radius.lg, padding: space.lg, gap: space.sm }, shadow()]}>
            <Text style={[type['type/h2'], { color: color('text/primary') }]}>{m.mcq_count} MCQs</Text>
            <Text style={[type['type/body-m'], { color: color('text/secondary') }]}>
              {m.state === 'completed' ? `${solvedLine(m)}${m.score_pct != null ? `. You scored ${m.score_pct}%.` : ''}` : m.state === 'paused' ? 'You have started this one.' : 'Solve it now.'}
            </Text>
            <PrimaryButton label={label} onPress={solve} />
          </View>
        )}
      </ScrollView>

      <BottomSheet visible={notice} onClose={() => setNotice(false)} title="Before you start" maxHeightPct={0.9}>
        <View style={{ gap: space.sm, paddingBottom: space.lg }}>
          {CONDITIONS.map((c) => (
            <Text key={c} style={[type['type/body-m'], { color: color('text/secondary') }]}>• {c}</Text>
          ))}
          <Pressable onPress={() => setAgree((v) => !v)} accessibilityRole="checkbox" accessibilityState={{ checked: agree }} style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            {agree ? <CheckSquare size={24} color={color('accent/default')} weight="fill" /> : <Square size={24} color={color('text/tertiary')} />}
            <Text style={[type['type/body-m-medium'], { color: color('text/primary'), flex: 1 }]}>I agree to all the conditions</Text>
          </Pressable>
          <Pressable onPress={() => setDontShow((v) => !v)} accessibilityRole="checkbox" accessibilityState={{ checked: dontShow }} style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            {dontShow ? <CheckSquare size={24} color={color('accent/default')} weight="fill" /> : <Square size={24} color={color('text/tertiary')} />}
            <Text style={[type['type/body-m'], { color: color('text/secondary'), flex: 1 }]}>Do not show this again</Text>
          </Pressable>
          <PrimaryButton
            label="Start test"
            disabled={!agree}
            onPress={() => {
              if (dontShow) void kvSet(HIDE_KEY, true);
              setNotice(false);
              begin();
            }}
          />
        </View>
      </BottomSheet>
    </Screen>
  );
}
