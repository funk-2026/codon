import { Tabs } from 'expo-router';
import { House, Users, ClipboardText, CreditCard, User } from 'phosphor-react-native';
import { useTheme } from '@/src/theme/ThemeProvider';

export default function AdminTabLayout() {
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
      <Tabs.Screen
        name="(home)"
        options={{
          title: 'Home',
          tabBarIcon: ({ color: c, size, focused }) => (
            <House color={c} size={size} weight={focused ? 'fill' : 'regular'} />
          ),
        }}
      />
      <Tabs.Screen
        name="(users)"
        options={{
          title: 'Users',
          tabBarIcon: ({ color: c, size, focused }) => (
            <Users color={c} size={size} weight={focused ? 'fill' : 'regular'} />
          ),
        }}
      />
      <Tabs.Screen
        name="(review)"
        options={{
          title: 'Review',
          tabBarIcon: ({ color: c, size, focused }) => (
            <ClipboardText color={c} size={size} weight={focused ? 'fill' : 'regular'} />
          ),
        }}
      />
      <Tabs.Screen
        name="(payments)"
        options={{
          title: 'Payments',
          tabBarIcon: ({ color: c, size, focused }) => (
            <CreditCard color={c} size={size} weight={focused ? 'fill' : 'regular'} />
          ),
        }}
      />
      <Tabs.Screen
        name="(profile)"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color: c, size, focused }) => (
            <User color={c} size={size} weight={focused ? 'fill' : 'regular'} />
          ),
        }}
      />
    </Tabs>
  );
}
