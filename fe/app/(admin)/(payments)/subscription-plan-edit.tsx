import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CaretLeft, CheckCircle, X } from 'phosphor-react-native';
import { InputField, PrimaryButton, TextButton, useToast } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';

type Course = 'NEET UG' | '9th Standard' | '10th Standard';

const COURSES: Course[] = ['NEET UG', '9th Standard', '10th Standard'];

const EXISTING: Record<string, { name: string; course: Course; days: string; price: string; benefits: string[]; active: boolean }> = {
  p3: { name: '3 Months', course: 'NEET UG', days: '90', price: '2999', benefits: ['Full Test Series access', 'Complete Q Bank', 'All Video Classes', 'Priority doubt support'], active: true },
  p12: { name: '12 Months', course: 'NEET UG', days: '365', price: '8999', benefits: ['Full Test Series access', 'Complete Q Bank', 'All Video Classes', 'Priority doubt support', '2 months free vs. quarterly'], active: true },
};

export default function SubscriptionPlanEditRoute() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { show } = useToast();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isEditing = !!id && !!EXISTING[id];
  const seed = (id && EXISTING[id]) || { name: '', course: 'NEET UG' as Course, days: '', price: '', benefits: [''], active: true };

  const [name, setName] = useState(seed.name);
  const [course, setCourse] = useState<Course>(seed.course);
  const [days, setDays] = useState(seed.days);
  const [price, setPrice] = useState(seed.price);
  const [benefits, setBenefits] = useState<string[]>(seed.benefits);
  const [active, setActive] = useState(seed.active);
  const [saving, setSaving] = useState(false);

  const valid = name.trim().length > 0 && days.trim().length > 0 && price.trim().length > 0;

  const handleSave = () => {
    if (!valid || saving) return;
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      show('Plan saved', 'success');
      router.replace('/(admin)/(payments)/subscription-plan-list');
    }, 700);
  };

  const updateBenefit = (i: number, value: string) => {
    setBenefits((prev) => prev.map((b, bi) => (bi === i ? value : b)));
  };
  const removeBenefit = (i: number) => {
    setBenefits((prev) => prev.filter((_, bi) => bi !== i));
  };
  const addBenefit = () => setBenefits((prev) => [...prev, '']);

  const durationLabel = days.trim() ? `${days} days` : '— days';
  const priceLabel = price.trim() ? `₹${Number(price).toLocaleString('en-IN')}` : '₹—';
  const cleanBenefits = benefits.filter((b) => b.trim().length > 0);

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
          {isEditing ? 'Edit Plan' : 'New Plan'}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: space.md, paddingBottom: space['3xl'] + insets.bottom }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ marginTop: space.xl, gap: space.lg }}>
          <InputField
            label="Plan Name"
            value={name}
            onChangeText={setName}
            helperText="Shown to students, e.g. '3 Months' or 'NEET UG Pro — Annual.'"
          />

          <View>
            <Text style={[type['type/caption'], { color: color('text/secondary'), marginBottom: space.xs }]}>
              Course
            </Text>
            <View style={[styles.chipRow, { gap: space.xs }]}>
              {COURSES.map((c) => {
                const activeChip = course === c;
                return (
                  <Pressable
                    key={c}
                    onPress={() => setCourse(c)}
                    style={[
                      styles.chip,
                      {
                        borderRadius: radius.pill,
                        paddingHorizontal: space.md,
                        backgroundColor: activeChip ? color('accent/tint') : color('bg/surface'),
                        borderWidth: 1,
                        borderColor: activeChip ? color('accent/default') : color('border/subtle'),
                      },
                    ]}
                  >
                    <Text
                      style={[type['type/body-m-medium'], { color: activeChip ? color('accent/default') : color('text/primary') }]}
                    >
                      {c}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={{ flexDirection: 'row', gap: space.md }}>
            <InputField
              label="Duration (days)"
              value={days}
              onChangeText={setDays}
              keyboardType="number-pad"
              containerStyle={{ flex: 1 }}
            />
            <InputField
              label="Price (₹)"
              value={price}
              onChangeText={setPrice}
              keyboardType="number-pad"
              containerStyle={{ flex: 1 }}
            />
          </View>

          <View>
            <Text style={[type['type/caption'], { color: color('text/secondary') }]}>Benefits</Text>
            <Text style={[type['type/caption'], { color: color('text/tertiary'), marginTop: 2, marginBottom: space.sm }]}>
              One per line — shown as a checklist to students.
            </Text>
            <View style={{ gap: space.sm }}>
              {benefits.map((b, i) => (
                <View key={i} style={styles.benefitRow}>
                  <InputField
                    value={b}
                    onChangeText={(v) => updateBenefit(i, v)}
                    containerStyle={{ flex: 1 }}
                  />
                  <Pressable
                    onPress={() => removeBenefit(i)}
                    hitSlop={space.xs}
                    style={{ marginLeft: space.xs, padding: space['2xs'] }}
                  >
                    <X size={18} color={color('text/tertiary')} />
                  </Pressable>
                </View>
              ))}
            </View>
            <TextButton label="Add Benefit" onPress={addBenefit} style={{ alignSelf: 'flex-start', marginTop: space.sm }} />
          </View>

          <View style={styles.row}>
            <Text style={[type['type/body-l'], { color: color('text/primary'), flex: 1 }]}>Active</Text>
            <Switch
              value={active}
              onValueChange={setActive}
              trackColor={{ false: color('border/strong'), true: color('accent/default') }}
              thumbColor={color('bg/surface')}
            />
          </View>
        </View>

        <View style={{ marginTop: space.xl }}>
          <Text style={[type['type/overline'], { color: color('text/tertiary'), marginBottom: space.sm }]}>
            PREVIEW
          </Text>
          <View
            style={[
              { backgroundColor: color('bg/surface'), borderRadius: radius.lg, padding: space.lg },
              shadow(),
            ]}
          >
            <View style={styles.previewPriceRow}>
              <Text style={[type['type/h2'], { color: color('text/primary') }]}>{name || 'Plan Name'}</Text>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[type['type/numeral-display'], { color: color('text/primary'), fontSize: 24 }]}>
                  {priceLabel}
                </Text>
                <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>/ {durationLabel}</Text>
              </View>
            </View>
            <View style={{ marginTop: space.md, gap: space.xs }}>
              {(cleanBenefits.length > 0 ? cleanBenefits : ['Benefits will appear here']).map((b, i) => (
                <View key={i} style={styles.benefitPreviewRow}>
                  <CheckCircle size={16} color={color('semantic/success')} weight="fill" />
                  <Text style={[type['type/body-m'], { color: color('text/primary'), marginLeft: space.xs }]}>{b}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      </ScrollView>

      <View style={{ paddingHorizontal: space.md, marginBottom: space.lg }}>
        <PrimaryButton label="Save Plan" onPress={handleSave} disabled={!valid} loading={saving} />
      </View>
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
  chipRow: { flexDirection: 'row', flexWrap: 'wrap' },
  chip: { minHeight: 36, alignItems: 'center', justifyContent: 'center' },
  benefitRow: { flexDirection: 'row', alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center' },
  previewPriceRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  benefitPreviewRow: { flexDirection: 'row', alignItems: 'center' },
});
