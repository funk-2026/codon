import { useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { CaretLeft } from 'phosphor-react-native';
import { ErrorBanner, PrimaryButton, SecondaryButton, useToast } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { getPlatformSettingsKYC, setKYCRequired } from '@/src/api/admin';

export default function PlatformSettingsRoute() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { show } = useToast();

  const [kycRequired, setKycRequiredState] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const loadSettings = useCallback(() => {
    getPlatformSettingsKYC()
      .then(res => {
        setKycRequiredState(res.required);
        setLoadError(false);
      })
      .catch(() => setLoadError(true));
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleToggle = (value: boolean) => {
    if (value) {
      setConfirmOpen(true);
    } else {
      setKYCRequired(false).then(() => {
        setKycRequiredState(false);
        show('Setting updated', 'success');
      }).catch(() => show('Failed to update setting', 'error'));
    }
  };

  const confirmEnable = () => {
    setKYCRequired(true).then(() => {
      setKycRequiredState(true);
      setConfirmOpen(false);
      show('Setting updated', 'success');
    }).catch(() => {
      setConfirmOpen(false);
      show('Failed to update setting', 'error');
    });
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
          Platform Settings
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: space.md, paddingBottom: space['3xl'] + insets.bottom }}
        showsVerticalScrollIndicator={false}
      >
        {loadError ? (
          <View style={{ marginTop: space.xl }}>
            <ErrorBanner onRetry={loadSettings} />
          </View>
        ) : null}

        <View style={{ marginTop: space.xl }}>
          <Text style={[type['type/overline'], { color: color('text/tertiary'), marginBottom: space.sm }]}>
            IDENTITY VERIFICATION
          </Text>
          <View
            style={[
              { backgroundColor: color('bg/surface'), borderRadius: radius.md, padding: space.md },
              shadow(),
            ]}
          >
            <View style={styles.row}>
              <Text style={[type['type/body-l'], { color: color('text/primary'), flex: 1 }]}>
                Require KYC for Paid Access
              </Text>
              <Switch
                value={kycRequired}
                onValueChange={handleToggle}
                trackColor={{ false: color('border/strong'), true: color('accent/default') }}
                thumbColor={color('bg/surface')}
              />
            </View>
            <Text style={[type['type/caption'], { color: color('text/tertiary'), marginTop: space.xs }]}>
              When on, students must complete identity verification before accessing subscription-gated content.
            </Text>
          </View>
        </View>

        <View style={{ marginTop: space.xl }}>
          <View
            style={[
              { backgroundColor: color('bg/surface'), borderRadius: radius.md, padding: space.md },
              shadow(),
            ]}
          >
            <DetailRow label="App Version" value="1.0.0" />
            <Divider />
            <DetailRow label="Environment" value="Production" />
            <Divider />
            <DetailRow label="Support" value="support@codon.app" />
          </View>
        </View>
      </ScrollView>

      <Modal visible={confirmOpen} transparent animationType="fade" onRequestClose={() => setConfirmOpen(false)}>
        <View style={[styles.scrim, { padding: space.lg }]}>
          <View style={[styles.modalCard, { backgroundColor: color('bg/surface'), borderRadius: radius.lg, padding: space.lg }]}>
            <Text style={[type['type/h3'], { color: color('text/primary') }]}>Turn on KYC requirement?</Text>
            <Text style={[type['type/body-m'], { color: color('text/secondary'), marginTop: space.xs }]}>
              Students with an active subscription but no approved KYC will lose access to gated content until they verify.
            </Text>
            <View style={{ gap: space.sm, marginTop: space.lg }}>
              <PrimaryButton label="Turn On" onPress={confirmEnable} />
              <SecondaryButton label="Cancel" onPress={() => setConfirmOpen(false)} />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  const { color, type } = useTheme();
  return (
    <View style={styles.row}>
      <Text style={[type['type/body-m'], { color: color('text/secondary') }]}>{label}</Text>
      <Text style={[type['type/body-m-medium'], { color: color('text/primary') }]}>{value}</Text>
    </View>
  );
}

function Divider() {
  const { color, space } = useTheme();
  return <View style={{ height: 1, backgroundColor: color('border/subtle'), marginVertical: space.xs }} />;
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
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  modalCard: { width: '100%', maxWidth: 400 },
});
