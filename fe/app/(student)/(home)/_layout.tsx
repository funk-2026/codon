import { Stack } from 'expo-router';
import { useStackScreenOptions } from '@/src/components/ThemedStack';

export default function StudentHomeStack() {
  const base = useStackScreenOptions();
  return (
    <Stack screenOptions={base}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="brain-hacks" options={{ title: 'Brain Hacks' }} />
      <Stack.Screen name="brain-hack-detail" options={{ title: 'Brain Hack' }} />
    </Stack>
  );
}
