import { useRef, useState } from 'react';
import { ScrollView, Text, View, useWindowDimensions, type ScrollViewInstance } from 'react-native';
import { useRouter } from 'expo-router';
import { ChartLineUp, Exam, PlayCircle } from 'phosphor-react-native';
import { PrimaryButton, Screen, TextButton } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { kvSet } from '@/src/storage/kv';
import { ROUTES } from '@/src/navigation/routes';

export const INTRO_SEEN_KEY = 'intro-seen';

const SLIDES = [
  { Icon: Exam, title: 'Practise the way the exam tests you', text: 'Chapter-wise question banks, full-length test series and tests you build yourself.' },
  { Icon: PlayCircle, title: 'Learn at your own pace', text: 'Video classes, chapter notes and flashcards, and every lecture picks up where you left off.' },
  { Icon: ChartLineUp, title: 'See what to work on next', text: 'Your streak, your weak chapters and a countdown to your exam, all in one place.' },
];

/** Three short slides shown once, before the first sign-in. */
export default function OnboardingRoute() {
  const { color, type, space } = useTheme();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const scroll = useRef<ScrollViewInstance>(null);
  const [index, setIndex] = useState(0);
  const last = index === SLIDES.length - 1;

  const done = async () => {
    await kvSet(INTRO_SEEN_KEY, true);
    router.replace(ROUTES.auth.phoneEntry);
  };
  const next = () => {
    if (last) return void done();
    scroll.current?.scrollTo({ x: width * (index + 1), animated: true });
  };

  return (
    <Screen>
      <View style={{ alignItems: 'flex-end', paddingHorizontal: space.md, minHeight: 44 }}>
        {!last ? <TextButton label="Skip" onPress={() => void done()} /> : null}
      </View>
      <ScrollView
        ref={scroll}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
        style={{ flex: 1 }}
      >
        {SLIDES.map((s) => (
          <View key={s.title} style={{ width, paddingHorizontal: space.xl, alignItems: 'center', justifyContent: 'center', gap: space.md }}>
            <View style={{ width: 120, height: 120, borderRadius: 60, backgroundColor: color('accent/tint'), alignItems: 'center', justifyContent: 'center' }}>
              <s.Icon size={56} color={color('accent/default')} weight="duotone" />
            </View>
            <Text style={[type['type/h1'], { color: color('text/primary'), textAlign: 'center' }]}>{s.title}</Text>
            <Text style={[type['type/body-l'], { color: color('text/secondary'), textAlign: 'center' }]}>{s.text}</Text>
          </View>
        ))}
      </ScrollView>
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: space.xs, marginBottom: space.md }}>
        {SLIDES.map((s, i) => (
          <View key={s.title} style={{ width: i === index ? 22 : 8, height: 8, borderRadius: 4, backgroundColor: i === index ? color('accent/default') : color('border/strong') }} />
        ))}
      </View>
      <View style={{ paddingHorizontal: space.md, paddingBottom: space.lg }}>
        <PrimaryButton label={last ? 'Get started' : 'Next'} onPress={next} />
      </View>
    </Screen>
  );
}
