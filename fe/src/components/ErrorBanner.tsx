import { Pressable, StyleProp, Text, View, ViewStyle } from 'react-native';
import { WarningCircle } from 'phosphor-react-native';
import { useTheme } from '@/src/theme/ThemeProvider';
import { useIsOffline } from '@/src/net/network';

export type ErrorBannerProps = {
  message?: string;
  /** Omit for a non-retryable notice. */
  onRetry?: () => void;
  style?: StyleProp<ViewStyle>;
};

// Inline error notice for dashboard-style screens where a failed load
// shouldn't blank the whole page — pairs with EmptyState, which is used
// instead when the failed fetch *is* the whole screen's content.
export function ErrorBanner({ message, onRetry, style }: ErrorBannerProps) {
  const { color, type, space, radius } = useTheme();
  const offline = useIsOffline();
  const text = offline ? 'You’re offline. Check your connection and try again.' : message ?? 'Couldn’t load the latest data. Try again.';

  return (
    <View
      accessibilityRole="alert"
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: color('bg/surface'),
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: color('border/subtle'),
          padding: space.sm,
          gap: space.sm,
        },
        style,
      ]}
    >
      <WarningCircle size={20} color={color('semantic/danger')} weight="fill" />
      <Text style={[type['type/body-m'], { color: color('text/primary'), flex: 1 }]}>
        {text}
      </Text>
      {onRetry ? (
        <Pressable onPress={onRetry} hitSlop={space.xs} accessibilityRole="button" accessibilityLabel="Retry" style={{ minHeight: 44, justifyContent: 'center' }}>
          <Text style={[type['type/body-m-medium'], { color: color('accent/default') }]}>
            Retry
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
