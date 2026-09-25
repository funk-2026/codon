import React, { useMemo, useState } from 'react';
import { StyleProp, Text, TextStyle, View, ViewStyle } from 'react-native';
import { useTheme } from '@/src/theme/ThemeProvider';
import type { BlockNode, InlineNode, MediaMap, MediaView, RichFormat } from './ast';
import { parse } from './parse';
import { MediaImage } from './MediaImage';
import { ImageLightbox } from './ImageLightbox';
import { MathBlock, MathInline } from './MathView';
import { toSubscript, toSuperscript } from './scripts';

export type RichVariant = 'stem' | 'option' | 'explanation' | 'caption';

export type RichContentProps = {
  value: string;
  /** `plain` (legacy rows — NEVER interpreted) or `rich_v1`. Missing = plain. */
  format?: RichFormat | string;
  media?: MediaMap;
  variant?: RichVariant;
  /** Override the text colour (e.g. option state colours). */
  color?: string;
  /** Cap image height inside this content (e.g. option images). */
  imageMaxHeight?: number;
  selectable?: boolean;
  /** Disable the built-in tap-to-zoom lightbox (e.g. inside a Pressable option). */
  disableLightbox?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

const VARIANT_TYPE: Record<RichVariant, 'type/body-l' | 'type/body-m' | 'type/caption'> = {
  stem: 'type/body-l',
  option: 'type/body-l',
  explanation: 'type/body-m',
  caption: 'type/caption',
};

/**
 * Renders any rich-text field — question stem, option, explanation, Brain Hack,
 * flashcard side, note — incl. images (FE-1.3). One component for the whole app.
 * Legacy `plain` content renders as a single text run, exactly as before.
 */
export function RichContent({
  value, format, media, variant = 'stem', color: colorOverride, imageMaxHeight, selectable, disableLightbox, style, testID,
}: RichContentProps) {
  const { color, type, space } = useTheme();
  const [zoom, setZoom] = useState<MediaView | null>(null);
  const blocks = useMemo(() => parse(value ?? '', format), [value, format]);

  const base: TextStyle = { ...type[VARIANT_TYPE[variant]], color: colorOverride ?? color('text/primary') };
  const onImage = disableLightbox ? undefined : (m: MediaView) => setZoom(m);
  const gap = variant === 'caption' ? space['2xs'] : space.xs;

  const renderInlineText = (nodes: InlineNode[], key: string) => (
    <Text key={key} style={base} selectable={selectable}>
      {nodes.map((n, i) => {
        switch (n.type) {
          case 'text':
            return (
              <Text key={i} style={[n.bold ? { fontFamily: type['type/h3'].fontFamily } : null, n.italic ? { fontStyle: 'italic' } : null]}>
                {n.text}
              </Text>
            );
          case 'sup': {
            const u = toSuperscript(n.text);
            return u ? <Text key={i}>{u}</Text> : <Text key={i} style={{ fontSize: (base.fontSize ?? 14) * 0.7 }}>{n.text}</Text>;
          }
          case 'sub': {
            const u = toSubscript(n.text);
            return u ? <Text key={i}>{u}</Text> : <Text key={i} style={{ fontSize: (base.fontSize ?? 14) * 0.7 }}>{n.text}</Text>;
          }
          case 'math':
            return <MathInline key={i} tex={n.tex} fontSize={base.fontSize} />;
          case 'break':
            return <Text key={i}>{'\n'}</Text>;
          default:
            return null;
        }
      })}
    </Text>
  );

  // Inline images can't live inside <Text> reliably, so a paragraph is split
  // into runs: text-like nodes stay together, images become block children.
  const renderParagraph = (children: InlineNode[], key: string) => {
    const out: React.ReactNode[] = [];
    let run: InlineNode[] = [];
    const flush = () => {
      if (run.length) {
        out.push(renderInlineText(run, `${key}-t${out.length}`));
        run = [];
      }
    };
    children.forEach((n) => {
      if (n.type === 'image') {
        flush();
        out.push(
          <MediaImage key={`${key}-i${out.length}`} media={media?.[n.media_id]} alt={n.alt} maxHeight={imageMaxHeight} onPress={onImage} />,
        );
      } else run.push(n);
    });
    flush();
    return <View key={key} style={{ gap }}>{out}</View>;
  };

  const renderBlock = (b: BlockNode, i: number) => {
    switch (b.type) {
      case 'paragraph':
        return renderParagraph(b.children, `p${i}`);
      case 'list':
        return (
          <View key={`l${i}`} style={{ gap: space['2xs'] }}>
            {b.items.map((it, j) => (
              <View key={j} style={{ flexDirection: 'row', gap: space.xs }}>
                <Text style={base}>{b.ordered ? `${j + 1}.` : '•'}</Text>
                <View style={{ flex: 1 }}>{renderParagraph(it, `l${i}-${j}`)}</View>
              </View>
            ))}
          </View>
        );
      case 'math_block':
        return <MathBlock key={`m${i}`} tex={b.tex} />;
      case 'image_block':
        return <MediaImage key={`b${i}`} media={media?.[b.media_id]} alt={b.alt} maxHeight={imageMaxHeight} onPress={onImage} />;
    }
  };

  if (blocks.length === 0) return null;
  return (
    <View testID={testID} style={[{ gap: variant === 'caption' ? space['2xs'] : space.sm }, style]}>
      {blocks.map(renderBlock)}
      {disableLightbox ? null : <ImageLightbox media={zoom} onClose={() => setZoom(null)} />}
    </View>
  );
}
