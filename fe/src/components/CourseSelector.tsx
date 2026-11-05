import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/src/theme/ThemeProvider';
import type { Course } from '@/src/api/profile';

export type CourseSelectorProps = {
  courses: Course[];
  value: string | null;
  onChange: (courseId: string) => void;
  /** Lock the choice (e.g. once the test has been created under a course). */
  disabled?: boolean;
};

/** Chips to choose which course content belongs to. Renders nothing when there is only one course. */
export function CourseSelector({ courses, value, onChange, disabled }: CourseSelectorProps) {
  const { color, type, space, radius } = useTheme();
  if (courses.length < 2) return null;
  return (
    <View>
      <Text style={[type['type/caption'], { color: color('text/secondary'), marginBottom: space.xs }]}>Course</Text>
      <View style={[styles.row, { gap: space.xs }]} accessibilityRole="radiogroup">
        {courses.map((c) => {
          const active = c.id === value;
          return (
            <Pressable
              key={c.id}
              onPress={() => onChange(c.id)}
              disabled={disabled}
              accessibilityRole="radio"
              accessibilityState={{ selected: active, disabled: !!disabled }}
              style={[
                styles.chip,
                {
                  borderRadius: radius.pill,
                  paddingHorizontal: space.sm,
                  backgroundColor: active ? color('accent/tint') : color('bg/surface'),
                  borderWidth: 1,
                  borderColor: active ? color('accent/default') : color('border/subtle'),
                  opacity: disabled && !active ? 0.5 : 1,
                },
              ]}
            >
              <Text style={[type['type/body-m-medium'], { color: active ? color('accent/default') : color('text/primary') }]}>{c.name}</Text>
            </Pressable>
          );
        })}
      </View>
      {disabled ? (
        <Text style={[type['type/caption'], { color: color('text/tertiary'), marginTop: space.xs }]}>
          The course is fixed once the test is saved.
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap' },
  chip: { minHeight: 36, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' },
});
