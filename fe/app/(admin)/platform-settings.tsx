import { useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ErrorBanner, useToast, ScreenHeader, Screen, ConfirmDialog } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { setKYCRequired } from '@/src/api/admin';
import { shadow } from '@/src/theme/elevation';
import { useQueryClient } from '@tanstack/react-query';
import { useKycRequirement } from '@/src/queries/admin';

export default function PlatformSettingsRoute() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { show } = useToast();

  const kycQuery = useKycRequirement();
  const queryClient = useQueryClient();
  const kycRequired = kycQuery.data ?? false;
  const setKycRequiredState = (v: boolean) => queryClient.setQueryData(['admin', 'settings', 'kyc'], { required: v });
  const [confirmOpen, setConfirmOpen] = useState(false);
  const loadError = kycQuery.isError;
  const loadSettings = () => void kycQuery.refetch();


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
    <Screen>
      <ScreenHeader title="Platform Settings" />

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

      <ConfirmDialog
        visible={confirmOpen}
        title="Turn on KYC requirement?"
        message="Students with an active subscription but no approved KYC will lose access to gated content until they verify."
        confirmLabel="Turn On"
        onConfirm={confirmEnable}
        onCancel={() => setConfirmOpen(false)}
      />
    </Screen>
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


const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
