import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { CaretDown, CaretRight, WarningCircle } from 'phosphor-react-native';
import { BottomSheet, EmptyState, SkeletonBlock, TextButton } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { getCurriculum } from '@/src/api/courses';

export type PickedPlace = { courseId: string; subjectId: string; chapterId: string; label: string };

/**
 * Choose where new content lives: subject, then chapter, in one sheet over the form (no separate
 * screens to drill through). One subject is open at a time, like the student browser.
 */
export function ChapterPickerSheet({
  visible,
  onClose,
  courseId,
  selectedChapterId,
  onPick,
}: {
  visible: boolean;
  onClose: () => void;
  courseId: string | null;
  selectedChapterId?: string | null;
  onPick: (place: PickedPlace) => void;
}) {
  const { color, type, space, radius } = useTheme();
  const [open, setOpen] = useState<string | null>(null);
  const curriculum = useQuery({
    queryKey: ['teacher', 'curriculum', courseId],
    queryFn: () => getCurriculum(courseId as string),
    enabled: visible && !!courseId,
    staleTime: 5 * 60_000,
  });
  const course = curriculum.data?.course;

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Where does this go?">
      <View style={{ paddingHorizontal: space.lg, paddingTop: space.sm, gap: space.xs }}>
        {!courseId ? (
          <Text style={[type['type/body-m'], { color: color('text/secondary') }]}>Choose a course first.</Text>
        ) : curriculum.isPending ? (
          [0, 1, 2].map((i) => <SkeletonBlock key={i} height={52} radius={radius.md} />)
        ) : curriculum.isError ? (
          <EmptyState
            icon={<WarningCircle size={32} color={color('semantic/danger')} weight="fill" />}
            title="Couldn’t load the course"
            description="Check your connection and try again."
            action={<TextButton label="Retry" onPress={() => void curriculum.refetch()} />}
          />
        ) : (course?.subjects ?? []).length === 0 ? (
          <Text style={[type['type/body-m'], { color: color('text/secondary') }]}>This course has no subjects yet.</Text>
        ) : (
          (course?.subjects ?? []).map((s) => {
            const expanded = open === s.id;
            return (
              <View key={s.id} style={{ backgroundColor: color('bg/sunken'), borderRadius: radius.md, overflow: 'hidden' }}>
                <Pressable
                  onPress={() => setOpen(expanded ? null : s.id)}
                  accessibilityRole="button"
                  accessibilityState={{ expanded }}
                  style={{ padding: space.sm, minHeight: 48, flexDirection: 'row', alignItems: 'center' }}
                >
                  <Text style={[type['type/h3'], { color: color('text/primary'), flex: 1 }]}>{s.name}</Text>
                  <Text style={[type['type/caption'], { color: color('text/tertiary'), marginRight: space.xs }]}>{(s.chapters ?? []).length} chapters</Text>
                  {expanded ? <CaretDown size={18} color={color('text/tertiary')} /> : <CaretRight size={18} color={color('text/tertiary')} />}
                </Pressable>
                {expanded
                  ? (s.chapters ?? []).map((c) => {
                      const on = c.id === selectedChapterId;
                      return (
                        <Pressable
                          key={c.id}
                          onPress={() => onPick({ courseId: courseId as string, subjectId: s.id, chapterId: c.id, label: `${course?.name ?? 'Course'} · ${s.name} · ${c.name}` })}
                          accessibilityRole="button"
                          accessibilityState={{ selected: on }}
                          style={{ paddingVertical: space.sm, paddingHorizontal: space.md, minHeight: 44, justifyContent: 'center', backgroundColor: on ? color('accent/tint') : 'transparent', borderTopWidth: 1, borderTopColor: color('border/subtle') }}
                        >
                          <Text style={[type['type/body-m-medium'], { color: on ? color('accent/default') : color('text/primary') }]}>{c.name}</Text>
                        </Pressable>
                      );
                    })
                  : null}
              </View>
            );
          })
        )}
      </View>
    </BottomSheet>
  );
}
