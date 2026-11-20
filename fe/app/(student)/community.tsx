import { Linking, Pressable, ScrollView, Share, Text, View } from 'react-native';
import { FacebookLogo, InstagramLogo, PaperPlaneTilt, ShareNetwork, TelegramLogo, WhatsappLogo, YoutubeLogo } from 'phosphor-react-native';
import type { Icon } from 'phosphor-react-native';
import { PrimaryButton, Screen, ScreenHeader, useToast } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { usePublicConfig } from '@/src/config/PublicConfig';
import { shadow } from '@/src/theme/elevation';

const CHANNELS: { key: 'instagram' | 'youtube' | 'telegram' | 'whatsapp_channel' | 'facebook'; label: string; Icon: Icon }[] = [
  { key: 'instagram', label: 'Instagram', Icon: InstagramLogo },
  { key: 'youtube', label: 'YouTube', Icon: YoutubeLogo },
  { key: 'telegram', label: 'Telegram', Icon: TelegramLogo },
  { key: 'whatsapp_channel', label: 'WhatsApp channel', Icon: WhatsappLogo },
  { key: 'facebook', label: 'Facebook', Icon: FacebookLogo },
];

/** Follow Codon, and invite friends. Only the channels an admin has set are shown. */
export default function CommunityRoute() {
  const { color, type, space, radius } = useTheme();
  const { show } = useToast();
  const cfg = usePublicConfig();
  const links = CHANNELS.filter((c) => cfg?.social?.[c.key]);
  const shareUrl = cfg?.app?.share_url;

  const invite = async () => {
    try {
      await Share.share({ message: `I’m preparing with Codon. Join me: ${shareUrl}` });
    } catch {
      show('Couldn’t open sharing.', 'error');
    }
  };

  return (
    <Screen>
      <ScreenHeader title="Community and sharing" />
      <ScrollView contentContainerStyle={{ padding: space.md, gap: space.lg, paddingBottom: space['3xl'] }}>
        <View style={{ gap: space.xs }}>
          <Text style={[type['type/overline'], { color: color('text/tertiary') }]}>FOLLOW CODON</Text>
          {links.length === 0 ? (
            <Text style={[type['type/body-m'], { color: color('text/secondary') }]}>Our channels will be listed here soon.</Text>
          ) : links.map((c) => (
            <Pressable key={c.key} onPress={() => void Linking.openURL(cfg!.social![c.key])} accessibilityRole="link" style={({ pressed }) => [{ minHeight: 56, backgroundColor: color('bg/surface'), borderRadius: radius.md, padding: space.sm, flexDirection: 'row', alignItems: 'center', gap: space.sm, opacity: pressed ? 0.94 : 1 }, shadow()]}>
              <c.Icon size={26} color={color('accent/default')} weight="duotone" />
              <Text style={[type['type/body-l'], { color: color('text/primary'), flex: 1 }]}>{c.label}</Text>
              <PaperPlaneTilt size={18} color={color('text/tertiary')} />
            </Pressable>
          ))}
        </View>
        <View style={{ gap: space.xs }}>
          <Text style={[type['type/overline'], { color: color('text/tertiary') }]}>INVITE FRIENDS</Text>
          <View style={[{ backgroundColor: color('bg/surface'), borderRadius: radius.lg, padding: space.md, gap: space.sm }, shadow()]}>
            <ShareNetwork size={28} color={color('accent/default')} weight="duotone" />
            <Text style={[type['type/body-m'], { color: color('text/secondary') }]}>Share Codon on WhatsApp, by email, or in any other app.</Text>
            {shareUrl ? <PrimaryButton label="Invite friends" onPress={() => void invite()} /> : <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>The invite link will be available soon.</Text>}
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}
