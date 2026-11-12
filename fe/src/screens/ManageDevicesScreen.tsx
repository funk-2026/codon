import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { DeviceMobile, DeviceTablet, WarningCircle } from 'phosphor-react-native';
import { ConfirmDialog, EmptyState, SecondaryButton, SkeletonBlock, TextButton, useToast, ScreenHeader, Screen } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { useDevices, useRevokeDevice, type Device } from '@/src/queries/devices';
import { shadow } from '@/src/theme/elevation';

export default function ManageDevicesScreen() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { show } = useToast();

  const devicesQuery = useDevices();
  const revoke = useRevokeDevice();
  const [target, setTarget] = useState<Device | null>(null);

  const devices = devicesQuery.data ?? [];
  const loading = devicesQuery.isPending;
  const loadError = devicesQuery.isError;
  const load = () => void devicesQuery.refetch();

  const confirmRemove = () => {
    if (!target) return;
    revoke.mutate(target.id, {
      onSuccess: () => {
        setTarget(null);
        show('Device signed out', 'success');
      },
      onError: () => show('Failed to log out device', 'error'),
    });
  };

  return (
    <Screen>
      <ScreenHeader title="Manage Devices" />
      <Text
        style={[
          type['type/body-m'],
          { color: color('text/secondary'), paddingHorizontal: space.md, marginTop: space['2xs'] },
        ]}
      >
        Codon allows up to 2 signed-in devices at a time.
      </Text>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: space.md,
          paddingTop: space.xl,
          paddingBottom: space['3xl'] + insets.bottom,
          gap: space.sm,
        }}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <>
            <SkeletonBlock height={84} radius={radius.md} />
            <SkeletonBlock height={84} radius={radius.md} />
          </>
        ) : loadError ? (
          <EmptyState
            icon={<WarningCircle size={32} color={color('semantic/danger')} weight="fill" />}
            title="Couldn't load devices"
            description="Something went wrong fetching your signed-in devices."
            action={<TextButton label="Retry" onPress={load} />}
          />
        ) : (
          devices.map((d) => {
            const Icon = d.kind === 'tablet' ? DeviceTablet : DeviceMobile;
            return (
              <View
                key={d.id}
                style={[
                  styles.card,
                  { backgroundColor: color('bg/surface'), borderRadius: radius.md, padding: space.md },
                  shadow(),
                ]}
              >
                <Icon size={24} color={color('text/secondary')} />
                <View style={{ flex: 1, marginLeft: space.sm }}>
                  <Text style={[type['type/h3'], { color: color('text/primary') }]}>{d.label}</Text>
                  <Text style={[type['type/caption'], { color: color('text/tertiary'), marginTop: 2 }]}>
                    {d.lastActive}
                  </Text>
                </View>
                {d.current ? (
                  <View
                    style={[
                      styles.tag,
                      { backgroundColor: color('accent/tint'), borderRadius: radius.pill, paddingHorizontal: space.sm },
                    ]}
                  >
                    <Text style={[type['type/caption'], { color: color('accent/default') }]}>
                      This Device
                    </Text>
                  </View>
                ) : (
                  <SecondaryButton label="Log Out" variant="danger" onPress={() => setTarget(d)} />
                )}
              </View>
            );
          })
        )}
      </ScrollView>

      <ConfirmDialog
        visible={!!target}
        tone="danger"
        title="Log out this device?"
        message={`${target?.label ?? 'This device'} will be signed out immediately.`}
        confirmLabel="Log Out"
        loading={revoke.isPending}
        onConfirm={confirmRemove}
        onCancel={() => setTarget(null)}
      />
    </Screen>
  );
}


const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center' },
  card: { flexDirection: 'row', alignItems: 'center' },
  tag: { paddingVertical: 4 },
});
