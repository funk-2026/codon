import { Stack } from 'expo-router';
import { useStackScreenOptions } from '@/src/components/ThemedStack';

// The tab bar lives under (tabs). Everything below is either a
// self-contained creation flow or a preview/detail screen reachable from
// more than one tab (e.g. Home's Recent Activity as well as My Content's
// own list) — kept as root-level screens here, outside any single tab's
// own stack, so navigating into them from a different tab (or as a deep
// link) can never silently back-fill or reset that tab's own stack
// underneath them and turn one "back" into two (or into the wrong tab).
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
      <Stack.Screen name="content-preview" options={{ title: 'Preview' }} />
      <Stack.Screen name="rejected-content-detail" options={{ title: 'Rejected' }} />
    </Stack>
  );
}
