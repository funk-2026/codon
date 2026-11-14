import { useState } from 'react';
import { Share, Text, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { BottomSheet, PrimaryButton, SecondaryButton, TextButton } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { ApiError } from '@/src/api/client';
import { addCardsBulk } from '@/src/api/flashcardsTeacher';
import { CSV_TEMPLATE, parseCards, type ParsedCards } from '@/src/flashcards/csv';

/** Import many flash cards from a CSV file (front,back). Shows what will be added and what will be skipped first. */
export function ImportCardsSheet({ visible, deckId, onClose, onDone }: { visible: boolean; deckId: string; onClose: () => void; onDone: (added: number) => void }) {
  const { color, type, space } = useTheme();
  const [parsed, setParsed] = useState<ParsedCards | null>(null);
  const [fileName, setFileName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    setParsed(null);
    setError(null);
    onClose();
  };

  const pick = async () => {
    setError(null);
    const res = await DocumentPicker.getDocumentAsync({ type: ['text/csv', 'text/comma-separated-values', 'text/plain', 'application/vnd.ms-excel'], copyToCacheDirectory: true });
    if (res.canceled) return;
    const a = res.assets[0];
    try {
      const text = await (await fetch(a.uri)).text();
      setFileName(a.name);
      setParsed(parseCards(text));
    } catch {
      setError('Couldn’t read that file. Save it as CSV (UTF-8) and try again.');
    }
  };

  const run = async () => {
    if (!parsed || parsed.cards.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const r = await addCardsBulk(deckId, parsed.cards);
      setParsed(null);
      onDone(r.added);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Couldn’t import. Nothing was added. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <BottomSheet visible={visible} onClose={close} title="Import cards from CSV" dismissable={!busy}>
      <View style={{ paddingHorizontal: space.lg, paddingBottom: space.lg, gap: space.sm }}>
        {!parsed ? (
          <>
            <Text style={[type['type/body-m'], { color: color('text/secondary') }]}>
              One card per row: the front in the first column and the back in the second. Up to 500 cards. A header row (front,back) is optional.
            </Text>
            <PrimaryButton label="Choose a CSV file" onPress={() => void pick()} />
            <SecondaryButton label="Share a template" onPress={() => void Share.share({ message: CSV_TEMPLATE, title: 'flashcards-template.csv' })} />
          </>
        ) : (
          <>
            <Text style={[type['type/body-m-medium'], { color: color('text/primary') }]}>{fileName}</Text>
            <Text style={[type['type/body-m'], { color: color('semantic/success') }]}>{parsed.cards.length} card{parsed.cards.length === 1 ? '' : 's'} ready to add</Text>
            {parsed.problems.length > 0 ? (
              <View style={{ gap: 2 }}>
                <Text style={[type['type/body-m'], { color: color('semantic/warning') }]}>{parsed.problems.length} row{parsed.problems.length === 1 ? '' : 's'} will be skipped:</Text>
                {parsed.problems.slice(0, 5).map((p) => (
                  <Text key={p.row} style={[type['type/caption'], { color: color('text/secondary') }]}>Row {p.row}: {p.reason}</Text>
                ))}
                {parsed.problems.length > 5 ? <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>and {parsed.problems.length - 5} more</Text> : null}
              </View>
            ) : null}
            <PrimaryButton label={`Add ${parsed.cards.length} card${parsed.cards.length === 1 ? '' : 's'}`} onPress={() => void run()} loading={busy} disabled={parsed.cards.length === 0} />
            <TextButton label="Choose a different file" onPress={() => setParsed(null)} disabled={busy} />
          </>
        )}
        {error ? <Text style={[type['type/caption'], { color: color('semantic/danger') }]}>{error}</Text> : null}
      </View>
    </BottomSheet>
  );
}
