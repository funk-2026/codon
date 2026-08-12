import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { CaretLeft, Camera, CheckCircle, X } from 'phosphor-react-native';
import { InputField, PrimaryButton, TextButton } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';

const CATEGORIES = ['Bug', 'Content Issue', 'Suggestion', 'Something Else'] as const;
type Category = (typeof CATEGORIES)[number];

export default function AdminGiveFeedbackRoute() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [category, setCategory] = useState<Category | null>(null);
  const [message, setMessage] = useState('');
  const [attached, setAttached] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const valid = !!category && message.trim().length > 0;

  const handleSubmit = () => {
    if (!valid || submitting) return;
    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      setSubmitted(true);
    }, 700);
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
          Give Feedback
        </Text>
      </View>

      {submitted ? (
        <View style={[styles.successBlock, { paddingHorizontal: space.lg }]}>
          <CheckCircle size={56} color={color('semantic/success')} weight="fill" />
          <Text
            style={[type['type/h2'], { color: color('text/primary'), marginTop: space.lg, textAlign: 'center' }]}
          >
            Thank you — that helps.
          </Text>
          <Text
            style={[
              type['type/body-m'],
              { color: color('text/secondary'), marginTop: space.xs, textAlign: 'center' },
            ]}
          >
            We read every submission. If it needs a reply, we&apos;ll reach out.
          </Text>
          <TextButton label="Done" onPress={() => router.back()} style={{ marginTop: space.lg }} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: space.md, paddingBottom: space['3xl'] + insets.bottom }}
          showsVerticalScrollIndicator={false}
        >
          <Text
            style={[type['type/body-m'], { color: color('text/secondary'), marginTop: space['2xs'] }]}
          >
            Tell us what&apos;s working, what&apos;s not, or what you wish existed.
          </Text>

          <View style={{ marginTop: space.xl }}>
            <Text
              style={[type['type/caption'], { color: color('text/secondary'), marginBottom: space.xs }]}
            >
              What&apos;s this about?
            </Text>
            <View style={[styles.chipRow, { gap: space.xs }]}>
              {CATEGORIES.map((c) => {
                const active = category === c;
                return (
                  <Pressable
                    key={c}
                    onPress={() => setCategory(c)}
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
                      {c}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={{ marginTop: space.lg }}>
            <InputField
              label="Details"
              multiline
              value={message}
              onChangeText={setMessage}
              placeholder="The more specific, the more useful — what happened, and where?"
            />
          </View>

          <View style={{ marginTop: space.md }}>
            {attached ? (
              <View
                style={[
                  styles.attachedRow,
                  {
                    backgroundColor: color('bg/sunken'),
                    borderRadius: radius.sm,
                    padding: space.sm,
                  },
                ]}
              >
                <View
                  style={[
                    styles.thumb,
                    { backgroundColor: color('border/subtle'), borderRadius: radius.sm },
                  ]}
                />
                <Text style={[type['type/body-m'], { color: color('text/secondary'), flex: 1, marginLeft: space.sm }]}>
                  Screenshot attached
                </Text>
                <Pressable onPress={() => setAttached(false)} hitSlop={space.xs}>
                  <X size={18} color={color('text/tertiary')} />
                </Pressable>
              </View>
            ) : (
              <Pressable
                onPress={() => setAttached(true)}
                style={[
                  styles.attachZone,
                  {
                    borderRadius: radius.sm,
                    borderColor: color('border/strong'),
                    padding: space.md,
                  },
                ]}
              >
                <Camera size={20} color={color('text/tertiary')} />
                <Text style={[type['type/body-m'], { color: color('text/tertiary'), marginLeft: space.xs }]}>
                  Attach a screenshot (optional)
                </Text>
              </Pressable>
            )}
          </View>

          <Text
            style={[type['type/caption'], { color: color('text/tertiary'), marginTop: space.md }]}
          >
            We may follow up using your Codon account phone number.
          </Text>

          <PrimaryButton
            label="Submit"
            onPress={handleSubmit}
            disabled={!valid}
            loading={submitting}
            style={{ marginTop: space.xl }}
          />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap' },
  chip: { minHeight: 36, alignItems: 'center', justifyContent: 'center' },
  attachZone: {
    borderWidth: 1,
    borderStyle: 'dashed',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachedRow: { flexDirection: 'row', alignItems: 'center' },
  thumb: { width: 36, height: 36 },
  successBlock: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
