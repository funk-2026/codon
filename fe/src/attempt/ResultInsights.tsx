import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { CaretRight } from 'phosphor-react-native';
import { useTheme } from '@/src/theme/ThemeProvider';
import { getAttemptReview, type ReviewItem } from '@/src/api/attempts';
import { confidenceMatrix, formatDuration, timeAnalysis } from './analysis';

const CONF_LABEL = { sure: 'Sure', unsure: 'Unsure', guess: 'Guess' } as const;

/**
 * Time analysis (CM-A5) and confidence-vs-correctness (CM-A7) for one attempt.
 * Loads the full review once; each card hides itself when there isn't enough
 * data, and a failed load hides both (the rest of the result screen stands).
 */
export function ResultInsights({ attemptId, onOpenQuestion }: { attemptId: string; onOpenQuestion: (position: number) => void }) {
  const [items, setItems] = useState<ReviewItem[] | null>(null);

  useEffect(() => {
    let alive = true;
    getAttemptReview(attemptId)
      .then((r) => alive && setItems(r.review))
      .catch(() => alive && setItems([]));
    return () => {
      alive = false;
    };
  }, [attemptId]);

  const time = useMemo(() => (items ? timeAnalysis(items) : null), [items]);
  const conf = useMemo(() => (items ? confidenceMatrix(items) : null), [items]);

  if (!time && !conf) return null;
  return (
    <>
      {time ? <TimeCard t={time} onOpenQuestion={onOpenQuestion} /> : null}
      {conf ? <ConfidenceCard m={conf} /> : null}
    </>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  const { color, type, space, radius } = useTheme();
  return (
    <View style={{ marginTop: space.lg }}>
      <Text style={[type['type/overline'], { color: color('text/tertiary'), marginBottom: space.sm }]}>{title.toUpperCase()}</Text>
      <View style={{ backgroundColor: color('bg/surface'), borderRadius: radius.md, padding: space.md, gap: space.md }}>{children}</View>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const { color, type } = useTheme();
  return (
    <View style={{ flex: 1 }} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text style={[type['type/h3'], { color: color('text/primary') }]}>{value}</Text>
      <Text style={[type['type/caption'], { color: color('text/secondary') }]}>{label}</Text>
    </View>
  );
}

function TimeCard({ t, onOpenQuestion }: { t: NonNullable<ReturnType<typeof timeAnalysis>>; onOpenQuestion: (p: number) => void }) {
  const { color, type, space } = useTheme();
  const hints: string[] = [];
  if (t.rushedWrong > 0) hints.push(`${t.rushedWrong} wrong answer${t.rushedWrong > 1 ? 's were' : ' was'} given very quickly — slow down on those.`);
  if (t.stuck > 0) hints.push(`You got stuck on ${t.stuck} question${t.stuck > 1 ? 's' : ''} (over twice your average) — consider skipping and returning.`);

  return (
    <Card title="Time analysis">
      <View style={{ flexDirection: 'row', gap: space.md }}>
        <Stat label="Avg per question" value={formatDuration(t.avgSeconds)} />
        <Stat label="Total answering time" value={formatDuration(t.totalSeconds)} />
      </View>

      <View style={{ gap: space['2xs'] }}>
        <Text style={[type['type/body-m-medium'], { color: color('text/primary') }]}>Slowest questions</Text>
        {t.slowest.map((s) => (
          <Pressable
            key={s.position}
            onPress={() => onOpenQuestion(s.position)}
            accessibilityRole="button"
            accessibilityLabel={`Question ${s.position}, ${formatDuration(s.seconds)}, ${s.correct ? 'correct' : 'incorrect'}. Open in review`}
            style={{ flexDirection: 'row', alignItems: 'center', minHeight: 44, gap: space.sm }}
          >
            <Text style={[type['type/body-m'], { color: color('text/primary'), flex: 1 }]}>Q{s.position}</Text>
            <Text style={[type['type/caption'], { color: s.correct ? color('semantic/success') : color('semantic/danger') }]}>{s.correct ? 'Correct' : 'Incorrect'}</Text>
            <Text style={[type['type/body-m-medium'], { color: color('text/primary'), minWidth: 64, textAlign: 'right' }]}>{formatDuration(s.seconds)}</Text>
            <CaretRight size={16} color={color('text/tertiary')} />
          </Pressable>
        ))}
      </View>

      {t.bySubject.length > 1 ? (
        <View style={{ gap: space['2xs'] }}>
          <Text style={[type['type/body-m-medium'], { color: color('text/primary') }]}>Average by subject</Text>
          {t.bySubject.map((s) => (
            <View key={s.name} style={{ flexDirection: 'row', justifyContent: 'space-between' }} accessible accessibilityLabel={`${s.name}: ${formatDuration(s.avgSeconds)} per question`}>
              <Text style={[type['type/body-m'], { color: color('text/secondary'), flex: 1 }]} numberOfLines={1}>{s.name}</Text>
              <Text style={[type['type/body-m'], { color: color('text/primary') }]}>{formatDuration(s.avgSeconds)}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {hints.map((h) => (
        <Text key={h} style={[type['type/caption'], { color: color('text/secondary') }]}>{h}</Text>
      ))}
    </Card>
  );
}

function ConfidenceCard({ m }: { m: NonNullable<ReturnType<typeof confidenceMatrix>> }) {
  const { color, type, space } = useTheme();
  return (
    <Card title="Confidence vs. correctness">
      {m.rows.filter((r) => r.correct + r.wrong > 0).map((r) => {
        const n = r.correct + r.wrong;
        const pct = Math.round((r.correct / n) * 100);
        return (
          <View key={r.key} accessible accessibilityLabel={`${CONF_LABEL[r.key]}: ${r.correct} correct, ${r.wrong} wrong`}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={[type['type/body-m'], { color: color('text/primary') }]}>{CONF_LABEL[r.key]}</Text>
              <Text style={[type['type/body-m-medium'], { color: color('text/primary') }]}>{r.correct}/{n} right</Text>
            </View>
            <View style={{ height: 6, borderRadius: 3, backgroundColor: color('semantic/danger-tint'), marginTop: 6, overflow: 'hidden' }}>
              <View style={{ width: `${pct}%`, height: 6, backgroundColor: color('semantic/success') }} />
            </View>
          </View>
        );
      })}
      {m.confidentWrong > 0 ? (
        <Text style={[type['type/body-m'], { color: color('semantic/danger') }]}>
          {m.confidentWrong} answer{m.confidentWrong > 1 ? 's' : ''} you were sure about {m.confidentWrong > 1 ? 'were' : 'was'} wrong — these are worth revisiting first.
        </Text>
      ) : null}
      {m.unsureRight > 0 ? (
        <Text style={[type['type/caption'], { color: color('text/secondary') }]}>
          You got {m.unsureRight} right while unsure or guessing — you know more than you think.
        </Text>
      ) : null}
    </Card>
  );
}
