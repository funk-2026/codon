import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Atom, Flask, Leaf, CheckCircle } from 'phosphor-react-native';
import { PrimaryButton } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';

type CourseId = 'neet-ug' | '10th' | '9th';

type Course = {
  id: CourseId;
  name: string;
  descriptor: string;
  badge?: string;
  icon: React.ReactNode;
};

export default function CourseSelectionRoute() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const { edit } = useLocalSearchParams<{ edit?: string }>();
  const isEditing = edit === '1';

  const courses: Course[] = [
    {
      id: 'neet-ug',
      name: 'NEET UG',
      descriptor: 'Full syllabus coverage across Physics, Chemistry, Botany, and Zoology.',
      badge: 'MOST STUDENTS START HERE',
      icon: <Atom size={24} color={color('accent/default')} weight="duotone" />,
    },
    {
      id: '10th',
      name: '10th Standard',
      descriptor: 'Board exam preparation across your core subjects.',
      icon: <Flask size={24} color={color('accent/default')} weight="duotone" />,
    },
    {
      id: '9th',
      name: '9th Standard',
      descriptor: 'Build your foundation ahead of board years.',
      icon: <Leaf size={24} color={color('accent/default')} weight="duotone" />,
    },
  ];

  const [selected, setSelected] = useState<CourseId | null>(isEditing ? 'neet-ug' : null);
  const [submitting, setSubmitting] = useState(false);

  const handleContinue = () => {
    if (!selected || submitting) return;
    setSubmitting(true);
    setTimeout(() => router.replace('/(student)/(home)'), 700);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: color('bg/canvas') }]}>
      <View style={[styles.body, { marginHorizontal: space.md }]}>
        <Text
          style={[type['type/h1'], { color: color('text/primary'), marginTop: space['2xl'] }]}
          numberOfLines={2}
        >
          What are you preparing for?
        </Text>
        <Text
          style={[
            type['type/body-m'],
            { color: color('text/secondary'), marginTop: space['2xs'] },
          ]}
        >
          You can change this anytime from your profile.
        </Text>

        <View style={{ gap: space.md, marginTop: space.xl }}>
          {courses.map((c, i) => (
            <CourseCard
              key={c.id}
              course={c}
              selected={selected === c.id}
              delayMs={i * 80}
              disabled={submitting}
              onPress={() => setSelected(c.id)}
            />
          ))}
        </View>
      </View>

      <View style={[styles.footer, { marginHorizontal: space.md, marginBottom: space.lg }]}>
        <PrimaryButton
          label={isEditing ? 'Save' : 'Continue'}
          onPress={handleContinue}
          loading={submitting}
          disabled={!selected || submitting}
        />
      </View>
    </SafeAreaView>
  );
}

function CourseCard({
  course,
  selected,
  delayMs,
  disabled,
  onPress,
}: {
  course: Course;
  selected: boolean;
  delayMs: number;
  disabled: boolean;
  onPress: () => void;
}) {
  const { color, type, space, radius } = useTheme();
  const shown = useSharedValue(0);
  const sel = useSharedValue(selected ? 1 : 0);

  useEffect(() => {
    const t = setTimeout(() => {
      shown.value = withTiming(1, { duration: 300 });
    }, delayMs);
    return () => clearTimeout(t);
  }, [delayMs, shown]);

  useEffect(() => {
    sel.value = withTiming(selected ? 1 : 0, { duration: 180 });
  }, [selected, sel]);

  const enterStyle = useAnimatedStyle(() => ({
    opacity: shown.value,
    transform: [{ translateY: (1 - shown.value) * 12 }],
  }));
  const selStyle = useAnimatedStyle(() => ({
    borderColor: selected ? color('accent/default') : color('border/subtle'),
    backgroundColor: selected ? color('accent/tint') : color('bg/surface'),
    borderWidth: selected ? 2 : 1,
  }));

  return (
    <Animated.View style={enterStyle}>
      <Pressable disabled={disabled} onPress={onPress}>
        <Animated.View
          style={[
            styles.card,
            { borderRadius: radius.md, padding: space.md, minHeight: 96 },
            selStyle,
          ]}
        >
          <View style={styles.cardRow}>
            <View
              style={[
                styles.iconWrap,
                {
                  width: 40,
                  height: 40,
                  borderRadius: radius.sm,
                  backgroundColor: color('accent/tint'),
                },
              ]}
            >
              {course.icon}
            </View>
            <View style={{ flex: 1, marginLeft: space.md }}>
              {course.badge ? (
                <Text
                  style={[
                    type['type/overline'],
                    { color: color('accent/default'), marginBottom: 2 },
                  ]}
                >
                  {course.badge}
                </Text>
              ) : null}
              <Text style={[type['type/h3'], { color: color('text/primary') }]}>
                {course.name}
              </Text>
              <Text
                style={[
                  type['type/body-m'],
                  { color: color('text/secondary'), marginTop: 2 },
                ]}
                numberOfLines={1}
              >
                {course.descriptor}
              </Text>
            </View>
            {selected ? (
              <CheckCircle size={22} color={color('accent/default')} weight="fill" />
            ) : null}
          </View>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  body: { flex: 1 },
  footer: {},
  card: { justifyContent: 'center' },
  cardRow: { flexDirection: 'row', alignItems: 'center' },
  iconWrap: { alignItems: 'center', justifyContent: 'center' },
});
