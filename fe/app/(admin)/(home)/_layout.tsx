import { Stack } from 'expo-router';
import { useStackScreenOptions } from '@/src/components/ThemedStack';

export default function AdminHomeStack() {
  const base = useStackScreenOptions();
  return (
    <Stack screenOptions={base}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="platform-settings" options={{ title: 'Platform Settings' }} />
      <Stack.Screen name="analytics-overview" options={{ title: 'Analytics' }} />
      <Stack.Screen name="manage-subjects" options={{ headerShown: false }} />
      <Stack.Screen name="course-structure" options={{ headerShown: false }} />
    </Stack>
  );
}
