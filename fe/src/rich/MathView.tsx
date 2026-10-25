import React, { useMemo } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { useTheme } from '@/src/theme/ThemeProvider';
import { EX_PER_FONT_PX, texToSvg } from './mathSvg';

/**
 * Formulas (FE-1.13, decision D14 = on-device MathJax → SVG).
 *
 * Typeset with MathJax and drawn with react-native-svg, in the surrounding
 * text colour (so dark mode and the wellness palette just work) and sized from
 * the surrounding font. Anything MathJax can't parse falls back to the TeX
 * source in a monospace chip, so a bad formula never breaks a question. The
 * TeX is always the accessibility label.
 */
export function MathInline({ tex, fontSize = 14, color: ink }: { tex: string; fontSize?: number; color?: string }) {
  const { color, type } = useTheme();
  const svg = useMemo(() => texToSvg(tex, false), [tex]);
  const fill = ink ?? color('text/primary');

  if (!svg) {
    return (
      <Text
        accessibilityLabel={`Formula: ${tex}`}
        style={[type['type/body-m'], { fontFamily: 'monospace', fontSize, color: color('accent/default'), backgroundColor: color('accent/tint') }]}
      >
        {` ${tex} `}
      </Text>
    );
  }
  const ex = fontSize * EX_PER_FONT_PX;
  return (
    // An inline View inside Text sits on the baseline; MathJax's vertical-align says how far below it the formula reaches.
    <View
      accessible
      accessibilityLabel={`Formula: ${tex}`}
      style={{ width: svg.widthEx * ex, height: svg.heightEx * ex, transform: [{ translateY: -svg.verticalAlignEx * ex }] }}
    >
      <SvgXml xml={svg.xml} width={svg.widthEx * ex} height={svg.heightEx * ex} color={fill} />
    </View>
  );
}

export function MathBlock({ tex, fontSize = 17, color: ink }: { tex: string; fontSize?: number; color?: string }) {
  const { color, type, space, radius } = useTheme();
  const svg = useMemo(() => texToSvg(tex, true), [tex]);
  const ex = fontSize * EX_PER_FONT_PX;

  return (
    <View accessible accessibilityLabel={`Formula: ${tex}`} style={{ borderRadius: radius.sm, paddingVertical: space.xs, backgroundColor: svg ? undefined : color('accent/tint') }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: space.sm, flexGrow: 1, justifyContent: 'center' }}>
        {svg ? (
          <SvgXml xml={svg.xml} width={svg.widthEx * ex} height={svg.heightEx * ex} color={ink ?? color('text/primary')} />
        ) : (
          <Text style={[type['type/body-l'], { fontFamily: 'monospace', color: color('accent/default') }]}>{tex}</Text>
        )}
      </ScrollView>
    </View>
  );
}
