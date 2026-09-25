import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useTheme } from '@/src/theme/ThemeProvider';

/**
 * Math rendering placeholder (FE-1.13, partly done).
 *
 * The math-rendering SPIKE (FE-1.1) needs a device to measure and has NOT been
 * run, so full LaTeX typesetting is not implemented. Until it is, formulas are
 * shown as readable TeX source in a monospace chip (inline) or a scrollable
 * block, with the TeX as the accessibility label. The documented, working path
 * for formula-heavy questions is unchanged: teachers upload the formula as an
 * image (CM-RC6 fallback), plus sub/superscript text for simple chemistry.
 */
export function MathInline({ tex, fontSize }: { tex: string; fontSize?: number }) {
  const { color, type } = useTheme();
  return (
    <Text
      accessibilityLabel={`Formula: ${tex}`}
      style={[type['type/body-m'], { fontFamily: 'monospace', fontSize, color: color('accent/default'), backgroundColor: color('accent/tint') }]}
    >
      {` ${tex} `}
    </Text>
  );
}

export function MathBlock({ tex }: { tex: string }) {
  const { color, type, space, radius } = useTheme();
  return (
    <View
      accessible
      accessibilityLabel={`Formula: ${tex}`}
      style={{ backgroundColor: color('accent/tint'), borderRadius: radius.sm, paddingVertical: space.sm }}
    >
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: space.sm }}>
        <Text style={[type['type/body-l'], { fontFamily: 'monospace', color: color('accent/default') }]}>{tex}</Text>
      </ScrollView>
    </View>
  );
}
