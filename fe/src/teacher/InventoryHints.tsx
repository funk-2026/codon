import React, { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useTheme } from '@/src/theme/ThemeProvider';
import { getInventory, type LowInventoryChapter } from '@/src/api/questionBank';

/**
 * Inventory hints (FE-2.15): chapters whose custom-test pool is below the
 * floor, thinnest first — tells teachers where new questions help most.
 * Hidden when every chapter is healthy or the request fails.
 */
export function InventoryHints({ limit = 5 }: { limit?: number }) {
  const { color, type, space, radius } = useTheme();
  const [rows, setRows] = useState<LowInventoryChapter[]>([]);
  const [floor, setFloor] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      getInventory()
        .then((r) => {
          if (!alive) return;
          setRows(r.low_inventory.slice(0, limit));
          setFloor(r.floor);
        })
        .catch(() => {});
      return () => {
        alive = false;
      };
    }, [limit]),
  );

  if (rows.length === 0) return null;
  return (
    <View style={{ marginTop: space.xl }}>
      <Text style={[type['type/overline'], { color: color('text/tertiary'), marginBottom: space.sm }]}>CHAPTERS THAT NEED QUESTIONS</Text>
      <View style={{ backgroundColor: color('bg/surface'), borderRadius: radius.md, padding: space.md, gap: space.sm }}>
        <Text style={[type['type/caption'], { color: color('text/secondary') }]}>
          Students’ custom tests draw from tagged, published questions. These chapters have fewer than {floor}.
        </Text>
        {rows.map((r) => (
          <View
            key={r.chapter_id}
            style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}
            accessible
            accessibilityLabel={`${r.chapter}, ${r.subject}: ${r.eligible} questions, needs ${r.needed} more. ${r.mine} are yours.`}
          >
            <View style={{ flex: 1 }}>
              <Text style={[type['type/body-m'], { color: color('text/primary') }]} numberOfLines={1}>{r.chapter}</Text>
              <Text style={[type['type/caption'], { color: color('text/tertiary') }]} numberOfLines={1}>
                {r.subject} · {r.eligible} now{r.mine > 0 ? ` · ${r.mine} yours` : ''}
              </Text>
            </View>
            <Text style={[type['type/body-m-medium'], { color: color('semantic/warning') }]}>+{r.needed}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
