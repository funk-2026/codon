import { Stack } from 'expo-router';
import { useStackScreenOptions } from '@/src/components/ThemedStack';

export default function AdminReviewStack() {
  const base = useStackScreenOptions();
  return (
    <Stack screenOptions={base}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="kyc-queue" options={{ title: 'KYC Queue' }} />
      <Stack.Screen name="kyc-review-detail" options={{ title: 'KYC Review' }} />
      <Stack.Screen name="moderation-tests" options={{ title: 'Moderation — Tests' }} />
      <Stack.Screen
        name="moderation-videos-docs"
        options={{ title: 'Moderation — Videos/Docs' }}
      />
      <Stack.Screen name="content-preview-detail" options={{ title: 'Content Preview' }} />
    </Stack>
  );
}
