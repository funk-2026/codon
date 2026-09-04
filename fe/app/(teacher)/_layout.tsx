import { Stack } from 'expo-router';
import { useStackScreenOptions } from '@/src/components/ThemedStack';

// The tab bar lives under (tabs). Everything below is a self-contained
// creation flow reachable both from the Upload tab's own hub and as a
// direct deep link from other tabs (e.g. Home's quick actions) — kept as
// root-level modals here, outside any single tab's own stack, so a deep
// link can never silently back-fill that tab's hub screen underneath it
// and turn one "back" into two.
export default function TeacherLayout() {
  const base = useStackScreenOptions();
  return (
    <Stack screenOptions={base}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="create-test" options={{ title: 'Create Test', presentation: 'modal' }} />
      <Stack.Screen name="question-builder" options={{ title: 'Question Builder' }} />
      <Stack.Screen name="csv-upload" options={{ title: 'CSV Bulk Upload' }} />
      <Stack.Screen name="csv-import-report" options={{ title: 'Import Report' }} />
      <Stack.Screen name="create-content" options={{ title: 'Create Content', presentation: 'modal' }} />
      <Stack.Screen name="create-brain-hack" options={{ title: 'Create Brain Hack', presentation: 'modal' }} />
    </Stack>
  );
}
