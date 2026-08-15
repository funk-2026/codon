import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '@/src/theme/ThemeProvider';
import { useAuth } from '@/src/auth/AuthContext';
import { listCourses } from '@/src/api/courses';
import { updateMe } from '@/src/api/profile';
import type { Course } from '@/src/api/profile';

export default function ProfileSetupRoute() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  const insets = useSafeAreaInsets();

  const [name, setName] = useState('');
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<string | null>(null);
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadCourses() {
      try {
        const res = await listCourses();
        setCourses(res.courses.filter(c => c.is_active));
        if (res.courses.length === 1) {
          setSelectedCourse(res.courses[0].id);
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load courses');
      } finally {
        setLoading(false);
      }
    }
    loadCourses();
  }, []);

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
        router.replace('/(admin)/(home)');
      } else if (user?.role === 'teacher') {
        router.replace('/(teacher)/(home)');
      } else {
        router.replace('/(student)/(home)');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to save profile');
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: color('bg/canvas') }]}>
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
              type['type/body-l'],
              {
                backgroundColor: color('bg/sunken'),
                borderRadius: radius.md,
                padding: space.md,
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
            <ActivityIndicator color={color('accent/default')} style={{ marginTop: space.md, alignSelf: 'flex-start' }} />
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
                  ? color('accent/pressed')
                  : color('accent/default'),
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  submitBtn: {
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
});
