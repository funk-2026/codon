import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Bell, MagnifyingGlass } from 'phosphor-react-native';
import { useTheme } from '@/src/theme/ThemeProvider';
import { useAuth } from '@/src/auth/AuthContext';
import { useNotifications } from '@/src/queries/discover';
import { ROUTES } from '@/src/navigation/routes';

/**
 * The same corner on every student tab: Search, Notifications, and (on Home) the profile avatar.
 * `extra` is a tab's own control, placed to the left of these.
 */
export function TabHeaderActions({ size, avatar = false, extra }: { size: 'large' | 'small'; avatar?: boolean; extra?: ReactNode }) {
  const { color, type, space } = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const notifications = useNotifications('student');
  const unread = notifications.data?.pages[0]?.unread_count ?? 0;
  const d = size === 'large' ? 40 : 32;
  const icon = size === 'large' ? 22 : 18;
  const chip = { width: d, height: d, borderRadius: d / 2, alignItems: 'center', justifyContent: 'center' } as const;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
      {extra}
      <Pressable onPress={() => router.push(ROUTES.student.search)} hitSlop={space.xs} accessibilityRole="button" accessibilityLabel="Search" style={[chip, { backgroundColor: color('header/chip') }]}>
        <MagnifyingGlass size={icon} color={color('header/text')} weight="regular" />
      </Pressable>
      <Pressable
        onPress={() => router.push(ROUTES.student.notifications)}
        hitSlop={space.xs}
        accessibilityRole="button"
        accessibilityLabel={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
        style={[chip, { backgroundColor: color('header/chip') }]}
      >
        <Bell size={icon} color={color('header/text')} weight={unread > 0 ? 'fill' : 'regular'} />
        {unread > 0 ? <View style={{ position: 'absolute', top: 6, right: 7, width: 9, height: 9, borderRadius: 5, backgroundColor: color('semantic/danger') }} /> : null}
      </Pressable>
      {avatar ? (
        <Pressable onPress={() => router.push(ROUTES.student.profile)} hitSlop={space.xs} accessibilityRole="button" accessibilityLabel="Open profile" style={[chip, { backgroundColor: color('bg/surface') }]}>
          <Text style={[size === 'large' ? type['type/body-l'] : type['type/body-m-medium'], { color: color('accent/default'), fontWeight: '600' }]}>{(user?.name || 'A').charAt(0).toUpperCase()}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
