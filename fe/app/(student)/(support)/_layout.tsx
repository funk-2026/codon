import { Stack } from 'expo-router';
import { useStackScreenOptions } from '@/src/components/ThemedStack';

export default function StudentSupportStack() {
  const base = useStackScreenOptions();
  return (
    <Stack screenOptions={base}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="wellness-category" options={{ title: 'Wellness' }} />
      <Stack.Screen name="wellness-article" options={{ title: 'Article' }} />
      <Stack.Screen name="about-mmm" options={{ title: 'About MMM' }} />
    </Stack>
  );
}
