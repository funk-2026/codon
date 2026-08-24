import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CaretLeft, CheckCircle, WarningCircle, X } from 'phosphor-react-native';
import { EmptyState, InputField, PrimaryButton, SkeletonBlock, TextButton, useToast } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { adminListSubscriptionPlans, createSubscriptionPlan, updateSubscriptionPlan } from '@/src/api/admin';
import { listCourses } from '@/src/api/courses';
import type { Course } from '@/src/api/courses';

export default function SubscriptionPlanEditRoute() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { show } = useToast();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isEditing = !!id;

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [courses, setCourses] = useState<Course[]>([]);

  const [name, setName] = useState('');
  const [courseId, setCourseId] = useState<string>('');
  const [days, setDays] = useState('');
  const [price, setPrice] = useState('');
  const [benefits, setBenefits] = useState<string[]>(['']);
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(() => {
    setLoading(true);
    // Fetch courses first
    listCourses()
      .then(res => {
        setCourses(res.courses || []);
        if (res.courses && res.courses.length > 0 && !isEditing) {
          setCourseId(res.courses[0].id);
        }
      })
      .then(() => {
        if (isEditing) {
          return adminListSubscriptionPlans().then((res) => {
            const plan = res.plans.find((p) => p.id === id);
            if (plan) {
              setName(plan.name);
              setDays(plan.duration_days.toString());
              setPrice((plan.price_paise / 100).toString());
              setBenefits(plan.benefits && plan.benefits.length > 0 ? plan.benefits : ['']);
              setActive(plan.is_active);
              setCourseId(plan.course_id);
            }
          });
        }
      })
      .then(() => setLoadError(false))
      .catch(() => {
        show('Failed to load data', 'error');
        setLoadError(true);
      })
      .finally(() => setLoading(false));
  }, [id, isEditing, show]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const valid = name.trim().length > 0 && days.trim().length > 0 && price.trim().length > 0 && !!courseId && !loading;

  const handleSave = () => {
    if (!valid || saving) return;
    setSaving(true);
    
    const payload = {
      name,
      course_id: courseId,
      duration_days: parseInt(days, 10),
      price_paise: parseFloat(price) * 100,
      currency: 'INR',
      benefits: benefits.filter((b) => b.trim().length > 0),
      is_active: active,
    };

    const req = isEditing ? updateSubscriptionPlan(id!, payload) : createSubscriptionPlan(payload);

    req
      .then(() => {
        show('Plan saved', 'success');
        router.replace('/(admin)/(payments)/subscription-plan-list');
      })
      .catch((e) => {
        show(e.message || 'Failed to save', 'error');
      })
      .finally(() => setSaving(false));
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

      {loading ? (
        <View style={{ paddingHorizontal: space.md, marginTop: space.xl, gap: space.lg }}>
          <SkeletonBlock height={56} radius={radius.md} />
          <SkeletonBlock height={56} radius={radius.md} />
          <SkeletonBlock height={56} radius={radius.md} />
          <SkeletonBlock height={56} radius={radius.md} />
        </View>
      ) : loadError ? (
        <EmptyState
          icon={<WarningCircle size={32} color={color('semantic/danger')} weight="fill" />}
          title="Couldn't load plan data"
          description="Something went wrong fetching courses and plan details."
          action={<TextButton label="Retry" onPress={loadData} />}
          style={{ flex: 1 }}
        />
      ) : (
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
              {courses.map((c) => {
                const activeChip = courseId === c.id;
                return (
                  <Pressable
                    key={c.id}
                    onPress={() => setCourseId(c.id)}
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
                      {c.name}
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
      )}

      {!loadError ? (
        <View style={{ paddingHorizontal: space.md, marginBottom: space.lg }}>
          <PrimaryButton label="Save Plan" onPress={handleSave} disabled={!valid} loading={saving} />
        </View>
      ) : null}
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
