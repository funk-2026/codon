import { Stack } from 'expo-router';
import { useStackScreenOptions } from '@/src/components/ThemedStack';

export default function TeacherContentStack() {
  const base = useStackScreenOptions();
  return (
    <Stack screenOptions={base}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="content-preview" options={{ title: 'Preview' }} />
      <Stack.Screen name="rejected-content-detail" options={{ title: 'Rejected' }} />
    </Stack>
  );
}
