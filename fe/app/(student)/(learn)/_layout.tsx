import { Stack } from 'expo-router';
import { useStackScreenOptions } from '@/src/components/ThemedStack';

export default function StudentLearnStack() {
  const base = useStackScreenOptions();
  return (
    <Stack screenOptions={base}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="hierarchy" options={{ title: 'Browse' }} />
      <Stack.Screen name="video-player" options={{ title: 'Video' }} />
      <Stack.Screen name="content-reader" options={{ title: 'Notes' }} />
    </Stack>
  );
}
