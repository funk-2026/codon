import { Stack } from 'expo-router';
import { useStackScreenOptions } from '@/src/components/ThemedStack';

export default function StudentPracticeStack() {
  const base = useStackScreenOptions();
  return (
    <Stack screenOptions={base}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="hierarchy" options={{ title: 'Browse' }} />
      <Stack.Screen name="test-pre-start" options={{ title: 'Test' }} />
      <Stack.Screen name="test-question" options={{ title: 'Question' }} />
      <Stack.Screen
        name="test-submit-confirm"
        options={{ presentation: 'modal', title: 'Submit Test' }}
      />
      <Stack.Screen name="test-result" options={{ title: 'Result' }} />
      <Stack.Screen name="test-review" options={{ title: 'Review' }} />
      <Stack.Screen name="test-history" options={{ title: 'Test History' }} />
    </Stack>
  );
}
