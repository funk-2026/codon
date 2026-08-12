import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { PencilSimple, CaretRight } from 'phosphor-react-native';
import { SecondaryButton, useToast } from '@/src/components';
import { useTheme, type ThemePreference } from '@/src/theme/ThemeProvider';

export default function AdminProfileRoute() {
  const { color, type, space, radius, preference, setPreference } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { show } = useToast();

  const [name, setName] = useState('Sanjay Gupta');
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState(name);
  const [soundEffects, setSoundEffects] = useState(true);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);

  const initials = name.split(' ').map((p) => p[0]).join('').slice(0, 2);

  const segments: { key: ThemePreference; label: string }[] = [
    { key: 'system', label: 'System' },
    { key: 'light', label: 'Light' },
    { key: 'dark', label: 'Dark' },
  ];

  const commitName = () => {
    const trimmed = draftName.trim();
    if (trimmed.length > 0 && trimmed !== name) {
      setName(trimmed);
      show('Profile updated', 'success');
    } else {
      setDraftName(name);
    }
    setEditingName(false);
  };

  const handleLogout = () => {
    setLogoutConfirmOpen(false);
    router.replace('/phone-entry');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: color('bg/canvas') }]}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: space.md, paddingBottom: space['3xl'] + insets.bottom }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ alignItems: 'center', marginTop: space.lg }}>
          <View style={[styles.avatar, { width: 72, height: 72, borderRadius: 36, backgroundColor: color('accent/tint') }]}>
            <Text style={[type['type/h1'], { color: color('accent/default') }]}>{initials}</Text>
          </View>

          {editingName ? (
            <TextInput
              value={draftName}
              onChangeText={setDraftName}
              onBlur={commitName}
              onSubmitEditing={commitName}
              autoFocus
              style={[
                type['type/h2'],
                { color: color('text/primary'), marginTop: space.sm, textAlign: 'center', minWidth: 160 },
              ]}
            />
          ) : (
            <Pressable
              onPress={() => setEditingName(true)}
              style={[styles.nameRow, { marginTop: space.sm }]}
              hitSlop={space.xs}
            >
              <Text style={[type['type/h2'], { color: color('text/primary') }]}>{name}</Text>
              <PencilSimple size={16} color={color('text/tertiary')} style={{ marginLeft: space.xs }} />
            </Pressable>
          )}

          <View
            style={[
              styles.chip,
              { backgroundColor: color('accent/tint'), borderRadius: radius.pill, paddingHorizontal: space.sm, marginTop: space['2xs'] },
            ]}
          >
            <Text style={[type['type/caption'], { color: color('accent/default') }]}>Admin</Text>
          </View>
        </View>

        <View style={{ marginTop: space.xl }}>
          <Text style={[type['type/overline'], { color: color('text/tertiary'), marginBottom: space.sm }]}>
            APPEARANCE
          </Text>
          <View style={[styles.row, { backgroundColor: color('bg/surface'), borderRadius: radius.md, padding: space.md }]}>
            <Text style={[type['type/body-l'], { color: color('text/primary'), flex: 1 }]}>Theme</Text>
            <View style={[styles.segmented, { backgroundColor: color('bg/sunken'), borderRadius: radius.pill, padding: 3 }]}>
              {segments.map((seg) => {
                const active = preference === seg.key;
                return (
                  <Pressable
                    key={seg.key}
                    onPress={() => setPreference(seg.key)}
                    style={[
                      styles.segment,
                      { borderRadius: radius.pill, backgroundColor: active ? color('accent/default') : 'transparent', paddingHorizontal: space.sm },
                    ]}
                  >
                    <Text style={[type['type/caption'], { color: active ? color('accent/on-accent') : color('text/secondary') }]}>
                      {seg.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>

        <View style={{ marginTop: space.lg }}>
          <Text style={[type['type/overline'], { color: color('text/tertiary'), marginBottom: space.sm }]}>
            PREFERENCES
          </Text>
          <View style={[styles.row, { backgroundColor: color('bg/surface'), borderRadius: radius.md, padding: space.md }]}>
            <Text style={[type['type/body-l'], { color: color('text/primary'), flex: 1 }]}>Sound Effects</Text>
            <Switch
              value={soundEffects}
              onValueChange={setSoundEffects}
              trackColor={{ false: color('border/strong'), true: color('accent/default') }}
              thumbColor={color('bg/surface')}
            />
          </View>
        </View>

        <View style={{ marginTop: space.lg }}>
          <Text style={[type['type/overline'], { color: color('text/tertiary'), marginBottom: space.sm }]}>
            SUPPORT
          </Text>
          <View style={{ gap: space.xs }}>
            <Pressable
              onPress={() => router.push('/(admin)/(profile)/manage-devices')}
              style={({ pressed }) => [
                styles.row,
                { backgroundColor: color('bg/surface'), borderRadius: radius.md, padding: space.md, opacity: pressed ? 0.94 : 1 },
              ]}
            >
              <Text style={[type['type/body-l'], { color: color('text/primary'), flex: 1 }]}>Manage Devices</Text>
              <CaretRight size={18} color={color('text/tertiary')} />
            </Pressable>
            <Pressable
              onPress={() => router.push('/(admin)/(profile)/give-feedback')}
              style={({ pressed }) => [
                styles.row,
                { backgroundColor: color('bg/surface'), borderRadius: radius.md, padding: space.md, opacity: pressed ? 0.94 : 1 },
              ]}
            >
              <Text style={[type['type/body-l'], { color: color('text/primary'), flex: 1 }]}>Give Feedback</Text>
              <CaretRight size={18} color={color('text/tertiary')} />
            </Pressable>
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
          <View style={[styles.modalCard, { backgroundColor: color('bg/surface'), borderRadius: radius.lg, padding: space.lg }]}>
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
  avatar: { alignItems: 'center', justifyContent: 'center' },
  nameRow: { flexDirection: 'row', alignItems: 'center' },
  chip: { paddingVertical: 4 },
  row: { flexDirection: 'row', alignItems: 'center' },
  segmented: { flexDirection: 'row' },
  segment: { minHeight: 28, alignItems: 'center', justifyContent: 'center' },
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  modalCard: { width: '100%', maxWidth: 400 },
});
