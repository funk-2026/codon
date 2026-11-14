import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { SegmentedControl, Screen, TAB_EDGES } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { ReportsInbox } from '@/src/moderation/ReportsInbox';
import { ContentReviewView } from '@/src/admin/ContentReviewView';
import { KycQueueView } from '@/src/admin/KycQueueView';
import { CorrectionsQueueView } from '@/src/admin/CorrectionsQueueView';
import { useAdminInbox } from '@/src/admin/useAdminInbox';
import { useRefetchOnFocus } from '@/src/queries/useRefetchOnFocus';

type RSegment = 'content' | 'kyc' | 'reports' | 'edits';
const isSegment = (v?: string): v is RSegment => v === 'content' || v === 'kyc' || v === 'reports' || v === 'edits';

const HELP: Record<RSegment, string> = {
  content: 'Tests, lessons, Brain Hacks and decks to approve',
  kyc: 'Identity documents to verify',
  reports: 'Students flagging a problem with a question',
  edits: 'Teachers’ changes to live questions',
};

/**
 * One inbox for everything waiting on an admin. Each segment mounts on first visit and stays,
 * and carries a count so nothing needs opening to know what's waiting.
 */
export default function AdminReviewRoute() {
  const { color, type, space } = useTheme();
  const params = useLocalSearchParams<{ segment?: string }>();
  const first: RSegment = isSegment(params.segment) ? params.segment : 'content';
  const [segment, setSegment] = useState<RSegment>(first);
  const [visited, setVisited] = useState<Set<RSegment>>(() => new Set([first]));
  const go = (k: RSegment) => {
    setSegment(k);
    setVisited((v) => (v.has(k) ? v : new Set(v).add(k)));
  };
  useEffect(() => {
    if (isSegment(params.segment)) go(params.segment);
  }, [params.segment]);

  const inbox = useAdminInbox();
  useRefetchOnFocus(() => inbox.refetch());
  const d = inbox.data;

  const options: { key: RSegment; label: string; badge?: number }[] = [
    { key: 'content', label: 'Content', badge: d?.items.length },
    { key: 'kyc', label: 'KYC', badge: d?.kyc },
    { key: 'reports', label: 'Reports', badge: d?.reports },
    { key: 'edits', label: 'Edits', badge: d?.edits },
  ];
  const show = (k: RSegment) => ({ flex: 1, display: segment === k ? ('flex' as const) : ('none' as const) });

  return (
    <Screen edges={TAB_EDGES}>
      <View style={{ paddingHorizontal: space.md, marginTop: space.lg }}>
        <Text style={[type['type/h1'], { color: color('text/primary') }]}>Review</Text>
        <Text numberOfLines={1} style={[type['type/body-m'], { color: color('text/secondary'), marginTop: space['2xs'], minHeight: 22 }]}>
          {HELP[segment]}
        </Text>
      </View>
      <View style={{ paddingHorizontal: space.md, marginTop: space.md }}>
        <SegmentedControl options={options} value={segment} onChange={go} />
      </View>
      <View style={{ flex: 1, marginTop: space.xs }}>
        {visited.has('content') ? (
          <View style={show('content')}>
            <ContentReviewView items={d?.items ?? []} loading={inbox.isPending} error={inbox.isError} onRetry={() => void inbox.refetch()} />
          </View>
        ) : null}
        {visited.has('kyc') ? <View style={show('kyc')}><KycQueueView /></View> : null}
        {visited.has('reports') ? <View style={show('reports')}><ReportsInbox role="admin" embedded /></View> : null}
        {visited.has('edits') ? <View style={show('edits')}><CorrectionsQueueView embedded /></View> : null}
      </View>
    </Screen>
  );
}
