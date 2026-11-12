import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, type Href } from 'expo-router';
import { PencilSimple, ArrowsClockwise } from 'phosphor-react-native';
import { Chip, ConfirmDialog, ListRow, Screen, SecondaryButton, SectionLabel, useToast, TAB_EDGES } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { useAuth } from '@/src/auth/AuthContext';
import { updateMe } from '@/src/api/profile';
import { clearAdminActiveRole } from '@/src/auth/tokenStore';
import { ROUTES } from '@/src/navigation/routes';
import { useOpenRolePicker } from '@/src/navigation/useOpenRolePicker';

export type StaffProfileScreenProps = {
  /** Shown in the role chip, e.g. "Teacher". */
  roleLabel: string;
  routes: { manageDevices: Href; giveFeedback: Href };
  /** Extra chips beside the role chip. */
  badges?: React.ReactNode;
  /** Role-specific rows shown above Preferences. */
  extras?: React.ReactNode;
  /** Admins can hop between Admin, Teacher and Student views. */
  canSwitchRole?: boolean;
};

/** Profile tab shared by teacher and admin: name edit, preferences, support links, log out. */
export function StaffProfileScreen({ roleLabel, routes, badges, extras, canSwitchRole }: StaffProfileScreenProps) {
  const { color, type, space } = useTheme();
  const router = useRouter();
  const openRolePicker = useOpenRolePicker();
  const insets = useSafeAreaInsets();
  const { show } = useToast();
  const auth = useAuth();
  const user = auth.status === 'authenticated' ? auth.user : null;

  const [name, setName] = useState(user?.name || roleLabel);
  const [draftName, setDraftName] = useState(name);
  const [editingName, setEditingName] = useState(false);
  const [soundEffects, setSoundEffects] = useState(true);
  const [logoutOpen, setLogoutOpen] = useState(false);

  useEffect(() => {
    if (user?.name) {
      setName(user.name);
      setDraftName(user.name);
    }
  }, [user?.name]);

  const initials = name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase() || roleLabel[0];

  const commitName = async () => {
    const trimmed = draftName.trim();
    if (trimmed.length > 0 && trimmed !== name) {
      const previous = name;
      setName(trimmed);
      try {
        await updateMe({ name: trimmed });
        await auth.refreshUser();
        show('Profile updated', 'success');
      } catch {
        show('Failed to update profile', 'error');
        setName(previous);
      }
    } else {
      setDraftName(name);
    }
    setEditingName(false);
  };

  const handleLogout = async () => {
    setLogoutOpen(false);
    await auth.signOut();
    router.replace(ROUTES.auth.phoneEntry);
  };

  return (
    <Screen edges={TAB_EDGES}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: space.md, paddingBottom: space['3xl'] + insets.bottom }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ alignItems: 'center', marginTop: space.lg }}>
          <View style={[styles.avatar, { backgroundColor: color('accent/tint') }]}>
            <Text style={[type['type/h1'], { color: color('accent/default') }]}>{initials}</Text>
          </View>

          {editingName ? (
            <TextInput
              value={draftName}
              onChangeText={setDraftName}
              onBlur={commitName}
              onSubmitEditing={commitName}
              autoFocus
              style={[type['type/h2'], { color: color('text/primary'), marginTop: space.sm, textAlign: 'center', minWidth: 160 }]}
            />
          ) : (
            <Pressable onPress={() => setEditingName(true)} style={[styles.nameRow, { marginTop: space.sm }]} hitSlop={space.xs}>
              <Text style={[type['type/h2'], { color: color('text/primary') }]}>{name}</Text>
              <PencilSimple size={16} color={color('text/tertiary')} style={{ marginLeft: space.xs }} />
            </Pressable>
          )}

          <View style={{ flexDirection: 'row', gap: space.xs, marginTop: space['2xs'] }}>
            <Chip label={roleLabel} tone="neutral" />
            {badges}
          </View>
        </View>

        {extras ? <View style={{ marginTop: space.lg }}>{extras}</View> : null}

        <View style={{ marginTop: space.xl }}>
          <SectionLabel>PREFERENCES</SectionLabel>
          <ListRow
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
        </View>

        <View style={{ marginTop: space.lg }}>
          <SectionLabel>SUPPORT</SectionLabel>
          <View style={{ gap: space.xs }}>
            {canSwitchRole ? (
              <ListRow
                label="Switch Role"
                Icon={ArrowsClockwise}
                onPress={async () => {
                  await clearAdminActiveRole();
                  openRolePicker();
                }}
              />
            ) : null}
            <ListRow label="Manage Devices" onPress={() => router.push(routes.manageDevices)} />
            <ListRow label="Give Feedback" onPress={() => router.push(routes.giveFeedback)} />
          </View>
        </View>

        <View style={{ marginTop: space['2xl'], alignItems: 'center' }}>
          <SecondaryButton label="Log Out" variant="danger" onPress={() => setLogoutOpen(true)} style={{ alignSelf: 'stretch' }} />
          <Text style={[type['type/caption'], { color: color('text/tertiary'), marginTop: space.md }]}>Codon v1.0.0</Text>
        </View>
      </ScrollView>

      <ConfirmDialog
        visible={logoutOpen}
        tone="danger"
        title="Log out of Codon?"
        message="You'll need your phone number and a new code to sign back in."
        confirmLabel="Log Out"
        onConfirm={handleLogout}
        onCancel={() => setLogoutOpen(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  avatar: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  nameRow: { flexDirection: 'row', alignItems: 'center' },
});
