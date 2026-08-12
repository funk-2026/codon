import { Tabs } from 'expo-router';
import { House, Exam, BookOpen, HandHeart, User } from 'phosphor-react-native';
import { useTheme } from '@/src/theme/ThemeProvider';

export default function StudentTabLayout() {
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
        name="(practice)"
        options={{
          title: 'Practice',
          tabBarIcon: ({ color: c, size, focused }) => (
            <Exam color={c} size={size} weight={focused ? 'fill' : 'regular'} />
          ),
        }}
      />
      <Tabs.Screen
        name="(learn)"
        options={{
          title: 'Learn',
          tabBarIcon: ({ color: c, size, focused }) => (
            <BookOpen color={c} size={size} weight={focused ? 'fill' : 'regular'} />
          ),
        }}
      />
      <Tabs.Screen
        name="(support)"
        options={{
          title: 'Support',
          tabBarIcon: ({ color: c, size, focused }) => (
            <HandHeart color={c} size={size} weight={focused ? 'fill' : 'regular'} />
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
