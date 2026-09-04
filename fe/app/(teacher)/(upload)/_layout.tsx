import { Stack } from 'expo-router';
import { useStackScreenOptions } from '@/src/components/ThemedStack';

export default function TeacherUploadStack() {
  const base = useStackScreenOptions();
  return (
    <Stack screenOptions={base}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      {/* Reachable both from this stack's own hub and as a direct deep link from
          Teacher Home — modal presentation means each opens self-contained and
          dismisses cleanly regardless of whatever this tab's stack already had
          in it from an earlier, unrelated visit. */}
      <Stack.Screen name="create-test" options={{ title: 'Create Test', presentation: 'modal' }} />
      <Stack.Screen name="question-builder" options={{ title: 'Question Builder' }} />
      <Stack.Screen name="csv-upload" options={{ title: 'CSV Bulk Upload' }} />
      <Stack.Screen name="csv-import-report" options={{ title: 'Import Report' }} />
      <Stack.Screen name="create-content" options={{ title: 'Create Content', presentation: 'modal' }} />
      <Stack.Screen name="create-brain-hack" options={{ title: 'Create Brain Hack', presentation: 'modal' }} />
    </Stack>
  );
}
