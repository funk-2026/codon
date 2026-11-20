import { Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { CollapsingHeader, SearchBar, useCollapsingHeader } from '@/src/components';
import { ROUTES } from '@/src/navigation/routes';
import { useTheme } from '@/src/theme/ThemeProvider';
import { BrainHackSection } from '@/src/brainhack/BrainHackSection';
import { TabHeaderActions } from '@/src/components/TabHeaderActions';
import { usePullRefresh, RefreshPill } from '@/src/components/PullRefresh';

/** Brain Hack: short videos, then short articles, each filtered on its own by All, Speed Reading, Fourth Book, Sleep or Breathing. */
export default function BrainHackTabRoute() {
  const { color, type, space } = useTheme();
  const router = useRouter();
  const header = useCollapsingHeader(64);
  const pull = usePullRefresh(header.maxHeight);
  return (
    <View style={{ flex: 1, backgroundColor: color('bg/canvas') }}>
      <CollapsingHeader
        state={header}
        expanded={
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <Text style={[type['type/h1'], { color: color('header/text') }]}>Brain Hack</Text>
              <Text style={[type['type/body-m'], { color: color('header/text-secondary'), marginTop: space['2xs'] }]}>Short, practical ways to study and rest better</Text>
            </View>
            <TabHeaderActions size="large" />
          </View>
        }
        compact={<View style={{ flexDirection: 'row', alignItems: 'center' }}><Text style={[type['type/h3'], { color: color('header/text'), flex: 1 }]}>Brain Hack</Text><TabHeaderActions size="small" /></View>}
      />
      <Animated.ScrollView
        style={{ flex: 1 }}
        onScroll={header.onScroll}
        refreshControl={pull.control}
        scrollEventThrottle={16}
        scrollIndicatorInsets={{ top: header.minHeight }}
        contentContainerStyle={{ paddingHorizontal: space.md, paddingTop: header.maxHeight + space.md, paddingBottom: space['3xl'], gap: space.lg }}
        showsVerticalScrollIndicator={false}
      >
        <SearchBar placeholder="Search Brain Hacks" onPress={() => router.push(ROUTES.student.search)} />
        <BrainHackSection kind="video" title="Videos" />
        <BrainHackSection kind="article" title="Articles" />
      </Animated.ScrollView>
      <RefreshPill visible={pull.refreshing} top={header.maxHeight} />
    </View>
  );
}
