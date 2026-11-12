// DEV ONLY — remove when real auth exists
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Redirect, useRouter, type Href } from 'expo-router';
import { useTheme } from '@/src/theme/ThemeProvider';
import { useAuth, type Role } from '@/src/auth/AuthContext';
import { ROUTES } from '@/src/navigation/routes';
import { Screen } from '@/src/components';

const OPTIONS: { role: Role; label: string; href: Href }[] = [
  { role: 'student', label: 'Student', href: ROUTES.auth.profileSetup as Href },
  { role: 'teacher', label: 'Teacher', href: ROUTES.teacher.home },
  { role: 'admin', label: 'Admin', href: ROUTES.admin.home },
];

export default function PreviewModeRoute() {
  const { color, type, space, radius } = useTheme();
  const { signIn } = useAuth();
  const router = useRouter();

  // Reachable by deep link regardless of the phone-entry UI — block it outright in production.
  if (!__DEV__) {
    return <Redirect href="/phone-entry" />;
  }

  return (
    <Screen>
      <View style={[styles.center, { padding: space.lg, gap: space.md }]}>
        <Text
          style={[
            type['type/h1'],
            { color: color('text/primary'), textAlign: 'center', marginBottom: space.lg },
          ]}
        >
          Who are you previewing as?
        </Text>
        {OPTIONS.map((opt) => (
          <Pressable
            key={opt.role}
            onPress={async () => {
              await signIn('preview-token', {
                id: 'preview',
                phone_number: '',
                role: opt.role,
                name: 'Preview User',
                kyc_status: 'none',
              });
              router.replace(opt.href);
            }}
            style={({ pressed }) => [
              styles.button,
              {
                backgroundColor: pressed ? color('action/primary-pressed') : color('action/primary'),
                borderRadius: radius.lg,
                paddingVertical: space.lg,
              },
            ]}
          >
            <Text style={[type['type/h3'], { color: color('accent/on-accent') }]}>
              {opt.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center' },
  button: { width: '100%', alignItems: 'center' },
});
