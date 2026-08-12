import { Stack } from 'expo-router';
import { useStackScreenOptions } from '@/src/components/ThemedStack';

export default function StudentProfileStack() {
  const base = useStackScreenOptions();
  return (
    <Stack screenOptions={base}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="edit-profile" options={{ title: 'Edit Profile' }} />
      <Stack.Screen name="settings" options={{ title: 'Settings' }} />
      <Stack.Screen name="manage-devices" options={{ title: 'Manage Devices' }} />
      <Stack.Screen name="give-feedback" options={{ title: 'Give Feedback' }} />
      <Stack.Screen name="subscription-plans" options={{ title: 'Subscription Plans' }} />
      <Stack.Screen name="checkout" options={{ title: 'Checkout' }} />
      <Stack.Screen name="payment-success" options={{ title: 'Payment Success' }} />
      <Stack.Screen name="payment-failed" options={{ title: 'Payment Failed' }} />
      <Stack.Screen name="kyc-submission" options={{ title: 'KYC Submission' }} />
      <Stack.Screen name="kyc-status" options={{ title: 'KYC Status' }} />
      <Stack.Screen name="progress-detail" options={{ title: 'Progress' }} />
    </Stack>
  );
}
