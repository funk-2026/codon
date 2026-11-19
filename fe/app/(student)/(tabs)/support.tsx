import { Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { CollapsingHeader, useCollapsingHeader } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { BrainHackSection } from '@/src/brainhack/BrainHackSection';

/** Brain Hack: short videos, then short articles, each filtered on its own by All, Speed Reading, Fourth Book, Sleep or Breathing. */
export default function BrainHackTabRoute() {
  const { color, type, space } = useTheme();
  const header = useCollapsingHeader(64);
  return (
    <View style={{ flex: 1, backgroundColor: color('bg/canvas') }}>
      <CollapsingHeader
        state={header}
        expanded={
          <View>
            <Text style={[type['type/h1'], { color: color('header/text') }]}>Brain Hack</Text>
            <Text style={[type['type/body-m'], { color: color('header/text-secondary'), marginTop: space['2xs'] }]}>Short, practical ways to study and rest better</Text>
          </View>
        }
        compact={<Text style={[type['type/h3'], { color: color('header/text') }]}>Brain Hack</Text>}
      />
      <Animated.ScrollView
        style={{ flex: 1 }}
        onScroll={header.onScroll}
        scrollEventThrottle={16}
        scrollIndicatorInsets={{ top: header.minHeight }}
        contentContainerStyle={{ paddingHorizontal: space.md, paddingTop: header.maxHeight + space.md, paddingBottom: space['3xl'], gap: space.xl }}
        showsVerticalScrollIndicator={false}
      >
        <BrainHackSection kind="video" title="Videos" />
        <BrainHackSection kind="article" title="Articles" />
      </Animated.ScrollView>
    </View>
  );
}
