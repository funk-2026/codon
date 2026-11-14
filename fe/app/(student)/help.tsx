import { useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CaretDown, CaretRight, ChatCircleText, EnvelopeSimple, WhatsappLogo } from 'phosphor-react-native';
import { BottomSheet, InputField, PrimaryButton, Screen, ScreenHeader, useToast } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { usePublicConfig } from '@/src/config/PublicConfig';
import { submitFeedback } from '@/src/api/feedback';
import { ROUTES } from '@/src/navigation/routes';
import { shadow } from '@/src/theme/elevation';
import { track } from '@/src/analytics/track';

const FAQ: { q: string; a: string }[] = [
  {
    q: 'I paid but I don’t have access',
    a: 'Open Payments (Profile → Payments) and check the status. If it says captured but your plan isn’t active, tap “Report a payment problem” below and send us the order ID shown on that payment.',
  },
  {
    q: 'My answers didn’t save during a test',
    a: 'Answers are stored on your phone and sent as soon as you’re online. The test screen tells you how many are still waiting. Stay in the app until it says everything is saved, then submit.',
  },
  {
    q: 'Why is something locked?',
    a: 'Items with a lock need an active plan. Open Plans to see what’s included. Free items stay open without one.',
  },
  {
    q: 'How do I sign out of a phone I no longer use?',
    a: 'Go to Profile → Manage devices to see where you’re signed in, and sign out of any device from there.',
  },
  {
    q: 'How do I change my course?',
    a: 'Go to Profile → Settings → Change Course. Your progress is kept per test, but lists will show the new course.',
  },
  {
    q: 'How do I delete my account or get a copy of my data?',
    a: 'Both are in Profile → Settings: “Download my data” saves a copy, and “Delete account” removes your account.',
  },
];

/** Answers to the common questions, ways to reach us, and a direct line for payment problems. */
export default function HelpRoute() {
  const { color, type, space, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { show } = useToast();
  const support = usePublicConfig()?.support;
  const { order } = useLocalSearchParams<{ order?: string }>();
  const [open, setOpen] = useState<number | null>(null);
  const [payOpen, setPayOpen] = useState(!!order);
  const [message, setMessage] = useState(order ? `Order ID: ${order}\n` : '');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    track('help.opened');
  }, []);

  const contactRow = (icon: React.ReactNode, label: string, onPress: () => void) => (
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

  const sendPayment = async () => {
    setSending(true);
    try {
      await submitFeedback({ category: 'Payment problem', message });
      show('Sent. We’ll look into it.', 'success');
      setPayOpen(false);
    } catch {
      show('Couldn’t send. Try again.', 'error');
    } finally {
      setSending(false);
    }
  };

  return (
    <Screen>
      <ScreenHeader title="Help and support" />
      <ScrollView contentContainerStyle={{ padding: space.md, gap: space.lg, paddingBottom: space['3xl'] + insets.bottom }} showsVerticalScrollIndicator={false}>
        <View style={{ gap: space.xs }}>
          <Text style={[type['type/overline'], { color: color('text/tertiary') }]}>CONTACT US</Text>
          {support?.whatsapp ? contactRow(<WhatsappLogo size={24} color={color('semantic/success')} weight="fill" />, 'Chat on WhatsApp', () => void Linking.openURL(`https://wa.me/${support.whatsapp}`)) : null}
          {support?.email ? contactRow(<EnvelopeSimple size={24} color={color('accent/default')} />, `Email ${support.email}`, () => void Linking.openURL(`mailto:${support.email}`)) : null}
          {contactRow(<ChatCircleText size={24} color={color('accent/default')} />, 'Send us a message in the app', () => router.push(ROUTES.student.giveFeedback))}
          {contactRow(<ChatCircleText size={24} color={color('semantic/warning')} />, 'Report a payment problem', () => setPayOpen(true))}
        </View>

        <View style={{ gap: space.xs }}>
          <Text style={[type['type/overline'], { color: color('text/tertiary') }]}>COMMON QUESTIONS</Text>
          {FAQ.map((f, i) => {
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
      </ScrollView>

      <BottomSheet visible={payOpen} onClose={() => setPayOpen(false)} title="Report a payment problem" dismissable={!sending}>
        <View style={{ gap: space.md, paddingHorizontal: space.lg, paddingTop: space.sm }}>
          <Text style={[type['type/body-m'], { color: color('text/secondary') }]}>Tell us what happened. Include the order ID from Payments if you have it.</Text>
          <InputField label="What happened?" value={message} onChangeText={setMessage} multiline maxLength={1000} />
          <PrimaryButton label="Send" onPress={sendPayment} loading={sending} disabled={message.trim().length < 5} />
        </View>
      </BottomSheet>
    </Screen>
  );
}
