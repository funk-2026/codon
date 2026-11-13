import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { SegmentedControl, Screen, TAB_EDGES } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { ReportsInbox } from '@/src/moderation/ReportsInbox';
import { QuestionBankView } from '@/src/teacher/QuestionBankView';
import { CompletenessView } from '@/src/teacher/CompletenessView';
import { CorrectionsView } from '@/src/teacher/CorrectionsView';
import { useTeacherInbox } from '@/src/teacher/useTeacherInbox';
import { useRefetchOnFocus } from '@/src/queries/useRefetchOnFocus';

type QSegment = 'bank' | 'tags' | 'reports' | 'corrections';
const isSegment = (v?: string): v is QSegment => v === 'bank' || v === 'tags' || v === 'reports' || v === 'corrections';

/**
 * Everything about questions in one place: the bank, what still needs tagging, student reports
 * on my questions, and the status of my corrections. Each view mounts on first visit and stays,
 * so a search or a selection survives switching segments.
 */
export default function TeacherQuestionsRoute() {
  const { color, type, space } = useTheme();
  const params = useLocalSearchParams<{ segment?: string }>();
  const [segment, setSegment] = useState<QSegment>(isSegment(params.segment) ? params.segment : 'bank');
  const [visited, setVisited] = useState<Set<QSegment>>(() => new Set([isSegment(params.segment) ? params.segment : 'bank']));
  const go = (k: QSegment) => {
    setSegment(k);
    setVisited((v) => (v.has(k) ? v : new Set(v).add(k)));
  };

  // Home links here with a segment already chosen.
  useEffect(() => {
    if (isSegment(params.segment)) go(params.segment);
  }, [params.segment]);

  const inbox = useTeacherInbox();
  useRefetchOnFocus(() => inbox.refetch());
  const counts = inbox.data;

  const options: { key: QSegment; label: string; badge?: number }[] = [
    { key: 'bank', label: 'Bank' },
    { key: 'tags', label: 'Tags', badge: counts?.needsTags },
    { key: 'reports', label: 'Reports', badge: counts?.reports },
    { key: 'corrections', label: 'Fixes' },
  ];
  const show = (k: QSegment) => ({ flex: 1, display: segment === k ? ('flex' as const) : ('none' as const) });

  return (
    <Screen edges={TAB_EDGES}>
      <View style={{ paddingHorizontal: space.md, marginTop: space.lg }}>
        <Text style={[type['type/h1'], { color: color('text/primary') }]}>Questions</Text>
        <Text style={[type['type/body-m'], { color: color('text/secondary'), marginTop: space['2xs'] }]}>
          {segment === 'bank'
            ? 'Every question across your tests.'
            : segment === 'tags'
              ? 'Questions missing difficulty, tags or descriptions.'
              : segment === 'reports'
                ? 'Students flagging a problem with your questions.'
                : 'The status of fixes you made to live questions.'}
        </Text>
      </View>
      <View style={{ paddingHorizontal: space.md, marginTop: space.md }}>
        <SegmentedControl options={options} value={segment} onChange={go} />
      </View>
      <View style={{ flex: 1, marginTop: space.xs }}>
        {visited.has('bank') ? <View style={show('bank')}><QuestionBankView embedded /></View> : null}
        {visited.has('tags') ? <View style={show('tags')}><CompletenessView embedded /></View> : null}
        {visited.has('reports') ? <View style={show('reports')}><ReportsInbox role="teacher" embedded /></View> : null}
        {visited.has('corrections') ? <View style={show('corrections')}><CorrectionsView embedded /></View> : null}
      </View>
    </Screen>
  );
}
