import { Tabs } from 'expo-router';
import { House, Stack as StackIcon, UploadSimple, User } from 'phosphor-react-native';
import { useTheme } from '@/src/theme/ThemeProvider';

export default function TeacherTabLayout() {
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
        name="(content)"
        options={{
          title: 'My Content',
          tabBarIcon: ({ color: c, size, focused }) => (
            <StackIcon color={c} size={size} weight={focused ? 'fill' : 'regular'} />
          ),
        }}
      />
      <Tabs.Screen
        name="(upload)"
        options={{
          title: 'Upload',
          tabBarIcon: ({ color: c, size, focused }) => (
            <UploadSimple color={c} size={size} weight={focused ? 'fill' : 'regular'} />
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
