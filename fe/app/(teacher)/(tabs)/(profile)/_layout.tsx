import { Stack } from 'expo-router';
import { useStackScreenOptions } from '@/src/components/ThemedStack';

export default function TeacherProfileStack() {
  const base = useStackScreenOptions();
  return (
    <Stack screenOptions={base}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="manage-devices" options={{ title: 'Manage Devices' }} />
      <Stack.Screen name="give-feedback" options={{ title: 'Give Feedback' }} />
    </Stack>
  );
}
