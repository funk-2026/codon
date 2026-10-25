import React, { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import RNSvg, { Circle } from 'react-native-svg';
import { BottomSheet } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { getAttempts } from '@/src/api/profile';
import { kvGet, kvSet } from '@/src/storage/kv';
import { answeredToday, GOAL_KEY, GOAL_OPTIONS, normalizeGoal } from './dailyGoal';

const SIZE = 64;
const STROKE = 7;

/**
 * Daily question goal ring (CM-A10, FE-5.15); the streak itself is shown in Home's header and stat tiles. The goal is a
 * device-local preference; progress counts questions answered in tests
 * submitted today (custom tests included). Refreshes whenever Home regains focus.
 */
export function DailyGoalCard() {
  const { color, type, space, radius } = useTheme();
  const [done, setDone] = useState<number | null>(null);
  const [goal, setGoal] = useState<number | null>(null);
  const [picking, setPicking] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      kvGet<number | null>(GOAL_KEY, null).then((g) => alive && setGoal(normalizeGoal(g)));
      getAttempts()
        .then((r) => alive && setDone(answeredToday(r.attempts)))
        .catch(() => alive && setDone(null));
      return () => {
        alive = false;
      };
    }, []),
  );

  if (goal == null) return null;
  const count = done ?? 0;
  const pct = Math.min(1, count / goal);
  const reached = count >= goal;
  const r = (SIZE - STROKE) / 2;
  const circ = 2 * Math.PI * r;
  const ink = reached ? color('semantic/success') : color('accent/default');

  const pick = (g: number) => {
    setGoal(g);
    void kvSet(GOAL_KEY, g);
    setPicking(false);
  };

  return (
    <>
      <Pressable
        onPress={() => setPicking(true)}
        accessibilityRole="button"
        accessibilityLabel={`Daily goal: ${count} of ${goal} questions answered today${reached ? ', goal reached' : ''}.`}
        accessibilityHint="Change your daily goal"
        style={({ pressed }) => ({
          flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, marginBottom: space.xs,
          backgroundColor: color('bg/surface'), borderRadius: radius.md, opacity: pressed ? 0.92 : 1,
        })}
      >
        <View style={{ width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' }}>
          <RNSvg width={SIZE} height={SIZE} style={{ position: 'absolute' }}>
            <Circle cx={SIZE / 2} cy={SIZE / 2} r={r} stroke={color('bg/sunken')} strokeWidth={STROKE} fill="none" />
            <Circle
              cx={SIZE / 2} cy={SIZE / 2} r={r} stroke={ink} strokeWidth={STROKE} fill="none" strokeLinecap="round"
              strokeDasharray={`${circ} ${circ}`} strokeDashoffset={circ * (1 - pct)}
              transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
            />
          </RNSvg>
          <Text style={[type['type/body-m-medium'], { color: color('text/primary') }]}>{count}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[type['type/body-m-medium'], { color: color('text/primary') }]}>
            {reached ? 'Daily goal reached 🎉' : `${goal - count} to go today`}
          </Text>
          <Text style={[type['type/caption'], { color: color('text/secondary') }]}>
            {count} of {goal} questions · tap to change goal
          </Text>
        </View>
      </Pressable>

      <BottomSheet visible={picking} onClose={() => setPicking(false)} title="Daily question goal">
        <View style={{ flexDirection: 'row', gap: space.xs, flexWrap: 'wrap' }}>
          {GOAL_OPTIONS.map((g) => {
            const on = g === goal;
            return (
              <Pressable
                key={g}
                onPress={() => pick(g)}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                style={{ minHeight: 44, minWidth: 64, paddingHorizontal: space.md, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: on ? color('accent/default') : color('border/subtle'), backgroundColor: on ? color('accent/tint') : color('bg/surface') }}
              >
                <Text style={[type['type/body-m-medium'], { color: on ? color('accent/default') : color('text/primary') }]}>{g}</Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={[type['type/caption'], { color: color('text/tertiary'), marginTop: space.md }]}>
          Counts questions you answer in submitted tests, including custom tests.
        </Text>
      </BottomSheet>
    </>
  );
}
