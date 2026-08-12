import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { CaretLeft, CaretRight, Shield } from 'phosphor-react-native';
import { PrimaryButton, SecondaryButton, StatusBadge, useToast } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';

type Role = 'Student' | 'Teacher' | 'Admin';

const SEGMENTS: Role[] = ['Student', 'Teacher', 'Admin'];

export default function UserDetailRoute() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { show } = useToast();

  const [role, setRole] = useState<Role>('Student');
  const [pendingRole, setPendingRole] = useState<Role | null>(null);
  const [canManageAllContent, setCanManageAllContent] = useState(false);

  const name = 'Aarav Sharma';
  const initials = name.split(' ').map((p) => p[0]).join('').slice(0, 2);

  const confirmRoleChange = () => {
    if (!pendingRole) return;
    setRole(pendingRole);
    setPendingRole(null);
    show('Role updated', 'success');
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
          User Detail
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: space.md, paddingBottom: space['3xl'] + insets.bottom }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ alignItems: 'center', marginTop: space.xl }}>
          <View style={[styles.avatar, { width: 72, height: 72, borderRadius: 36, backgroundColor: color('accent/tint') }]}>
            <Text style={[type['type/h1'], { color: color('accent/default') }]}>{initials}</Text>
          </View>
          <Text style={[type['type/h2'], { color: color('text/primary'), marginTop: space.sm }]}>{name}</Text>
          <Text style={[type['type/body-m'], { color: color('text/secondary'), marginTop: 2 }]}>
            +91 98XXXXXX10
          </Text>
          <Text style={[type['type/caption'], { color: color('text/tertiary'), marginTop: 2 }]}>
            Member since Jan 2026
          </Text>
        </View>

        <View
          style={[
            { backgroundColor: color('bg/surface'), borderRadius: radius.lg, padding: space.lg, marginTop: space.xl },
            shadow(),
          ]}
        >
          <Text style={[type['type/overline'], { color: color('text/tertiary'), marginBottom: space.sm }]}>
            ROLE
          </Text>
          <View style={[styles.segmented, { backgroundColor: color('bg/sunken'), borderRadius: radius.pill, padding: 3 }]}>
            {SEGMENTS.map((seg) => {
              const active = role === seg;
              return (
                <Pressable
                  key={seg}
                  onPress={() => {
                    if (seg !== role) setPendingRole(seg);
                  }}
                  style={[
                    styles.segment,
                    { borderRadius: radius.pill, backgroundColor: active ? color('accent/default') : 'transparent' },
                  ]}
                >
                  <Text
                    style={[
                      type['type/body-m-medium'],
                      { color: active ? color('accent/on-accent') : color('text/secondary') },
                    ]}
                  >
                    {seg}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {role === 'Teacher' ? (
          <View
            style={[
              styles.row,
              { backgroundColor: color('bg/surface'), borderRadius: radius.md, padding: space.md, marginTop: space.lg },
            ]}
          >
            <View style={{ flex: 1 }}>
              <Text style={[type['type/body-l'], { color: color('text/primary') }]}>
                Can manage all content
              </Text>
              <Text style={[type['type/caption'], { color: color('text/tertiary'), marginTop: 2 }]}>
                Allows editing and reviewing other teachers&apos; content, not just their own.
              </Text>
            </View>
            <Switch
              value={canManageAllContent}
              onValueChange={setCanManageAllContent}
              trackColor={{ false: color('border/strong'), true: color('accent/default') }}
              thumbColor={color('bg/surface')}
            />
          </View>
        ) : null}

        {role === 'Student' ? (
          <View
            style={[
              { backgroundColor: color('bg/surface'), borderRadius: radius.md, padding: space.md, marginTop: space.lg },
            ]}
          >
            <Text style={[type['type/body-m'], { color: color('text/secondary') }]}>Course</Text>
            <Text style={[type['type/body-l'], { color: color('text/primary'), marginTop: 2 }]}>NEET UG</Text>
            <View style={{ height: 1, backgroundColor: color('border/subtle'), marginVertical: space.sm }} />
            <Text style={[type['type/body-m'], { color: color('text/secondary') }]}>Subscription</Text>
            <Text style={[type['type/body-l'], { color: color('text/primary'), marginTop: 2 }]}>
              NEET UG Pro — active until 14 Mar 2027
            </Text>
          </View>
        ) : null}

        {role === 'Student' ? (
          <Pressable
            onPress={() => router.push('/(admin)/(review)/kyc-review-detail')}
            style={({ pressed }) => [
              styles.row,
              { backgroundColor: color('bg/surface'), borderRadius: radius.md, padding: space.md, marginTop: space.lg, opacity: pressed ? 0.94 : 1 },
            ]}
          >
            <Shield size={20} color={color('text/secondary')} />
            <Text style={[type['type/body-l'], { color: color('text/primary'), flex: 1, marginLeft: space.sm }]}>
              Identity Verification
            </Text>
            <StatusBadge status="pending" label="Pending" />
            <CaretRight size={18} color={color('text/tertiary')} style={{ marginLeft: space.xs }} />
          </Pressable>
        ) : null}

        <View
          style={[
            { backgroundColor: color('bg/surface'), borderRadius: radius.md, padding: space.md, marginTop: space.lg },
          ]}
        >
          <Text style={[type['type/body-m'], { color: color('text/secondary') }]}>2 active devices</Text>
          <Text style={[type['type/caption'], { color: color('text/tertiary'), marginTop: 2 }]}>
            Last active 2 hours ago
          </Text>
        </View>
      </ScrollView>

      <Modal visible={!!pendingRole} transparent animationType="fade" onRequestClose={() => setPendingRole(null)}>
        <View style={[styles.scrim, { padding: space.lg }]}>
          <View style={[styles.modalCard, { backgroundColor: color('bg/surface'), borderRadius: radius.lg, padding: space.lg }]}>
            <Text style={[type['type/h3'], { color: color('text/primary') }]}>
              Change {name}&apos;s role to {pendingRole}?
            </Text>
            <View style={{ gap: space.sm, marginTop: space.lg }}>
              <PrimaryButton label="Confirm" onPress={confirmRoleChange} />
              <SecondaryButton label="Cancel" onPress={() => setPendingRole(null)} />
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
  avatar: { alignItems: 'center', justifyContent: 'center' },
  segmented: { flexDirection: 'row' },
  segment: { flex: 1, minHeight: 36, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center' },
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  modalCard: { width: '100%', maxWidth: 400 },
});
