import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Camera } from 'phosphor-react-native';
import { InputField, PrimaryButton, TextButton, useToast, ScreenHeader, Screen } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { submitKYC } from '@/src/api/kyc';
import { ROUTES } from '@/src/navigation/routes';
import { queryClient } from '@/src/queries/queryClient';
import { keys } from '@/src/queries/keys';

type IdType = 'Aadhaar' | 'PAN';

export default function KycSubmissionRoute() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { show } = useToast();

  const [idType, setIdType] = useState<IdType | null>(null);
  const [idNumber, setIdNumber] = useState('');
  const [document, setDocument] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const valid = !!idType && idNumber.trim().length > 0 && document;

  const handleSubmit = async () => {
    if (!valid || submitting) return;
    setSubmitting(true);
    try {
      await submitKYC({
        id_type: idType.toLowerCase() as 'aadhaar' | 'pan',
        id_number: idNumber,
        document_file_key: 'mock/document_file_key.jpg', // mocked upload
      });
      void queryClient.invalidateQueries({ queryKey: keys.myKyc });
      router.replace(ROUTES.student.kycStatus);
    } catch (err) {
      show('Failed to submit KYC. Please try again.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const numberLabel = idType === 'PAN' ? 'PAN Number' : 'Aadhaar Number';

  return (
    <Screen>
      <ScreenHeader title="Identity Verification" />
      <Text
        style={[
          type['type/body-m'],
          { color: color('text/secondary'), paddingHorizontal: space.md, marginTop: space['2xs'] },
        ]}
      >
        This is a one-time check required for paid access. Reviewed by our team, never shared.
      </Text>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: space.md, paddingTop: space.xl, paddingBottom: space['3xl'] + insets.bottom }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[type['type/caption'], { color: color('text/secondary'), marginBottom: space.xs }]}>
          ID Type
        </Text>
        <View style={[styles.chipRow, { gap: space.xs }]}>
          {(['Aadhaar', 'PAN'] as IdType[]).map((t) => {
            const active = idType === t;
            return (
              <Pressable
                key={t}
                onPress={() => setIdType(t)}
                style={[
                  styles.chip,
                  {
                    borderRadius: radius.pill,
                    paddingHorizontal: space.md,
                    backgroundColor: active ? color('accent/tint') : color('bg/surface'),
                    borderWidth: 1,
                    borderColor: active ? color('accent/default') : color('border/subtle'),
                  },
                ]}
              >
                <Text
                  style={[
                    type['type/body-m-medium'],
                    { color: active ? color('accent/default') : color('text/primary') },
                  ]}
                >
                  {t}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={{ marginTop: space.lg }}>
          <InputField
            label={numberLabel}
            value={idNumber}
            onChangeText={setIdNumber}
            editable={!!idType}
            keyboardType={idType === 'PAN' ? 'default' : 'number-pad'}
            autoCapitalize={idType === 'PAN' ? 'characters' : 'none'}
          />
        </View>

        <View style={{ marginTop: space.lg }}>
          <Text style={[type['type/caption'], { color: color('text/secondary'), marginBottom: space.xs }]}>
            Upload Document
          </Text>
          {document ? (
            <View
              style={[
                styles.uploadZone,
                {
                  backgroundColor: color('bg/sunken'),
                  borderRadius: radius.md,
                  borderColor: color('border/subtle'),
                },
              ]}
            >
              <Text style={[type['type/body-m-medium'], { color: color('text/secondary') }]}>
                Document attached
              </Text>
              <TextButton label="Retake" onPress={() => setDocument(false)} style={{ marginTop: space.xs }} />
            </View>
          ) : (
            <Pressable
              onPress={() => setDocument(true)}
              style={[
                styles.uploadZone,
                {
                  backgroundColor: color('bg/sunken'),
                  borderRadius: radius.md,
                  borderColor: color('border/strong'),
                },
              ]}
            >
              <Camera size={28} color={color('text/tertiary')} />
              <Text
                style={[type['type/body-m'], { color: color('text/tertiary'), marginTop: space.xs, textAlign: 'center' }]}
              >
                Take a photo or upload from gallery
              </Text>
            </Pressable>
          )}
        </View>
      </ScrollView>

      <View style={{ paddingHorizontal: space.md, marginBottom: space.lg }}>
        <PrimaryButton
          label="Submit for Review"
          onPress={handleSubmit}
          disabled={!valid}
          loading={submitting}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center' },
  chipRow: { flexDirection: 'row' },
  chip: { minHeight: 36, alignItems: 'center', justifyContent: 'center' },
  uploadZone: {
    minHeight: 140,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
});
