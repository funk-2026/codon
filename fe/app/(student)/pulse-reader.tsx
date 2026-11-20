import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { EmptyState, PrimaryButton, Screen, ScreenHeader, SecondaryButton } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { markPulseRead } from '@/src/api/study';
import { groupByChapter, LOCAL_SUBJECTS, nextPulseIndex, PULSE_SECONDS } from '@/src/study/logic';
import { useStudyItems, type StudyItem } from '@/src/study/useStudyItems';

/** The Pulse reader. One minute per item, then the next. On the last item it returns to the list (production behaviour is still open). */
export default function PulseReaderRoute() {
  const { id, subject: rawSubject } = useLocalSearchParams<{ id?: string; subject?: string }>();
  const subject = LOCAL_SUBJECTS.find((s) => s === rawSubject) ?? 'All';
  const { items } = useStudyItems('pulse');
  const ordered = groupByChapter(items, subject).flatMap((g) => g.items);
  const [currentId, setCurrentId] = useState(id ?? '');
  const index = ordered.findIndex((i) => i.id === currentId);
  const item = index >= 0 ? ordered[index] : undefined;
  const router = useRouter();

  if (!item) {
    return (
      <Screen>
        <ScreenHeader title="Pulse" />
        <EmptyState title="This item isn’t available" description="It may have been removed." action={<SecondaryButton label="Back" onPress={() => router.back()} />} />
      </Screen>
    );
  }
  const nextIdx = nextPulseIndex(index, ordered.length);
  return <Reader key={item.id} item={item} position={`${index + 1} of ${ordered.length}`} onNext={() => (nextIdx == null ? router.back() : setCurrentId(ordered[nextIdx].id))} last={nextIdx == null} />;
}

function Reader({ item, position, onNext, last }: { item: StudyItem; position: string; onNext: () => void; last: boolean }) {
  const { color, type, space, radius } = useTheme();
  const qc = useQueryClient();
  const read = useMutation({ mutationFn: () => markPulseRead(item.id), onSuccess: () => void qc.invalidateQueries({ queryKey: ['pulse'] }) });
  const [left, setLeft] = useState(PULSE_SECONDS);
  const [paused, setPaused] = useState(false);
  const { mutate } = read;
  useEffect(() => mutate(), [mutate]);
  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => setLeft((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [paused]);
  useEffect(() => {
    if (left <= 0) onNext();
  }, [left, onNext]);

  return (
    <Screen>
      <ScreenHeader title="Pulse" />
      <View style={{ paddingHorizontal: space.md, gap: 6 }}>
        <View style={{ height: 6, borderRadius: 3, backgroundColor: color('bg/sunken') }}>
          <View style={{ width: `${Math.max(0, (left / PULSE_SECONDS) * 100)}%`, height: 6, borderRadius: 3, backgroundColor: color('accent/default') }} />
        </View>
        <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>{position} · {Math.max(0, left)}s{paused ? ' · paused' : ''}</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: space.md, gap: space.sm, paddingBottom: space['3xl'] }}>
        <Text style={[type['type/overline'], { color: color('text/tertiary') }]}>{item.chapter_name.toUpperCase()} · {item.subject_name}</Text>
        <Text style={[type['type/h1'], { color: color('text/primary') }]}>{item.title}</Text>
        <View style={{ backgroundColor: color('bg/surface'), borderRadius: radius.lg, padding: space.md }}>
          <Text style={[type['type/body-l'], { color: color('text/primary'), lineHeight: 26 }]}>{item.body || 'No details were added for this item.'}</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <View style={{ flex: 1 }}>
            <SecondaryButton label={paused ? 'Resume' : 'Pause'} onPress={() => setPaused((p) => !p)} />
          </View>
          <View style={{ flex: 1 }}>
            <PrimaryButton label={last ? 'Done' : 'Next'} onPress={onNext} />
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}
