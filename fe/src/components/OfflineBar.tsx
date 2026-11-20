import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Text, View } from 'react-native';
import { SafeAreaInsetsContext, useSafeAreaInsets } from 'react-native-safe-area-context';
import { WifiSlash } from 'phosphor-react-native';
import { useTheme } from '@/src/theme/ThemeProvider';
import { useIsOffline } from '@/src/net/network';

/**
 * Wraps the whole app. While the phone has no connection (and for a moment after it returns) a slim strip sits
 * above everything and pushes the screen down, so it never covers a header. The status-bar gap is absorbed by the
 * strip, so the screens below are told there is no top inset.
 */
export function OfflineFrame({ children }: { children: ReactNode }) {
  const { color, type, space } = useTheme();
  const insets = useSafeAreaInsets();
  const offline = useIsOffline();
  const [backOnline, setBackOnline] = useState(false);
  const wasOffline = useRef(false);

  useEffect(() => {
    if (offline) {
      wasOffline.current = true;
      return;
    }
    if (!wasOffline.current) return;
    wasOffline.current = false;
    const show = setTimeout(() => setBackOnline(true), 0);
    const hide = setTimeout(() => setBackOnline(false), 2500);
    return () => { clearTimeout(show); clearTimeout(hide); };
  }, [offline]);

  const visible = offline || backOnline;
  return (
    <View style={{ flex: 1 }}>
      {visible ? (
        <View
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          style={{ backgroundColor: offline ? color('semantic/danger') : color('semantic/success'), paddingTop: insets.top + space['2xs'], paddingBottom: space.xs, paddingHorizontal: space.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.xs }}
        >
          {offline ? <WifiSlash size={16} color={color('accent/on-accent')} weight="bold" /> : null}
          <Text style={[type['type/caption'], { color: color('accent/on-accent') }]}>{offline ? 'You’re offline. Saved content still works.' : 'Back online'}</Text>
        </View>
      ) : null}
      <SafeAreaInsetsContext.Provider value={visible ? { ...insets, top: 0 } : insets}>
        <View style={{ flex: 1 }}>{children}</View>
      </SafeAreaInsetsContext.Provider>
    </View>
  );
}
