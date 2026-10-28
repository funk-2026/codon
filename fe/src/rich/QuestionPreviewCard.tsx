import React from 'react';
import { Text, View } from 'react-native';
import { useTheme } from '@/src/theme/ThemeProvider';
import type { MediaMap } from './ast';
import { RichContent } from './RichContent';
import { OptionCard } from './OptionCard';

export type PreviewQuestion = {
  id: string;
  content_format?: string;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option?: string;
  explanation?: string | null;
};

/**
 * Author/moderator view of a question: full stem + options with the correct one
 * marked + explanation, all through the shared renderer so a teacher/admin sees
 * exactly what a student will (CM-TA / FE-1.13).
 */
export function QuestionPreviewCard({ q, index, media }: { q: PreviewQuestion; index: number; media?: MediaMap }) {
  const { color, type, space, radius } = useTheme();
  const opts: [string, string][] = [['A', q.option_a], ['B', q.option_b], ['C', q.option_c], ['D', q.option_d]];
  const correct = q.correct_option?.trim().toUpperCase();
  return (
    <View
      style={{
        backgroundColor: color('bg/surface'),
        borderRadius: radius.md,
        padding: space.md,
        gap: space.sm,
        borderWidth: 1,
        borderColor: color('border/subtle'),
      }}
    >
      <Text style={[type['type/overline'], { color: color('text/tertiary') }]}>QUESTION {index + 1}</Text>
      <RichContent value={q.question_text} format={q.content_format} media={media} variant="stem" />
      <View style={{ gap: space.xs }}>
        {opts.map(([letter, val]) => (
          <OptionCard key={letter} letter={letter} value={val} format={q.content_format} media={media} state={correct === letter ? 'correct' : 'idle'} />
        ))}
      </View>
      {q.explanation ? (
        <View style={{ backgroundColor: color('bg/sunken'), borderRadius: radius.sm, padding: space.sm, gap: space['2xs'] }}>
          <Text style={[type['type/overline'], { color: color('text/tertiary') }]}>EXPLANATION</Text>
          <RichContent value={q.explanation} format={q.content_format} media={media} variant="explanation" />
        </View>
      ) : null}
    </View>
  );
}
