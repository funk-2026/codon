import { Stack } from 'expo-router';
import { useStackScreenOptions } from '@/src/components/ThemedStack';

export default function AdminUsersStack() {
  const base = useStackScreenOptions();
  return (
    <Stack screenOptions={base}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="users-list" options={{ title: 'Users List' }} />
      <Stack.Screen name="user-detail" options={{ title: 'User Detail' }} />
    </Stack>
  );
}
