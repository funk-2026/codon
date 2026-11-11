import { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { WarningCircle } from 'phosphor-react-native';
import { EmptyState, SkeletonBlock, TextButton, Screen } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { useAuth } from '@/src/auth/AuthContext';
import { updateMe } from '@/src/api/profile';
import type { Course } from '@/src/api/profile';
import { ROUTES } from '@/src/navigation/routes';
import { inputText } from '@/src/theme/inputs';
import { useCourses } from '@/src/queries/curriculum';

export default function ProfileSetupRoute() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  const insets = useSafeAreaInsets();

  const [name, setName] = useState('');
  const [pickedCourse, setSelectedCourse] = useState<string | null>(null);
  
  const coursesQuery = useCourses();
  const allCourses: Course[] = coursesQuery.data ?? [];
  const courses = allCourses.filter((c) => c.is_active);
  const loading = coursesQuery.isPending;
  const loadError = coursesQuery.isError;
  const loadCourses = () => void coursesQuery.refetch();
  const selectedCourse = pickedCourse ?? (allCourses.length === 1 ? allCourses[0].id : null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);


  const handleSave = async () => {
    if (!name.trim()) {
      setError('Please enter your name');
      return;
    }
    if (!selectedCourse) {
      setError('Please select a course');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await updateMe({
        name: name.trim(),
        selected_course_id: selectedCourse,
      });
      await refreshUser();
      
      if (user?.role === 'admin') {
        router.replace(ROUTES.admin.home);
      } else if (user?.role === 'teacher') {
        router.replace(ROUTES.teacher.home);
      } else {
        router.replace(ROUTES.student.home);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to save profile');
      setSaving(false);
    }
  };

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{
          padding: space.lg,
          paddingBottom: insets.bottom + space['2xl'],
        }}
      >
        <Text style={[type['type/h1'], { color: color('text/primary'), marginTop: space.xl }]}>
          Almost there
        </Text>
        <Text
          style={[
            type['type/body-m'],
            { color: color('text/secondary'), marginTop: space.xs, marginBottom: space['2xl'] },
          ]}
        >
          Let's get your profile set up so we can personalize your learning experience.
        </Text>

        <View style={{ marginBottom: space.xl }}>
          <Text style={[type['type/body-m-medium'], { color: color('text/primary'), marginBottom: space.sm }]}>
            What's your name?
          </Text>
          <TextInput
            value={name}
            onChangeText={(v) => { setName(v); setError(null); }}
            placeholder="e.g. Arjun Sharma"
            placeholderTextColor={color('text/tertiary')}
            style={[
              inputText(type['type/body-l']),
              {
                backgroundColor: color('bg/sunken'),
                borderRadius: radius.md,
                paddingHorizontal: space.md,
                paddingVertical: 0,
                height: 56,
                color: color('text/primary'),
                borderWidth: 1,
                borderColor: color('border/subtle'),
              },
            ]}
          />
        </View>

        <View style={{ marginBottom: space.xl }}>
          <Text style={[type['type/body-m-medium'], { color: color('text/primary'), marginBottom: space.sm }]}>
            Which course are you preparing for?
          </Text>
          
          {loading ? (
            <View style={{ gap: space.sm }}>
              {Array.from({ length: 3 }).map((_, i) => (
                <SkeletonBlock key={i} height={56} radius={radius.md} />
              ))}
            </View>
          ) : loadError ? (
            <EmptyState
              icon={<WarningCircle size={32} color={color('semantic/danger')} weight="fill" />}
              title="Couldn't load courses"
              description="Something went wrong fetching the list of courses."
              action={<TextButton label="Retry" onPress={loadCourses} />}
            />
          ) : (
            <View style={{ gap: space.sm }}>
              {courses.map(c => {
                const isSelected = selectedCourse === c.id;
                return (
                  <Pressable
                    key={c.id}
                    onPress={() => { setSelectedCourse(c.id); setError(null); }}
                    style={({ pressed }) => [
                      {
                        padding: space.md,
                        borderRadius: radius.md,
                        backgroundColor: isSelected ? color('accent/tint') : color('bg/surface'),
                        borderWidth: 1,
                        borderColor: isSelected ? color('accent/default') : color('border/subtle'),
                        opacity: pressed ? 0.8 : 1,
                      }
                    ]}
                  >
                    <Text
                      style={[
                        type['type/body-l'],
                        { color: isSelected ? color('accent/default') : color('text/primary') }
                      ]}
                    >
                      {c.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>

        {error ? (
          <Text
            style={[
              type['type/caption'],
              { color: color('semantic/danger'), marginBottom: space.lg, textAlign: 'center' },
            ]}
          >
            {error}
          </Text>
        ) : null}

        <Pressable
          onPress={handleSave}
          disabled={saving || loading}
          style={({ pressed }) => [
            styles.submitBtn,
            {
              backgroundColor: saving || loading
                ? color('border/strong')
                : pressed
                  ? color('action/primary-pressed')
                  : color('action/primary'),
              borderRadius: radius.pill,
              opacity: (saving || loading) ? 0.7 : 1,
            },
          ]}
        >
          <Text style={[type['type/h3'], { color: color('accent/on-accent') }]}>
            {saving ? 'Saving...' : 'Continue'}
          </Text>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  submitBtn: {
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
});
