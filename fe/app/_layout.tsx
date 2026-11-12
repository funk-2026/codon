import { useEffect } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient, wireAppStateFocus } from '@/src/queries/queryClient';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import {
  Figtree_400Regular,
  Figtree_500Medium,
  Figtree_600SemiBold,
  Figtree_700Bold,
  Figtree_800ExtraBold,
} from '@expo-google-fonts/figtree';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { ThemeProvider } from '@/src/theme/ThemeProvider';
import { AuthProvider, useAuth } from '@/src/auth/AuthContext';
import { AppConfigProvider } from '@/src/config/AppConfigContext';
import { BookmarksProvider } from '@/src/bookmarks/BookmarksContext';
import { PushProvider } from '@/src/notifications/PushProvider';
import { ToastProvider } from '@/src/components';
import { stackAnimation } from '@/src/components/ThemedStack';

SplashScreen.preventAutoHideAsync();

// Screens behind these guards are unmounted (not just hidden) once auth
// status flips, so an authenticated user can't back-navigate into the
// sign-in flow, and vice versa — no manual redirect-on-back-press needed.
function RootNavigator() {
  const auth = useAuth();
  const role = auth.status === 'authenticated' ? auth.user.role : null;

  // Signing out (or an expired session) must drop every cached response, so the next
  // user never sees the previous user's data.
  useEffect(() => {
    if (auth.status === 'unauthenticated') queryClient.clear();
  }, [auth.status]);

  return (
    <Stack screenOptions={{ headerShown: false, animation: stackAnimation }}>
      <Stack.Screen name="index" />
      <Stack.Protected guard={auth.status !== 'authenticated'}>
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="phone-entry" />
        <Stack.Screen name="otp-verify" />
        <Stack.Screen name="preview-mode" />
      </Stack.Protected>
      <Stack.Protected guard={auth.status === 'authenticated'}>
        <Stack.Screen name="profile-setup" />
        <Stack.Screen name="role-picker" />
      </Stack.Protected>
      {/* Role areas: admins can open every area (role picker), everyone else only their own. */}
      <Stack.Protected guard={role === 'student' || role === 'admin'}>
        <Stack.Screen name="(student)" />
      </Stack.Protected>
      <Stack.Protected guard={role === 'teacher' || role === 'admin'}>
        <Stack.Screen name="(teacher)" />
      </Stack.Protected>
      <Stack.Protected guard={role === 'admin'}>
        <Stack.Screen name="(admin)" />
      </Stack.Protected>
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}

export default function RootLayout() {
  useFrameworkReady();

  const [fontsLoaded, fontError] = useFonts({
    'Figtree-Regular': Figtree_400Regular,
    'Figtree-Medium': Figtree_500Medium,
    'Figtree-SemiBold': Figtree_600SemiBold,
    'Figtree-Bold': Figtree_700Bold,
    'Figtree-ExtraBold': Figtree_800ExtraBold,
  });

  useEffect(() => wireAppStateFocus(), []);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <AuthProvider>
        <AppConfigProvider>
          <BookmarksProvider>
            <PushProvider>
              <ToastProvider>
                <RootNavigator />
                <StatusBar style="dark" />
              </ToastProvider>
            </PushProvider>
          </BookmarksProvider>
        </AppConfigProvider>
      </AuthProvider>
    </ThemeProvider>
    </QueryClientProvider>
  );
}
