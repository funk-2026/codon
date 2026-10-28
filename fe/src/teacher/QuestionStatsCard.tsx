import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { useTheme } from '@/src/theme/ThemeProvider';
import { getQuestionStats, type QuestionStats } from '@/src/api/questionBank';
import { formatDuration } from '@/src/attempt/analysis';

const DIFF_LABEL: Record<string, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };

/**
 * How students do on a live question (FE-2.18): accuracy, average time, the
 * difficulty the results suggest vs. the tagged one, and open reports. Shows a
 * "not enough data yet" line below the cohort threshold; hides on error.
 */
export function QuestionStatsCard({ questionId }: { questionId: string }) {
  const { color, type, space, radius } = useTheme();
  const [s, setS] = useState<QuestionStats | null>(null);

  useEffect(() => {
    let alive = true;
    getQuestionStats(questionId).then((r) => alive && setS(r)).catch(() => {});
    return () => {
      alive = false;
    };
  }, [questionId]);

  if (!s) return null;
  const pct = s.accuracy != null ? Math.round(s.accuracy * 100) : null;
  const mismatch = s.empirical_difficulty && s.authored_difficulty && s.empirical_difficulty !== s.authored_difficulty;

  return (
    <View style={{ backgroundColor: color('bg/surface'), borderRadius: radius.md, padding: space.md, gap: space.xs }}>
      <Text style={[type['type/overline'], { color: color('text/tertiary') }]}>HOW STUDENTS DO</Text>
      {!s.sufficient_data ? (
        <Text style={[type['type/body-m'], { color: color('text/secondary') }]}>
          {s.attempts} answer{s.attempts === 1 ? '' : 's'} so far — stats appear after {s.min_attempts}.
        </Text>
      ) : (
        <>
          <View style={{ flexDirection: 'row', gap: space.md }}>
            <Stat label="Answered" value={String(s.attempts)} />
            <Stat label="Correct" value={pct != null ? `${pct}%` : '—'} />
            <Stat label="Avg time" value={s.avg_time_seconds != null ? formatDuration(s.avg_time_seconds) : '—'} />
          </View>
          {mismatch ? (
            <Text style={[type['type/caption'], { color: color('semantic/warning') }]}>
              Tagged {DIFF_LABEL[s.authored_difficulty] ?? s.authored_difficulty}, but results look {DIFF_LABEL[s.empirical_difficulty!] ?? s.empirical_difficulty} — consider re-tagging.
            </Text>
          ) : null}
          {s.flags?.includes('low_accuracy') ? (
            <Text style={[type['type/caption'], { color: color('semantic/danger') }]}>Very few students get this right — check the answer key and wording.</Text>
          ) : null}
          {s.flags?.includes('too_easy') ? (
            <Text style={[type['type/caption'], { color: color('text/secondary') }]}>Almost everyone gets this right — it may be too easy for its level.</Text>
          ) : null}
        </>
      )}
      {s.open_reports > 0 ? (
        <Text style={[type['type/caption'], { color: color('semantic/danger') }]}>
          {s.open_reports} open report{s.open_reports === 1 ? '' : 's'} from students — see Reports.
        </Text>
      ) : null}
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
