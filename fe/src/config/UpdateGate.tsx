import { Linking, Platform, Pressable, Text, View } from 'react-native';
import Constants from 'expo-constants';
import { DownloadSimple } from 'phosphor-react-native';
import { useTheme } from '@/src/theme/ThemeProvider';
import { isOlderThan, usePublicConfig } from './PublicConfig';

/**
 * Blocks the app when the server says this build is too old (Platform settings → minimum app version).
 * Blank means no gate. If the config can't be read, the app opens normally: a network problem must
 * never lock students out.
 */
export function UpdateGate({ children }: { children: React.ReactNode }) {
  const cfg = usePublicConfig();
  const current = Constants.expoConfig?.version ?? '';
  if (!cfg || !isOlderThan(current, cfg.app.min_version)) return <>{children}</>;
  const url = Platform.OS === 'ios' ? cfg.app.store_url_ios : cfg.app.store_url_android;
  return <UpdateRequired url={url} />;
}

function UpdateRequired({ url }: { url: string }) {
  const { color, type, space, radius } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: color('bg/canvas'), alignItems: 'center', justifyContent: 'center', padding: space.xl, gap: space.md }}>
      <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: color('accent/tint'), alignItems: 'center', justifyContent: 'center' }}>
        <DownloadSimple size={36} color={color('accent/default')} weight="duotone" />
      </View>
      <Text style={[type['type/h1'], { color: color('text/primary'), textAlign: 'center' }]}>Please update the app</Text>
      <Text style={[type['type/body-m'], { color: color('text/secondary'), textAlign: 'center' }]}>
        This version is no longer supported. Update to keep practising and learning.
      </Text>
      {url ? (
        <Pressable
          onPress={() => void Linking.openURL(url)}
          accessibilityRole="button"
          style={({ pressed }) => ({ backgroundColor: pressed ? color('action/primary-pressed') : color('action/primary'), borderRadius: radius.pill, paddingHorizontal: space.xl, minHeight: 48, justifyContent: 'center' })}
        >
          <Text style={[type['type/body-m-medium'], { color: color('action/on-primary') }]}>Update now</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
