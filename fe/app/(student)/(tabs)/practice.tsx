import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Animated from 'react-native-reanimated';
import { MagnifyingGlass } from 'phosphor-react-native';
import { CollapsingHeader, SegmentedControl, useCollapsingHeader } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { QBankPanel } from '@/src/qbank/QBankPanel';
import { QBankSearchSheet } from '@/src/qbank/QBankSearchSheet';
import { CustomTestsPanel } from '@/src/screens/CustomTestsPanel';
import { useFlag } from '@/src/config/AppConfigContext';
import { ROUTES } from '@/src/navigation/routes';

type Segment = 'qbank' | 'custom';

/** MCQs: the NEET UG QBank, and Custom Module when it is switched on. No stats card, recent tests or sort chips. */
export default function PracticeHubRoute() {
  const { color, type, space } = useTheme();
  const header = useCollapsingHeader(64);
  const router = useRouter();
  const params = useLocalSearchParams<{ kind?: string }>();
  const customOn = useFlag('custom_test.enabled');
  const [segment, setSegment] = useState<Segment>(params.kind === 'custom' ? 'custom' : 'qbank');
  const [searchOpen, setSearchOpen] = useState(false);

  const search = (
    <Pressable onPress={() => setSearchOpen(true)} accessibilityRole="button" accessibilityLabel="Search subjects and chapters" style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
      <MagnifyingGlass size={24} color={color('header/text')} />
    </Pressable>
  );

  return (
    <View style={[styles.container, { backgroundColor: color('bg/canvas') }]}>
      <CollapsingHeader
        state={header}
        expanded={
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <Text style={[type['type/h1'], { color: color('header/text') }]}>NEET UG QBank</Text>
              <Text style={[type['type/body-m'], { color: color('header/text-secondary'), marginTop: space['2xs'] }]}>Solve chapter by chapter</Text>
            </View>
            {search}
          </View>
        }
        compact={<View style={{ flexDirection: 'row', alignItems: 'center' }}><Text style={[type['type/h3'], { color: color('header/text'), flex: 1 }]}>NEET UG QBank</Text>{search}</View>}
      />
      <Animated.ScrollView
        style={{ flex: 1 }}
        onScroll={header.onScroll}
        scrollEventThrottle={16}
        scrollIndicatorInsets={{ top: header.minHeight }}
        contentContainerStyle={{ paddingHorizontal: space.md, paddingTop: header.maxHeight + space.md, paddingBottom: space['3xl'], gap: space.md }}
        showsVerticalScrollIndicator={false}
      >
        {customOn ? <SegmentedControl options={[{ key: 'qbank' as const, label: 'QBank' }, { key: 'custom' as const, label: 'Custom Module' }]} value={segment} onChange={setSegment} /> : null}
        {segment === 'custom' && customOn ? <CustomTestsPanel /> : <QBankPanel />}
      </Animated.ScrollView>
      <QBankSearchSheet visible={searchOpen} onClose={() => setSearchOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({ container: { flex: 1 } });
