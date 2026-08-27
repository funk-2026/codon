import { Stack } from 'expo-router';
import { useStackScreenOptions } from '@/src/components/ThemedStack';

export default function AdminPaymentsStack() {
  const base = useStackScreenOptions();
  return (
    <Stack screenOptions={base}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="payments-list" options={{ title: 'Payments List' }} />
      <Stack.Screen name="payment-detail" options={{ title: 'Payment Detail' }} />
      <Stack.Screen name="subscription-plan-list" options={{ title: 'Subscription Plans' }} />
      <Stack.Screen name="subscription-plan-edit" options={{ title: 'Edit Plan' }} />
    </Stack>
  );
}
