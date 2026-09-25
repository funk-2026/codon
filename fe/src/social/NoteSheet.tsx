import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { BottomSheet, InputField, PrimaryButton, TextButton, useToast } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { deleteQuestionNote, NOTE_MAX, putQuestionNote } from '@/src/api/notes';
import { track } from '@/src/analytics/track';

/** Private per-question note (FE-5.x). Saving an empty note deletes it. */
export function NoteSheet({
  visible, onClose, questionId, initial, onSaved,
}: { visible: boolean; onClose: () => void; questionId: string; initial?: string; onSaved: (body: string | null) => void }) {
  const { color, type, space } = useTheme();
  const { show } = useToast();
  const [text, setText] = useState(initial ?? '');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (visible) setText(initial ?? '');
  }, [visible, initial, questionId]);

  const save = async () => {
    setBusy(true);
    try {
      const body = text.trim();
      if (!body) {
        if (initial) await deleteQuestionNote(questionId);
        onSaved(null);
      } else {
        await putQuestionNote(questionId, body);
        track('notes.saved', { length: body.length });
        onSaved(body);
      }
      onClose();
    } catch {
      show("Couldn't save your note. Try again.", 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title="My note" dismissable={!busy}>
      <View style={{ gap: space.sm }}>
        <InputField
          label="Only you can see this"
          value={text}
          onChangeText={(t: string) => setText(t.slice(0, NOTE_MAX))}
          multiline
          placeholder="A mnemonic, a reminder, why you got it wrong…"
        />
        <Text style={[type['type/caption'], { color: color('text/tertiary'), textAlign: 'right' }]}>{text.length}/{NOTE_MAX}</Text>
        <PrimaryButton label="Save note" onPress={save} loading={busy} />
        {initial ? <TextButton label="Delete note" onPress={() => { setText(''); }} /> : null}
      </View>
    </BottomSheet>
  );
}
