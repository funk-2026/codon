import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { CaretLeft, DeviceMobile, DeviceTablet } from 'phosphor-react-native';
import { SecondaryButton, SkeletonBlock, useToast } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { listSessions, revokeSession } from '@/src/api/sessions';

type Device = {
  id: string;
  label: string;
  lastActive: string;
  current: boolean;
  kind: 'phone' | 'tablet';
};



export default function AdminManageDevicesRoute() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { show } = useToast();

  const [loading, setLoading] = useState(true);
  const [devices, setDevices] = useState<Device[]>([]);
  const [target, setTarget] = useState<Device | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const { sessions } = await listSessions();
        const mapped: Device[] = sessions.map(s => {
          const kind = s.device_info?.toLowerCase().includes('ipad') || s.device_info?.toLowerCase().includes('tablet') ? 'tablet' : 'phone';
          return {
            id: s.id,
            label: s.device_info || 'Unknown Device',
            lastActive: new Date(s.last_used_at).toLocaleDateString(),
            current: false,
            kind,
          };
        });
        if (mapped.length > 0) mapped[0].current = true; // Best effort for current session indicator
        setDevices(mapped);
      } catch (err) {
        show('Failed to load devices', 'error');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [show]);

  const confirmRemove = async () => {
    if (!target) return;
    try {
      await revokeSession(target.id);
      setDevices((prev) => prev.filter((d) => d.id !== target.id));
      setTarget(null);
      show('Device signed out', 'success');
    } catch (err) {
      show('Failed to log out device', 'error');
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: color('bg/canvas') }]}>
      <View style={[styles.header, { paddingHorizontal: space.md, marginTop: space.lg }]}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={space.xs}
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
        >
          <CaretLeft size={24} color={color('text/primary')} />
        </Pressable>
        <Text style={[type['type/h1'], { color: color('text/primary'), marginLeft: space.sm }]}>
          Manage Devices
        </Text>
      </View>
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

      <Modal visible={!!target} transparent animationType="fade" onRequestClose={() => setTarget(null)}>
        <View style={[styles.scrim, { padding: space.lg }]}>
          <View
            style={[
              styles.modalCard,
              { backgroundColor: color('bg/surface'), borderRadius: radius.lg, padding: space.lg },
            ]}
          >
            <Text style={[type['type/h3'], { color: color('text/primary') }]}>
              Log out this device?
            </Text>
            <Text style={[type['type/body-m'], { color: color('text/secondary'), marginTop: space.xs }]}>
              {target?.label} will be signed out immediately.
            </Text>
            <View style={{ gap: space.sm, marginTop: space.lg }}>
              <SecondaryButton label="Log Out" variant="danger" onPress={confirmRemove} />
              <SecondaryButton label="Cancel" onPress={() => setTarget(null)} />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function shadow(): {} {
  return {
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  };
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center' },
  card: { flexDirection: 'row', alignItems: 'center' },
  tag: { paddingVertical: 4 },
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  modalCard: { width: '100%', maxWidth: 400 },
});
