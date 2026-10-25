import { Stack } from 'expo-router';
import { useStackScreenOptions } from '@/src/components/ThemedStack';

// Keep the tab's hub under any screen opened from another tab (e.g. Home → Q Bank),
// so Back and re-tapping the tab land on the hub instead of a stranded screen.
export const unstable_settings = { initialRouteName: 'index' };

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
      <Stack.Screen name="bookmarks" options={{ headerShown: false }} />
      <Stack.Screen name="my-reports" options={{ headerShown: false }} />
      <Stack.Screen name="notifications" options={{ headerShown: false }} />
    </Stack>
  );
}
