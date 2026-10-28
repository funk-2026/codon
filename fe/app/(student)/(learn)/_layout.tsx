import { Stack } from 'expo-router';
import { useStackScreenOptions } from '@/src/components/ThemedStack';

// Keep the tab's hub under any screen opened from another tab (e.g. Home → Q Bank),
// so Back and re-tapping the tab land on the hub instead of a stranded screen.
export const unstable_settings = { initialRouteName: 'index' };

export default function StudentLearnStack() {
  const base = useStackScreenOptions();
  return (
    <Stack screenOptions={base}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="hierarchy" options={{ title: 'Browse' }} />
      <Stack.Screen name="video-player" options={{ title: 'Video' }} />
      <Stack.Screen name="content-reader" options={{ title: 'Notes' }} />
      <Stack.Screen name="flashcards" options={{ headerShown: false }} />
      <Stack.Screen name="flashcard-study" options={{ headerShown: false }} />
    </Stack>
  );
}
