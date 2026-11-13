import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { SegmentedControl, Screen, TAB_EDGES } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { PaymentsView } from '@/src/admin/PaymentsView';
import { PlansView } from '@/src/admin/PlansView';

type PSegment = 'payments' | 'plans';

/** Money in one place: what was paid, and the plans people can buy. */
export default function AdminPaymentsRoute() {
  const { color, type, space } = useTheme();
  const params = useLocalSearchParams<{ segment?: string }>();
  const [segment, setSegment] = useState<PSegment>(params.segment === 'plans' ? 'plans' : 'payments');
  const [seenPlans, setSeenPlans] = useState(params.segment === 'plans');
  useEffect(() => {
    if (params.segment === 'plans' || params.segment === 'payments') {
      setSegment(params.segment);
      if (params.segment === 'plans') setSeenPlans(true);
    }
  }, [params.segment]);

  return (
    <Screen edges={TAB_EDGES}>
      <View style={{ paddingHorizontal: space.md, marginTop: space.lg }}>
        <Text style={[type['type/h1'], { color: color('text/primary') }]}>Payments</Text>
        <Text numberOfLines={1} style={[type['type/body-m'], { color: color('text/secondary'), marginTop: space['2xs'], minHeight: 22 }]}>
          {segment === 'payments' ? 'What students have paid' : 'The plans students can buy'}
        </Text>
      </View>
      <View style={{ paddingHorizontal: space.md, marginTop: space.md }}>
        <SegmentedControl
          options={[{ key: 'payments', label: 'Payments' }, { key: 'plans', label: 'Plans' }]}
          value={segment}
          onChange={(k) => { setSegment(k); if (k === 'plans') setSeenPlans(true); }}
        />
      </View>
      <View style={{ flex: 1, marginTop: space.xs }}>
        <View style={{ flex: 1, display: segment === 'payments' ? 'flex' : 'none' }}><PaymentsView /></View>
        {seenPlans ? <View style={{ flex: 1, display: segment === 'plans' ? 'flex' : 'none' }}><PlansView /></View> : null}
      </View>
    </Screen>
  );
}
