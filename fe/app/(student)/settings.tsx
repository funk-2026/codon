import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { CaretRight } from 'phosphor-react-native';
import * as SecureStore from 'expo-secure-store';
import { SecondaryButton, SegmentedControl, useToast, ScreenHeader, Screen, ConfirmDialog } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { useAuth } from '@/src/auth/AuthContext';
import { deleteAccount } from '@/src/api/profile';
import { usePush } from '@/src/notifications/PushProvider';
import { ReminderRow } from '@/src/notifications/PracticeReminderRow';
import { getVibrateOnWrong, setVibrateOnWrong } from '@/src/settings/feedbackPrefs';
import { pushStatusCopy } from '@/src/notifications/logic';
import { ROUTES } from '@/src/navigation/routes';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { apiFetch } from '@/src/api/client';
import { useOpenRolePicker } from '@/src/navigation/useOpenRolePicker';

const SOUND_EFFECTS_KEY = 'codon_pref_sound_effects';

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
  const openRolePicker = useOpenRolePicker();

  const auth = useAuth();
  const { show } = useToast();
  const [vibrate, setVibrate] = useState(true);
  useEffect(() => {
    void getVibrateOnWrong().then(setVibrate);
  }, []);
  const changeVibrate = (v: boolean) => {
    setVibrate(v);
    void setVibrateOnWrong(v);
  };
  const switchRole = async () => {
    const { clearAdminActiveRole } = await import('@/src/auth/tokenStore');
    await clearAdminActiveRole();
    openRolePicker();
  };
  const [exporting, setExporting] = useState(false);
  // A copy of the student's own data (profile, plans, payments, tests) as a JSON file to save or share.
  const exportData = async () => {
    setExporting(true);
    try {
      const data = await apiFetch<unknown>('/me/export');
      const uri = `${FileSystem.cacheDirectory}my-codon-data.json`;
      await FileSystem.writeAsStringAsync(uri, JSON.stringify(data, null, 2), { encoding: FileSystem.EncodingType.UTF8 });
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: 'application/json', dialogTitle: 'My Codon data' });
      else show('Sharing isn’t available on this device.', 'error');
    } catch {
      show('Couldn’t prepare your data. Try again.', 'error');
    } finally {
      setExporting(false);
    }
  };

  const [soundEffects, setSoundEffectsState] = useState(true);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    (async () => {
      const storedSound = await SecureStore.getItemAsync(SOUND_EFFECTS_KEY);
      if (storedSound != null) setSoundEffectsState(storedSound === 'true');
    })();
  }, []);

  const setSoundEffects = (value: boolean) => {
    setSoundEffectsState(value);
    SecureStore.setItemAsync(SOUND_EFFECTS_KEY, String(value));
  };

  const push = usePush();
  const pushOn = push.permission === 'granted' && push.prefs?.push_enabled !== false;
  const pushCopy = pushStatusCopy(push.permission, pushOn);
  const onPushToggle = async (want: boolean) => {
    if (push.permission === 'denied') return push.openSystemSettings();
    if (!want) {
      await push.disable();
      return;
    }
    const r = await push.enable();
    if (r === 'denied') show('Notifications are off for Codon in your phone’s settings.', 'error');
    else if (r === 'error') show('Couldn’t turn on notifications. Try again.', 'error');
    else if (r === 'unavailable') show('Notifications aren’t available on this build.', 'error');
  };

  const handleLogout = async () => {
    setLogoutConfirmOpen(false);
    await push.unregister();
    await auth.signOut();
    router.replace(ROUTES.auth.phoneEntry);
  };

  const handleDeleteAccount = async () => {
    if (deleting) return;
    setDeleting(true);
    try {
      await push.unregister();
      await deleteAccount();
      setDeleteConfirmOpen(false);
      await auth.signOut();
      router.replace(ROUTES.auth.phoneEntry);
    } catch (err) {
      show('Couldn’t delete your account. Try again.', 'error');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Screen>
      <ScreenHeader title="Settings" />

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: space.md, paddingBottom: space['3xl'] + insets.bottom }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ marginTop: space.xl }}>
          <GroupLabel label="Appearance and feedback" />
          <View style={{ gap: space.xs }}>
            <View style={{ backgroundColor: color('bg/surface'), borderRadius: radius.md, padding: space.md, gap: space.xs }}>
              <Text style={[type['type/body-l'], { color: color('text/primary') }]}>Theme</Text>
              <SegmentedControl
                options={[{ key: 'light' as const, label: 'Light' }, { key: 'dark' as const, label: 'Dark' }, { key: 'system' as const, label: 'System' }]}
                value={preference}
                onChange={setPreference}
              />
            </View>
            <Row
              label="Sound effects"
              caption="Coming soon"
              trailing={<Switch value={soundEffects} onValueChange={setSoundEffects} trackColor={{ false: color('border/strong'), true: color('accent/default') }} thumbColor={color('bg/surface')} />}
            />
            <Row
              label="Wrong-answer vibration"
              caption="A short buzz in QBank and Custom Module Regular mode. Never during an exam."
              trailing={<Switch value={vibrate} onValueChange={changeVibrate} accessibilityLabel="Wrong-answer vibration" trackColor={{ false: color('border/strong'), true: color('accent/default') }} thumbColor={color('bg/surface')} />}
            />
          </View>
        </View>

        <View style={{ marginTop: space.lg }}>
          <GroupLabel label="Notifications and reminders" />
          <View style={{ gap: space.xs }}>
            <Row
              label="Push notifications"
              caption={pushCopy.caption}
              trailing={<Switch value={pushOn} disabled={!pushCopy.canToggle} onValueChange={onPushToggle} accessibilityLabel="Push notifications" trackColor={{ false: color('border/strong'), true: color('accent/default') }} thumbColor={color('bg/surface')} />}
            />
            {pushOn ? (
              <>
                <Row
                  label="Streak reminders"
                  caption="A nudge if you’re about to lose your streak"
                  trailing={<Switch value={push.prefs?.streak_nudges !== false} onValueChange={(v) => push.setPref({ streak_nudges: v }).catch(() => show('Couldn’t save.', 'error'))} accessibilityLabel="Streak reminders" trackColor={{ false: color('border/strong'), true: color('accent/default') }} thumbColor={color('bg/surface')} />}
                />
                <Row
                  label="Question report updates"
                  caption="When a question you reported is reviewed"
                  trailing={<Switch value={push.prefs?.report_updates !== false} onValueChange={(v) => push.setPref({ report_updates: v }).catch(() => show('Couldn’t save.', 'error'))} accessibilityLabel="Question report updates" trackColor={{ false: color('border/strong'), true: color('accent/default') }} thumbColor={color('bg/surface')} />}
                />
              </>
            ) : null}
            <ReminderRow kind="practice" />
            <ReminderRow kind="water" />
            <ReminderRow kind="breathing" />
          </View>
        </View>

        <View style={{ marginTop: space.lg }}>
          <GroupLabel label="Account" />
          <View style={{ gap: space.xs }}>
            <Row label="Change course" onPress={() => router.push({ pathname: ROUTES.auth.profileSetup as any, params: { edit: '1' } })} />
            {auth.status === 'authenticated' && auth.user.role === 'admin' ? <Row label="Switch role" onPress={switchRole} /> : null}
            <Row label="Manage devices" onPress={() => router.push(ROUTES.student.manageDevices)} />
            <Row label={exporting ? 'Preparing your data…' : 'Download my data'} onPress={() => { if (!exporting) void exportData(); }} />
          </View>
        </View>

        <View style={{ marginTop: space.lg }}>
          <GroupLabel label="Delete account" />
          <Row
            label="Delete account"
            caption="Permanently delete your account and data"
            onPress={() => setDeleteConfirmOpen(true)}
          />
        </View>

        <View style={{ marginTop: space['2xl'], alignItems: 'center' }}>
          <SecondaryButton
            label="Log out"
            variant="danger"
            onPress={() => setLogoutConfirmOpen(true)}
            style={{ alignSelf: 'stretch' }}
          />
          <Text style={[type['type/caption'], { color: color('text/tertiary'), marginTop: space.md }]}>
            Codon v1.0.0
          </Text>
        </View>
      </ScrollView>

      <ConfirmDialog
        visible={logoutConfirmOpen}
        tone="danger"
        title="Log out of Codon?"
        message="You'll need your phone number and a new code to sign back in."
        confirmLabel="Log out"
        onConfirm={handleLogout}
        onCancel={() => setLogoutConfirmOpen(false)}
      />

      <ConfirmDialog
        visible={deleteConfirmOpen}
        tone="danger"
        title="Delete your account?"
        message="This permanently deletes your account, progress, and purchase history. This can't be undone."
        confirmLabel="Delete Account"
        loading={deleting}
        onConfirm={handleDeleteAccount}
        onCancel={() => setDeleteConfirmOpen(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center' },
});
