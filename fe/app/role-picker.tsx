import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  interpolateColor,
} from 'react-native-reanimated';
import { ShieldCheck, Chalkboard, GraduationCap, CheckCircle, CaretLeft } from 'phosphor-react-native';
import { PrimaryButton } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { saveAdminActiveRole, type AdminActiveRole } from '@/src/auth/tokenStore';

type RoleOption = {
  id: AdminActiveRole;
  name: string;
  descriptor: string;
  badge?: string;
  icon: React.ReactNode;
  destination: string;
};

export default function RolePickerRoute() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const { source } = useLocalSearchParams<{ source?: string }>();
  const isFromSettings = source === 'settings';

  const roles: RoleOption[] = [
    {
      id: 'admin',
      name: 'Admin',
      descriptor: 'Manage platform, users & content.',
      icon: <ShieldCheck size={24} color={color('accent/default')} weight="duotone" />,
      destination: '/(admin)/(home)',
    },
    {
      id: 'teacher',
      name: 'Teacher',
      descriptor: 'Create tests & upload content.',
      icon: <Chalkboard size={24} color={color('accent/default')} weight="duotone" />,
      destination: '/(teacher)/(tabs)/(home)',
    },
    {
      id: 'student',
      name: 'Student',
      descriptor: 'Learn, practice & grow.',
      icon: <GraduationCap size={24} color={color('accent/default')} weight="duotone" />,
      destination: '/(student)/(home)',
    },
  ];

  const [selected, setSelected] = useState<RoleOption | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleContinue = async () => {
    if (!selected || submitting) return;
    setSubmitting(true);
    await saveAdminActiveRole(selected.id);
    setTimeout(() => router.replace(selected.destination as any), 700);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: color('bg/canvas') }]}>
      {isFromSettings ? (
        <View style={{ height: 44, paddingLeft: space.md, justifyContent: 'center' }}>
          <Pressable
            accessibilityRole="button"
            hitSlop={space.xs}
            onPress={() => router.back()}
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
          >
            <CaretLeft size={24} color={color('text/primary')} weight="bold" />
          </Pressable>
        </View>
      ) : (
        <View style={{ height: 44 }} />
      )}

      <View style={[styles.body, { marginHorizontal: space.md }]}>
        <Text
          style={[type['type/h1'], { color: color('text/primary'), marginTop: isFromSettings ? space.md : space['2xl'] }]}
          numberOfLines={2}
        >
          How would you like to continue?
        </Text>
        <Text
          style={[
            type['type/body-m'],
            { color: color('text/secondary'), marginTop: space['2xs'] },
          ]}
        >
          You can switch roles anytime from your profile.
        </Text>

        <View style={{ gap: space.md, marginTop: space.xl }}>
          {roles.map((r, i) => (
            <RoleCard
              key={r.id}
              role={r}
              selected={selected?.id === r.id}
              delayMs={i * 80}
              disabled={submitting}
              onPress={() => setSelected(r)}
            />
          ))}
        </View>
      </View>

      <View style={[styles.footer, { marginHorizontal: space.md, marginBottom: space.lg }]}>
        <PrimaryButton
          label="Continue"
          onPress={handleContinue}
          loading={submitting}
          disabled={!selected || submitting}
        />
      </View>
    </SafeAreaView>
  );
}

function RoleCard({
  role,
  selected,
  delayMs,
  disabled,
  onPress,
}: {
  role: RoleOption;
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

  const borderColorSelected = color('accent/default');
  const borderColorUnselected = color('border/subtle');
  const bgColorSelected = color('accent/tint');
  const bgColorUnselected = color('bg/surface');

  const selStyle = useAnimatedStyle(() => {
    return {
      borderColor: interpolateColor(
        sel.value,
        [0, 1],
        [borderColorUnselected, borderColorSelected]
      ),
      backgroundColor: interpolateColor(
        sel.value,
        [0, 1],
        [bgColorUnselected, bgColorSelected]
      ),
      borderWidth: sel.value > 0.5 ? 2 : 1,
    };
  });

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
              {role.icon}
            </View>
            <View style={{ flex: 1, marginLeft: space.md }}>
              {role.badge ? (
                <Text
                  style={[
                    type['type/overline'],
                    { color: color('accent/default'), marginBottom: 2 },
                  ]}
                >
                  {role.badge}
                </Text>
              ) : null}
              <Text style={[type['type/h3'], { color: color('text/primary') }]}>
                {role.name}
              </Text>
              <Text
                style={[
                  type['type/body-m'],
                  { color: color('text/secondary'), marginTop: 2 },
                ]}
                numberOfLines={1}
              >
                {role.descriptor}
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

