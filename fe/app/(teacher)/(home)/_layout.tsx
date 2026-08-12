import { Stack } from 'expo-router';
import { useStackScreenOptions } from '@/src/components/ThemedStack';

export default function TeacherHomeStack() {
  const base = useStackScreenOptions();
  return (
    <Stack screenOptions={base}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen
        name="course-structure-manager"
        options={{ title: 'Course Structure' }}
      />
    </Stack>
  );
}
