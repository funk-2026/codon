import React from 'react';
import { Text, View } from 'react-native';
import { UsersThree } from 'phosphor-react-native';
import { useTheme } from '@/src/theme/ThemeProvider';
import { useAuth } from '@/src/auth/AuthContext';

/**
 * Role UX (FE-2.19): teachers granted "manage all content" (Admin → Users)
 * see every teacher's work in their lists. Say so, so nobody wonders why
 * someone else's test is in "My content".
 */
export function ManageAllBanner({ what = 'content' }: { what?: string }) {
  const { color, type, space, radius } = useTheme();
  const { user } = useAuth();
  if (!user || user.role !== 'teacher' || !(user as { can_manage_all_content?: boolean }).can_manage_all_content) return null;
  return (
    <View
      accessible
      accessibilityLabel={`Platform-wide access: you are seeing every teacher's ${what}, not only yours.`}
      style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs, backgroundColor: color('accent/tint'), borderRadius: radius.md, padding: space.sm }}
    >
      <UsersThree size={18} color={color('accent/default')} />
      <Text style={[type['type/caption'], { color: color('text/primary'), flex: 1 }]}>
        Platform-wide access: you’re seeing every teacher’s {what}, not only yours.
      </Text>
    </View>
  );
}
