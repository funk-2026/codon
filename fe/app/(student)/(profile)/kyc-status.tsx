import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { CaretLeft, Clock, CheckCircle, WarningCircle, XCircle } from 'phosphor-react-native';
import { EmptyState, PrimaryButton, TextButton, SkeletonBlock } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { getMyKYC, KYCRecord } from '@/src/api/kyc';

type Status = 'pending' | 'approved' | 'rejected';

const REJECTION_REASON = 'the document photo was blurry and the ID number could not be verified';

export default function KycStatusRoute() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  
  const [record, setRecord] = useState<KYCRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    getMyKYC()
      .then((res) => {
        setRecord(res);
        setLoadError(false);
      })
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const status = record?.status || 'pending';
  const REJECTION_REASON = record?.rejection_reason || 'Unknown error';

  const opacity = useSharedValue(0);
  const scale = useSharedValue(status === 'approved' ? 0.8 : 1);

  useEffect(() => {
    if (loading) return;
    opacity.value = withTiming(1, { duration: 280 });
    if (status === 'approved') scale.value = withTiming(1, { duration: 320 });
  }, [opacity, scale, status, loading]);

  const markStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  const config: Record<Status, { icon: React.ReactNode; label: string; explanation: string; token: 'semantic/warning' | 'semantic/success' | 'semantic/danger' }> = {
    pending: {
      icon: <Clock size={72} color={color('semantic/warning')} weight="regular" />,
      label: 'Under Review',
      explanation: "We're reviewing your document — this usually takes 1-2 business days.",
      token: 'semantic/warning',
    },
    approved: {
      icon: <CheckCircle size={72} color={color('semantic/success')} weight="fill" />,
      label: 'Verified',
      explanation: "You're all set — this won't be asked again.",
      token: 'semantic/success',
    },
    rejected: {
      icon: <XCircle size={72} color={color('semantic/danger')} weight="regular" />,
      label: 'Action Needed',
      explanation: `We couldn't verify this submission: ${REJECTION_REASON}.`,
      token: 'semantic/danger',
    },
  };

  const c = config[status];

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
          Identity Verification
        </Text>
      </View>

      <View style={[styles.body, { paddingHorizontal: space.lg }]}>
        {loading ? (
          <SkeletonBlock height={300} radius={radius.lg} />
        ) : loadError ? (
          <EmptyState
            icon={<WarningCircle size={32} color={color('semantic/danger')} weight="fill" />}
            title="Couldn't load verification status"
            description="Something went wrong fetching your identity verification status."
            action={<TextButton label="Retry" onPress={load} />}
          />
        ) : (
          <>
            <Animated.View style={[{ alignItems: 'center' }, markStyle]}>
              {c.icon}
              <Text style={[type['type/h2'], { color: color(c.token), marginTop: space.md }]}>{c.label}</Text>
            </Animated.View>
            <Text
              style={[type['type/body-m'], { color: color('text/secondary'), marginTop: space.sm, textAlign: 'center' }]}
            >
              {c.explanation}
            </Text>

            {record && (
              <View
                style={[
                  styles.card,
                  { backgroundColor: color('bg/surface'), borderRadius: radius.md, padding: space.md, marginTop: space.xl },
                ]}
              >
                <DetailRow label="ID Type" value={record.id_type === 'pan' ? 'PAN' : 'Aadhaar'} />
                <Divider />
                <DetailRow label="ID Number" value={record.id_number} />
                <Divider />
                <DetailRow label="Submitted" value={new Date(record.submitted_at).toLocaleDateString()} />
              </View>
            )}
          </>
        )}
      </View>

      <View style={{ paddingHorizontal: space.md, marginBottom: space.lg }}>
        {loadError ? null : status === 'pending' ? (
          <View style={{ alignItems: 'center' }}>
            <TextButton label="Done" onPress={() => router.push('/(student)/(profile)')} />
          </View>
        ) : status === 'approved' ? (
          <PrimaryButton label="Done" onPress={() => router.push('/(student)/(profile)')} />
        ) : (
          <PrimaryButton
            label="Resubmit"
            onPress={() => router.replace('/(student)/(profile)/kyc-submission')}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  const { color, type } = useTheme();
  return (
    <View style={styles.detailRow}>
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
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center' },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: { width: '100%' },
  detailRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
