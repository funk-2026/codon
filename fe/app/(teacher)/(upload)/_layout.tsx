import { Stack } from 'expo-router';
import { useStackScreenOptions } from '@/src/components/ThemedStack';

export default function TeacherUploadStack() {
  const base = useStackScreenOptions();
  return (
    <Stack screenOptions={base}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="create-test" options={{ title: 'Create Test' }} />
      <Stack.Screen name="question-builder" options={{ title: 'Question Builder' }} />
      <Stack.Screen name="csv-upload" options={{ title: 'CSV Bulk Upload' }} />
      <Stack.Screen name="csv-import-report" options={{ title: 'Import Report' }} />
      <Stack.Screen name="create-content" options={{ title: 'Create Content' }} />
      <Stack.Screen name="create-brain-hack" options={{ title: 'Create Brain Hack' }} />
    </Stack>
  );
}
