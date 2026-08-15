// DEV ONLY — remove when real auth exists
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, type Href } from 'expo-router';
import { useTheme } from '@/src/theme/ThemeProvider';
import { useAuth, type Role } from '@/src/auth/AuthContext';

const OPTIONS: { role: Role; label: string; href: Href }[] = [
  { role: 'student', label: 'Student', href: '/profile-setup' as Href },
  { role: 'teacher', label: 'Teacher', href: '/(teacher)/(home)' },
  { role: 'admin', label: 'Admin', href: '/(admin)/(home)' },
];

export default function PreviewModeRoute() {
  const { color, type, space, radius } = useTheme();
  const { signIn } = useAuth();
  const router = useRouter();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: color('bg/canvas') }]}>
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
                backgroundColor: pressed ? color('accent/pressed') : color('accent/default'),
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center' },
  button: { width: '100%', alignItems: 'center' },
});
