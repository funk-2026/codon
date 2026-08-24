import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
} from '@expo-google-fonts/manrope';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { ThemeProvider } from '@/src/theme/ThemeProvider';
import { AuthProvider, useAuth } from '@/src/auth/AuthContext';
import { ToastProvider } from '@/src/components';
import { stackAnimation } from '@/src/components/ThemedStack';

SplashScreen.preventAutoHideAsync();

// Screens behind these guards are unmounted (not just hidden) once auth
// status flips, so an authenticated user can't back-navigate into the
// sign-in flow, and vice versa — no manual redirect-on-back-press needed.
function RootNavigator() {
  const auth = useAuth();

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
        <Stack.Screen name="(student)" />
        <Stack.Screen name="(teacher)" />
        <Stack.Screen name="(admin)" />
      </Stack.Protected>
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}

export default function RootLayout() {
  useFrameworkReady();

  const [fontsLoaded, fontError] = useFonts({
    'Manrope-Regular': Manrope_400Regular,
    'Manrope-Medium': Manrope_500Medium,
    'Manrope-SemiBold': Manrope_600SemiBold,
    'Manrope-Bold': Manrope_700Bold,
    'Manrope-ExtraBold': Manrope_800ExtraBold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <RootNavigator />
          <StatusBar style="auto" />
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
