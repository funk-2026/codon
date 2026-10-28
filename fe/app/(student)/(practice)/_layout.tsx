import { Stack } from 'expo-router';
import { useStackScreenOptions } from '@/src/components/ThemedStack';

// Keep the tab's hub under any screen opened from another tab (e.g. Home → Q Bank),
// so Back and re-tapping the tab land on the hub instead of a stranded screen.
export const unstable_settings = { initialRouteName: 'index' };

export default function StudentPracticeStack() {
  const base = useStackScreenOptions();
  return (
    <Stack screenOptions={base}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="hierarchy" options={{ title: 'Browse' }} />
      <Stack.Screen name="test-pre-start" options={{ title: 'Test' }} />
      <Stack.Screen name="test-question" options={{ title: 'Question' }} />
      <Stack.Screen name="test-result" options={{ title: 'Result' }} />
      <Stack.Screen name="test-review" options={{ title: 'Review' }} />
      <Stack.Screen name="test-history" options={{ title: 'Test History' }} />
      <Stack.Screen name="custom-builder" options={{ headerShown: false }} />
      <Stack.Screen name="custom-tests" options={{ headerShown: false }} />
    </Stack>
  );
}
