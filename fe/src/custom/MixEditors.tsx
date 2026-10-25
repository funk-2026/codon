import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { useTheme } from '@/src/theme/ThemeProvider';
import type { Blueprint, Difficulty } from '@/src/api/customTests';
import { Stepper } from './ui';

type Mix = Record<Difficulty, number>;
const toPct = (m?: Blueprint['difficulty_mix']): Mix =>
  m && Object.keys(m).length ? { easy: Math.round((m.easy ?? 0) * 100), medium: Math.round((m.medium ?? 0) * 100), hard: Math.round((m.hard ?? 0) * 100) } : { easy: 30, medium: 50, hard: 20 };

/**
 * Custom difficulty mix (FE-5.2): percentages in 10 % steps. Applied to the
 * blueprint only when they add up to 100 % (server rule); until then the total
 * is shown so the student knows what to fix.
 */
export function DifficultyMixEditor({ mix, onChange }: { mix?: Blueprint['difficulty_mix']; onChange: (m: NonNullable<Blueprint['difficulty_mix']>) => void }) {
  const { color, type, space } = useTheme();
  const [pct, setPct] = useState<Mix>(() => toPct(mix));
  const total = pct.easy + pct.medium + pct.hard;

  useEffect(() => {
    if (total === 100) onChange({ easy: pct.easy / 100, medium: pct.medium / 100, hard: pct.hard / 100 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pct]);

  return (
    <View style={{ gap: space.sm }}>
      {(['easy', 'medium', 'hard'] as Difficulty[]).map((k) => (
        <Stepper key={k} label={`${k[0].toUpperCase()}${k.slice(1)} questions`} unit="%" value={pct[k]} min={0} max={100} step={10} onChange={(n) => setPct((p) => ({ ...p, [k]: n }))} />
      ))}
      <Text accessibilityLiveRegion="polite" style={[type['type/caption'], { color: total === 100 ? color('text/secondary') : color('semantic/warning') }]}>
        {total === 100 ? 'Adds up to 100 % — applied.' : `Adds up to ${total} % — make it 100 % to apply.`}
      </Text>
    </View>
  );
}

/** Custom per-subject weights (FE-5.2): relative 0–10 per subject; 0 leaves a subject out of the balance. */
export function SubjectWeightsEditor({
  subjects, weights, onChange,
}: { subjects: { id: string; name: string }[]; weights: Record<string, number>; onChange: (w: Record<string, number>) => void }) {
  const { color, type, space } = useTheme();
  const sum = subjects.reduce((n, s) => n + (weights[s.id] ?? 1), 0);
  return (
    <View style={{ gap: space.sm }}>
      {subjects.map((s) => {
        const w = weights[s.id] ?? 1;
        return (
          <View key={s.id} style={{ gap: 2 }}>
            <Stepper
              label={s.name}
              value={w}
              min={0}
              max={10}
              onChange={(n) => {
                const next = { ...Object.fromEntries(subjects.map((x) => [x.id, weights[x.id] ?? 1])), [s.id]: n };
                if (Object.values(next).some((v) => v > 0)) onChange(next); // at least one subject must stay in
              }}
            />
            <Text style={[type['type/caption'], { color: color('text/tertiary'), textAlign: 'center' }]}>
              ≈ {sum > 0 ? Math.round((w / sum) * 100) : 0} % of the questions
            </Text>
          </View>
        );
      })}
    </View>
  );
}
