import { Stack } from 'expo-router';
import { useStackScreenOptions } from '@/src/components/ThemedStack';

// Keep the tab's hub under any screen opened from another tab (e.g. Home → Q Bank),
// so Back and re-tapping the tab land on the hub instead of a stranded screen.
export const unstable_settings = { initialRouteName: 'index' };

export default function StudentHomeStack() {
  const base = useStackScreenOptions();
  return (
    <Stack screenOptions={base}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="brain-hacks" options={{ title: 'Brain Hacks' }} />
      <Stack.Screen name="brain-hack-detail" options={{ title: 'Brain Hack' }} />
      <Stack.Screen name="explore" options={{ headerShown: false }} />
    </Stack>
  );
}
