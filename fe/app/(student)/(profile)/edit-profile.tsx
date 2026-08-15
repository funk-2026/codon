import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { CaretLeft, Camera, Lock, CaretRight } from 'phosphor-react-native';
import { InputField, TextButton, useToast } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { useAuth } from '@/src/auth/AuthContext';
import { updateMe } from '@/src/api/profile';

export default function EditProfileRoute() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { show } = useToast();

  const { user, refreshUser } = useAuth();
  
  const initialName = user?.name || '';
  const [name, setName] = useState(initialName);
  const [error, setError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);
  const dirty = name.trim() !== initialName;

  const handleSave = async () => {
    if (!dirty || saving) return;
    if (name.trim().length === 0) {
      setError('Name cannot be empty.');
      return;
    }
    setError(undefined);
    setSaving(true);
    try {
      await updateMe({ name: name.trim() });
      await refreshUser();
      show('Profile updated', 'success');
      router.back();
    } catch (err) {
      show('Failed to update profile.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: color('bg/canvas') }]}>
      <View
        style={[
          styles.header,
          { paddingHorizontal: space.md, marginTop: space.lg, marginBottom: space.md },
        ]}
      >
        <Pressable
          onPress={() => router.back()}
          hitSlop={space.xs}
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
        >
          <CaretLeft size={24} color={color('text/primary')} />
        </Pressable>
        <Text style={[type['type/h1'], { color: color('text/primary'), flex: 1, marginLeft: space.sm }]}>
          Edit Profile
        </Text>
        <TextButton
          label={saving ? 'Saving…' : 'Save'}
          onPress={handleSave}
          disabled={!dirty || saving}
        />
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: space.md,
          paddingBottom: space['3xl'] + insets.bottom,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ alignItems: 'center', marginTop: space.xl }}>
          <View style={{ position: 'relative' }}>
            <View
              style={[
                styles.avatar,
                { width: 96, height: 96, borderRadius: 48, backgroundColor: color('accent/tint') },
              ]}
            >
              <Text style={[type['type/display'], { color: color('accent/default'), fontSize: 32 }]}>
                AS
              </Text>
            </View>
            <Pressable
              hitSlop={space.xs}
              style={({ pressed }) => [
                styles.cameraBadge,
                {
                  backgroundColor: color('accent/default'),
                  borderColor: color('bg/canvas'),
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <Camera size={16} color={color('accent/on-accent')} weight="bold" />
            </Pressable>
          </View>
        </View>

        <View style={{ marginTop: space.xl, gap: space.lg }}>
          <InputField label="Full Name" value={name} onChangeText={setName} error={error} />

          <View>
            <Text
              style={[type['type/caption'], { color: color('text/secondary'), marginBottom: space['2xs'] }]}
            >
              Phone Number
            </Text>
            <View
              style={[
                styles.readOnlyRow,
                {
                  backgroundColor: color('bg/sunken'),
                  borderRadius: radius.sm,
                  paddingHorizontal: space.sm,
                  paddingVertical: space.sm,
                },
              ]}
            >
              <Text style={[type['type/body-l'], { color: color('text/primary'), flex: 1 }]}>
                +91 98XXXXXX10
              </Text>
              <Lock size={16} color={color('text/tertiary')} />
            </View>
            <Text
              style={[type['type/caption'], { color: color('text/tertiary'), marginTop: space['2xs'] }]}
            >
              Your phone number is your account ID and can&apos;t be changed here.
            </Text>
          </View>

          <Pressable
            onPress={() => router.push({ pathname: '/profile-setup' as any, params: { edit: '1' } })}
            style={({ pressed }) => [
              styles.readOnlyRow,
              {
                backgroundColor: color('bg/sunken'),
                borderRadius: radius.sm,
                paddingHorizontal: space.sm,
                paddingVertical: space.sm,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <Text style={[type['type/body-l'], { color: color('text/primary'), flex: 1 }]}>
              Course — NEET UG
            </Text>
            <CaretRight size={18} color={color('text/tertiary')} />
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center' },
  avatar: { alignItems: 'center', justifyContent: 'center' },
  cameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  readOnlyRow: { flexDirection: 'row', alignItems: 'center' },
});
