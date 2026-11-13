import { Tabs } from 'expo-router';
import type { Icon } from 'phosphor-react-native';
import { useTheme } from '@/src/theme/ThemeProvider';

export type TabSpec = {
  /** File name under `(tabs)/`, without extension. */
  name: string;
  title: string;
  Icon: Icon;
  /** A count shown on the tab icon when above zero. */
  badge?: number;
};

/**
 * The bottom tab bar shared by every role. Each tab is a single hub screen; every
 * screen opened from a hub lives one level up in the role's Stack, so the bar is
 * only ever visible on the hubs and slides away with the screen pushed over it.
 */
export function RoleTabs({ tabs }: { tabs: TabSpec[] }) {
  const { color, type } = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: color('accent/default'),
        tabBarInactiveTintColor: color('text/tertiary'),
        tabBarStyle: {
          backgroundColor: color('bg/surface'),
          borderTopColor: color('border/subtle'),
        },
        tabBarLabelStyle: type['type/caption'],
      }}
    >
      {tabs.map(({ name, title, Icon, badge }) => (
        <Tabs.Screen
          key={name}
          name={name}
          options={{
            title,
            tabBarBadge: badge && badge > 0 ? (badge > 99 ? '99+' : badge) : undefined,
            tabBarIcon: ({ color: c, size, focused }) => (
              <Icon color={c as string} size={size} weight={focused ? 'fill' : 'regular'} />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
