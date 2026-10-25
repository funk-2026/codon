import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { BottomSheet, PrimaryButton } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import type { MasteryRow } from '@/src/api/analytics';

type Bucket = MasteryRow['bucket'];
const LABEL: Record<Bucket, string> = { weak: 'Needs work', improving: 'Improving', strong: 'Strong', not_enough_data: 'Not enough data' };
type Tone = { bg: 'semantic/danger-tint' | 'semantic/warning-tint' | 'semantic/success-tint' | 'bg/sunken'; fg: 'semantic/danger' | 'semantic/warning' | 'semantic/success' | 'text/tertiary' };
const TONE: Record<Bucket, Tone> = {
  weak: { bg: 'semantic/danger-tint', fg: 'semantic/danger' },
  improving: { bg: 'semantic/warning-tint', fg: 'semantic/warning' },
  strong: { bg: 'semantic/success-tint', fg: 'semantic/success' },
  not_enough_data: { bg: 'bg/sunken', fg: 'text/tertiary' },
};

/**
 * Topic mastery heat-map (FE-5.4): one coloured tile per chapter, grouped by
 * subject — colour AND label carry the bucket, so it reads in greyscale too.
 * Tap a tile for details and (when custom tests are on) "Practise this chapter".
 */
export function MasteryHeatmap({
  subjects, onPractise,
}: { subjects: { name: string; accuracy: number; correct: number; answers: number; chapters: MasteryRow[] }[]; onPractise?: (chapterId: string) => void }) {
  const { color, type, space, radius } = useTheme();
  const [open, setOpen] = useState<MasteryRow | null>(null);

  return (
    <View style={{ gap: space.md }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }} accessible accessibilityLabel="Legend: red needs work, amber improving, green strong, grey not enough data">
        {(Object.keys(LABEL) as Bucket[]).map((b) => (
          <View key={b} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <View style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: color(TONE[b].bg), borderWidth: 1, borderColor: color(TONE[b].fg) }} />
            <Text style={[type['type/caption'], { color: color('text/secondary') }]}>{LABEL[b]}</Text>
          </View>
        ))}
      </View>

      {subjects.map((s) => (
        <View key={s.name} style={{ gap: space.xs }}>
          <Text style={[type['type/body-m-medium'], { color: color('text/primary') }]}>
            {s.name} <Text style={[type['type/caption'], { color: color('text/secondary') }]}>· {Math.round(s.accuracy * 100)}% ({s.correct}/{s.answers})</Text>
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {s.chapters.map((c) => {
              const t = TONE[c.bucket];
              const pct = Math.round(c.accuracy * 100);
              return (
                <Pressable
                  key={c.chapter_id ?? c.chapter}
                  onPress={() => setOpen(c)}
                  accessibilityRole="button"
                  accessibilityLabel={`${c.chapter}: ${c.bucket === 'not_enough_data' ? 'not enough data' : `${pct} percent, ${LABEL[c.bucket]}`}`}
                  style={({ pressed }) => ({
                    width: 104, minHeight: 64, padding: 6, borderRadius: radius.sm, justifyContent: 'space-between',
                    backgroundColor: color(t.bg), borderWidth: 1, borderColor: color(t.fg), opacity: pressed ? 0.85 : 1,
                  })}
                >
                  <Text style={[type['type/caption'], { color: color('text/primary') }]} numberOfLines={2}>{c.chapter}</Text>
                  <Text style={[type['type/body-m-medium'], { color: color(t.fg) }]}>{c.bucket === 'not_enough_data' ? '—' : `${pct}%`}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}

      <BottomSheet visible={!!open} onClose={() => setOpen(null)} title={open?.chapter ?? ''}>
        {open ? (
          <View style={{ gap: space.sm }}>
            <Text style={[type['type/body-m'], { color: color('text/secondary') }]}>{open.subject}</Text>
            <Text style={[type['type/h3'], { color: color(TONE[open.bucket].fg) }]}>{LABEL[open.bucket]}</Text>
            <Text style={[type['type/body-m'], { color: color('text/primary') }]}>
              {open.correct} of {open.answers} answers correct ({Math.round(open.accuracy * 100)}%) across {open.questions_attempted} question{open.questions_attempted === 1 ? '' : 's'}.
            </Text>
            {open.last_practised ? (
              <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>Last practised {new Date(open.last_practised).toLocaleDateString()}</Text>
            ) : null}
            {onPractise && open.chapter_id ? (
              <PrimaryButton label="Practise this chapter" onPress={() => { const id = open.chapter_id!; setOpen(null); onPractise(id); }} />
            ) : null}
          </View>
        ) : null}
      </BottomSheet>
    </View>
  );
}
