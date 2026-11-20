import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import Animated from 'react-native-reanimated';
import { CollapsingHeader, SearchBar, SegmentedControl, useCollapsingHeader } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { QBankPanel } from '@/src/qbank/QBankPanel';
import { QBankSearchSheet } from '@/src/qbank/QBankSearchSheet';
import { CustomTestsPanel } from '@/src/screens/CustomTestsPanel';
import { useFlag } from '@/src/config/AppConfigContext';
import { TabHeaderActions } from '@/src/components/TabHeaderActions';
import { usePullRefresh, RefreshPill } from '@/src/components/PullRefresh';

type Segment = 'qbank' | 'custom';

/** MCQs: the MCQs, and Custom Module when it is switched on. No stats card, recent tests or sort chips. */
export default function PracticeHubRoute() {
  const { color, type, space } = useTheme();
  const header = useCollapsingHeader(64);
  const pull = usePullRefresh(header.maxHeight);
  const params = useLocalSearchParams<{ kind?: string }>();
  const customOn = useFlag('custom_test.enabled');
  const [segment, setSegment] = useState<Segment>(params.kind === 'custom' ? 'custom' : 'qbank');
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <View style={[styles.container, { backgroundColor: color('bg/canvas') }]}>
      <CollapsingHeader
        state={header}
        expanded={
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <Text style={[type['type/h1'], { color: color('header/text') }]}>MCQs</Text>
              <Text style={[type['type/body-m'], { color: color('header/text-secondary'), marginTop: space['2xs'] }]}>Solve chapter by chapter</Text>
            </View>
            <TabHeaderActions size="large" />
          </View>
        }
        compact={<View style={{ flexDirection: 'row', alignItems: 'center' }}><Text style={[type['type/h3'], { color: color('header/text'), flex: 1 }]}>MCQs</Text><TabHeaderActions size="small" /></View>}
      />
      <Animated.ScrollView
        style={{ flex: 1 }}
        onScroll={header.onScroll}
        refreshControl={pull.control}
        scrollEventThrottle={16}
        scrollIndicatorInsets={{ top: header.minHeight }}
        contentContainerStyle={{ paddingHorizontal: space.md, paddingTop: header.maxHeight + space.md, paddingBottom: space['3xl'], gap: space.sm }}
        showsVerticalScrollIndicator={false}
      >
        {customOn ? <SegmentedControl options={[{ key: 'qbank' as const, label: 'QBank' }, { key: 'custom' as const, label: 'Custom Module' }]} value={segment} onChange={setSegment} /> : null}
        {segment === 'custom' && customOn ? (
          <CustomTestsPanel />
        ) : (
          <>
            <SearchBar placeholder="Search subjects and chapters" onPress={() => setSearchOpen(true)} />
            <QBankPanel />
          </>
        )}
      </Animated.ScrollView>
      <RefreshPill visible={pull.refreshing} top={header.maxHeight} />
      <QBankSearchSheet visible={searchOpen} onClose={() => setSearchOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({ container: { flex: 1 } });
