import { Share, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { SecondaryButton, useToast } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';

export function CodeCard({ code }: { code: string }) {
  const { color, type, space, radius } = useTheme();
  const { show } = useToast();
  return (
    <View style={{ backgroundColor: color('bg/sunken'), borderRadius: radius.lg, padding: space.md, gap: space.xs }}>
      <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>Code for this custom module</Text>
      <Text selectable style={[type['type/h2'], { color: color('text/primary'), letterSpacing: 2 }]}>{code}</Text>
      <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>Your peers can also solve this module using this code.</Text>
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <View style={{ flex: 1 }}><SecondaryButton label="COPY" onPress={() => void Clipboard.setStringAsync(code).then(() => show('Code copied', 'success'))} /></View>
        <View style={{ flex: 1 }}><SecondaryButton label="Share" onPress={() => void Share.share({ message: `Solve my Codon custom module. Enter this code in Challenges: ${code}` })} /></View>
      </View>
    </View>
  );
}
