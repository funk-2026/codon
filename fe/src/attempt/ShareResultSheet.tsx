import React, { useEffect, useRef, useState } from 'react';
import { Share, Text, View, type ViewInstance } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { Flame } from 'phosphor-react-native';
import { BottomSheet, PrimaryButton, useToast } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { getProgressBreakdown } from '@/src/api/profile';
import { track } from '@/src/analytics/track';

export type ShareResultData = {
  firstName: string;
  testTitle: string;
  /** 0–100, or null when the test has no marks. */
  percent: number | null;
  score: string;
  correct: number;
  attempted: number;
};

/**
 * "Share result" (CM-R8): a branded image card — first name only, score,
 * accuracy, day streak — captured and handed to the native share sheet.
 * Falls back to sharing plain text when capturing an image isn't possible.
 */
export function ShareResultSheet({ visible, onClose, data }: { visible: boolean; onClose: () => void; data: ShareResultData }) {
  const { color, type, space, radius } = useTheme();
  const { show } = useToast();
  const card = useRef<ViewInstance>(null);
  const [streak, setStreak] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!visible) return;
    getProgressBreakdown().then((r) => setStreak(r.day_streak)).catch(() => setStreak(null));
  }, [visible]);

  const accuracy = data.attempted > 0 ? Math.round((data.correct / data.attempted) * 100) : null;
  const text = `${data.firstName} scored ${data.score}${data.percent != null ? ` (${data.percent}%)` : ''} on “${data.testTitle}” on Codon${accuracy != null ? ` — ${accuracy}% accuracy` : ''}${streak ? `, ${streak}-day streak` : ''}.`;

  const share = async () => {
    setBusy(true);
    try {
      let shared = false;
      try {
        const uri = await captureRef(card, { format: 'png', quality: 1, result: 'tmpfile' });
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Share your result' });
          shared = true;
        }
      } catch {
        /* capture unavailable — fall back to text below */
      }
      if (!shared) await Share.share({ message: text });
      track('result.shared', { image: shared });
      onClose();
    } catch {
      show('Couldn’t open sharing. Try again.', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Share your result" dismissable={!busy}>
      <View style={{ gap: space.md }}>
        {/* The captured card: fixed light palette so the image looks the same in any theme. */}
        <View
          ref={card}
          collapsable={false}
          accessible
          accessibilityLabel={text}
          style={{ backgroundColor: '#4B3FE4', borderRadius: radius.lg, padding: space.lg, gap: space.xs }}
        >
          <Text style={[type['type/overline'], { color: 'rgba(255,255,255,0.75)' }]}>CODON · RESULT</Text>
          <Text style={[type['type/h2'], { color: '#FFFFFF' }]} numberOfLines={2}>{data.testTitle}</Text>
          <Text style={[type['type/numeral-display'], { color: '#FFFFFF', fontSize: 44, marginTop: space.xs }]}>
            {data.percent != null ? `${data.percent}%` : data.score}
          </Text>
          <Text style={[type['type/body-m'], { color: 'rgba(255,255,255,0.9)' }]}>
            {data.percent != null ? `Score ${data.score}` : ''}{accuracy != null ? `${data.percent != null ? ' · ' : ''}${accuracy}% accuracy` : ''}
          </Text>
          {streak ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: space.xs }}>
              <Flame size={18} color="#FFD27A" weight="fill" />
              <Text style={[type['type/body-m-medium'], { color: '#FFFFFF' }]}>{streak}-day streak</Text>
            </View>
          ) : null}
          <Text style={[type['type/caption'], { color: 'rgba(255,255,255,0.75)', marginTop: space.sm }]}>— {data.firstName}</Text>
        </View>
        <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>Only your first name is shared — never your phone number or answers.</Text>
        <PrimaryButton label="Share" onPress={share} loading={busy} />
      </View>
    </BottomSheet>
  );
}
