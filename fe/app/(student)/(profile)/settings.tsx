import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { CaretLeft, CaretRight } from 'phosphor-react-native';
import { SecondaryButton } from '@/src/components';
import { useTheme, type ThemePreference } from '@/src/theme/ThemeProvider';
import { useAuth } from '@/src/auth/AuthContext';

function GroupLabel({ label }: { label: string }) {
  const { color, type, space } = useTheme();
  return (
    <Text
      style={[type['type/overline'], { color: color('text/tertiary'), marginBottom: space.xs }]}
    >
      {label}
    </Text>
  );
}

function Row({
  label,
  caption,
  onPress,
  trailing,
}: {
  label: string;
  caption?: string;
  onPress?: () => void;
  trailing?: React.ReactNode;
}) {
  const { color, type, space, radius } = useTheme();
  const Wrapper = onPress ? Pressable : View;
  return (
    <Wrapper
      onPress={onPress}
      style={({ pressed }: { pressed?: boolean } = {}) => [
        {
          backgroundColor: color('bg/surface'),
          borderRadius: radius.md,
          padding: space.md,
          flexDirection: 'row',
          alignItems: 'center',
          opacity: pressed ? 0.9 : 1,
        },
      ]}
    >
      <View style={{ flex: 1 }}>
        <Text style={[type['type/body-l'], { color: color('text/primary') }]}>{label}</Text>
        {caption ? (
          <Text style={[type['type/caption'], { color: color('text/tertiary'), marginTop: 2 }]}>
            {caption}
          </Text>
        ) : null}
      </View>
      {trailing ?? (onPress ? <CaretRight size={18} color={color('text/tertiary')} /> : null)}
    </Wrapper>
  );
}

export default function SettingsRoute() {
  const { color, type, space, radius, preference, setPreference } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const auth = useAuth();
  const [soundEffects, setSoundEffects] = useState(true);
  const [notifications, setNotifications] = useState(true);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);

  const segments: { key: ThemePreference; label: string }[] = [
    { key: 'system', label: 'System' },
    { key: 'light', label: 'Light' },
    { key: 'dark', label: 'Dark' },
  ];

  const handleLogout = async () => {
    setLogoutConfirmOpen(false);
    await auth.signOut();
    router.replace('/phone-entry');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: color('bg/canvas') }]}>
      <View
        style={[styles.header, { paddingHorizontal: space.md, marginTop: space.lg, marginBottom: space.md }]}
      >
        <Pressable
          onPress={() => router.back()}
          hitSlop={space.xs}
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
        >
          <CaretLeft size={24} color={color('text/primary')} />
        </Pressable>
        <Text style={[type['type/h1'], { color: color('text/primary'), marginLeft: space.sm }]}>
          Settings
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: space.md, paddingBottom: space['3xl'] + insets.bottom }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ marginTop: space.xl }}>
          <GroupLabel label="Appearance" />
          <View
            style={[
              styles.row,
              { backgroundColor: color('bg/surface'), borderRadius: radius.md, padding: space.md },
            ]}
          >
            <Text style={[type['type/body-l'], { color: color('text/primary'), flex: 1 }]}>Theme</Text>
            <View
              style={[
                styles.segmented,
                { backgroundColor: color('bg/sunken'), borderRadius: radius.pill, padding: 3 },
              ]}
            >
              {segments.map((seg) => {
                const active = preference === seg.key;
                return (
                  <Pressable
                    key={seg.key}
                    onPress={() => setPreference(seg.key)}
                    style={[
                      styles.segment,
                      {
                        borderRadius: radius.pill,
                        backgroundColor: active ? color('accent/default') : 'transparent',
                        paddingHorizontal: space.sm,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        type['type/caption'],
                        { color: active ? color('accent/on-accent') : color('text/secondary') },
                      ]}
                    >
                      {seg.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>

        <View style={{ marginTop: space.lg }}>
          <GroupLabel label="Preferences" />
          <View style={{ gap: space.xs }}>
            <Row
              label="Sound Effects"
              trailing={
                <Switch
                  value={soundEffects}
                  onValueChange={setSoundEffects}
                  trackColor={{ false: color('border/strong'), true: color('accent/default') }}
                  thumbColor={color('bg/surface')}
                />
              }
            />
            <Row
              label="Notifications"
              caption="Coming soon"
              trailing={
                <Switch
                  value={notifications}
                  onValueChange={setNotifications}
                  trackColor={{ false: color('border/strong'), true: color('accent/default') }}
                  thumbColor={color('bg/surface')}
                />
              }
            />
          </View>
        </View>

        <View style={{ marginTop: space.lg }}>
          <GroupLabel label="Account" />
          <View style={{ gap: space.xs }}>
            <Row
              label="Change Course"
              onPress={() => router.push({ pathname: '/profile-setup' as any, params: { edit: '1' } })}
            />
            <Row
              label="Manage Devices"
              caption="2 active"
              onPress={() => router.push('/(student)/(profile)/manage-devices')}
            />
          </View>
        </View>

        <View style={{ marginTop: space.lg }}>
          <GroupLabel label="Support & Legal" />
          <View style={{ gap: space.xs }}>
            <Row label="Give Feedback" onPress={() => router.push('/(student)/(profile)/give-feedback')} />
            <Row label="Terms of Service" onPress={() => { }} />
            <Row label="Privacy Policy" onPress={() => { }} />
          </View>
        </View>

        <View style={{ marginTop: space['2xl'], alignItems: 'center' }}>
          <SecondaryButton
            label="Log Out"
            variant="danger"
            onPress={() => setLogoutConfirmOpen(true)}
            style={{ alignSelf: 'stretch' }}
          />
          <Text style={[type['type/caption'], { color: color('text/tertiary'), marginTop: space.md }]}>
            Codon v1.0.0
          </Text>
        </View>
      </ScrollView>

      <Modal visible={logoutConfirmOpen} transparent animationType="fade" onRequestClose={() => setLogoutConfirmOpen(false)}>
        <View style={[styles.scrim, { padding: space.lg }]}>
          <View
            style={[
              styles.modalCard,
              { backgroundColor: color('bg/surface'), borderRadius: radius.lg, padding: space.lg },
            ]}
          >
            <Text style={[type['type/h3'], { color: color('text/primary') }]}>Log out of Codon?</Text>
            <Text style={[type['type/body-m'], { color: color('text/secondary'), marginTop: space.xs }]}>
              You&apos;ll need your phone number and a new code to sign back in.
            </Text>
            <View style={{ gap: space.sm, marginTop: space.lg }}>
              <SecondaryButton label="Log Out" variant="danger" onPress={handleLogout} />
              <SecondaryButton label="Cancel" onPress={() => setLogoutConfirmOpen(false)} />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center' },
  segmented: { flexDirection: 'row' },
  segment: { minHeight: 28, alignItems: 'center', justifyContent: 'center' },
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  modalCard: { width: '100%', maxWidth: 400 },
});
