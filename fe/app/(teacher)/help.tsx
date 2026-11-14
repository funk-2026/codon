import { useState } from 'react';
import { Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { CaretDown, CaretRight, ChatCircleText, EnvelopeSimple, WhatsappLogo } from 'phosphor-react-native';
import { Screen, ScreenHeader } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { usePublicConfig } from '@/src/config/PublicConfig';
import { ROUTES } from '@/src/navigation/routes';
import { shadow } from '@/src/theme/elevation';

const GUIDE: { q: string; a: string }[] = [
  {
    q: 'What gets approved, and what comes back?',
    a: 'Reviewers check that answers are correct, the wording is clear, every question is tagged (subject, chapter, difficulty), images are readable, and nothing is copied from a paid source. A returned item shows the reviewer’s note on its screen and in your notifications. Fix it and resubmit with a short note on what you changed.',
  },
  {
    q: 'How long does review take?',
    a: 'When you send something for review the sheet shows how long reviews are taking right now. You get a notification when it is decided.',
  },
  {
    q: 'Can I choose when it goes live?',
    a: 'Yes. Once an item is approved, tap Publish and either publish now or pick a date and time (24-hour). You can change or cancel the schedule until it goes live.',
  },
  {
    q: 'I made a mistake after it went live',
    a: 'Fixing tags or difficulty on a question saves immediately. Changing wording, options or the answer creates a correction that an admin approves; students keep the old version until then. A live test’s title, timing and marking can’t be edited.',
  },
  {
    q: 'Can I reuse a test for the next mock?',
    a: 'Open the test, tap the ⋯ menu, then “Duplicate as a new draft”. All questions are copied; change what you need and submit it.',
  },
  {
    q: 'How do I add many questions at once?',
    a: 'Open a draft test, choose CSV import, and download the template. Fill one row per question, upload it, and read the check report before importing. Rows with problems are listed with the reason; nothing is imported until you confirm.',
  },
  {
    q: 'Videos: what format and size?',
    a: 'Upload on Wi-Fi and keep the app open until it says ready. A big upload can be resumed if it is interrupted. Processing takes a few minutes; you can publish once it shows as ready. Add lecture PDFs from the lesson’s own screen any time.',
  },
  {
    q: 'Can someone else take over my test or lesson?',
    a: 'Yes. Open it, tap ⋯, then “Hand over to another teacher” and enter their phone number. They become the owner and are notified.',
  },
];

/** What reviewers look for, how the review loop works, and who to ask. */
export default function TeacherHelpRoute() {
  const { color, type, space, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const support = usePublicConfig()?.support;
  const [open, setOpen] = useState<number | null>(null);

  const contact = (icon: React.ReactNode, label: string, onPress: () => void) => (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [{ backgroundColor: color('bg/surface'), borderRadius: radius.md, padding: space.sm, flexDirection: 'row', alignItems: 'center', gap: space.sm, opacity: pressed ? 0.94 : 1 }, shadow()]}
    >
      {icon}
      <Text style={[type['type/body-m-medium'], { color: color('text/primary'), flex: 1 }]}>{label}</Text>
      <CaretRight size={18} color={color('text/tertiary')} />
    </Pressable>
  );

  return (
    <Screen>
      <ScreenHeader title="Teacher guide" />
      <ScrollView contentContainerStyle={{ padding: space.md, gap: space.lg, paddingBottom: space['3xl'] + insets.bottom }} showsVerticalScrollIndicator={false}>
        <View style={{ gap: space.xs }}>
          <Text style={[type['type/overline'], { color: color('text/tertiary') }]}>HOW IT WORKS</Text>
          {GUIDE.map((f, i) => {
            const expanded = open === i;
            return (
              <View key={f.q} style={[{ backgroundColor: color('bg/surface'), borderRadius: radius.md, overflow: 'hidden' }, shadow()]}>
                <Pressable onPress={() => setOpen(expanded ? null : i)} accessibilityRole="button" accessibilityState={{ expanded }} style={{ padding: space.sm, minHeight: 52, flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={[type['type/body-m-medium'], { color: color('text/primary'), flex: 1 }]}>{f.q}</Text>
                  {expanded ? <CaretDown size={18} color={color('text/tertiary')} /> : <CaretRight size={18} color={color('text/tertiary')} />}
                </Pressable>
                {expanded ? <Text style={[type['type/body-m'], { color: color('text/secondary'), paddingHorizontal: space.sm, paddingBottom: space.sm }]}>{f.a}</Text> : null}
              </View>
            );
          })}
        </View>

        <View style={{ gap: space.xs }}>
          <Text style={[type['type/overline'], { color: color('text/tertiary') }]}>STILL STUCK?</Text>
          {support?.whatsapp ? contact(<WhatsappLogo size={24} color={color('semantic/success')} weight="fill" />, 'Chat on WhatsApp', () => void Linking.openURL(`https://wa.me/${support.whatsapp}`)) : null}
          {support?.email ? contact(<EnvelopeSimple size={24} color={color('accent/default')} />, `Email ${support.email}`, () => void Linking.openURL(`mailto:${support.email}`)) : null}
          {contact(<ChatCircleText size={24} color={color('accent/default')} />, 'Send us a message in the app', () => router.push(ROUTES.teacher.giveFeedback))}
        </View>
      </ScrollView>
    </Screen>
  );
}
