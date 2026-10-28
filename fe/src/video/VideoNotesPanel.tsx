import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { NotePencil, Trash } from 'phosphor-react-native';
import { BottomSheet, InputField, PrimaryButton, SecondaryButton, TextButton, useToast } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { RichContent } from '@/src/rich';
import { ApiError } from '@/src/api/client';
import { createVideoNote, deleteVideoNote, listVideoNotes, updateVideoNote, type VideoNote } from '@/src/api/discover';
import { formatClock } from '@/src/attempt/logic';

const MAX = 4000;
type Draft = { id?: string; at: number; body: string };

/**
 * Timestamped personal notes on a video (FE-6.6). "Add note" captures the
 * current position (and pauses); tapping a note's time seeks there. Bodies
 * are rich text v1 without images (the server rejects images in notes).
 */
export function VideoNotesPanel({
  contentId, currentTime, onSeek, onPause,
}: { contentId: string; currentTime: number; onSeek: (seconds: number) => void; onPause: () => void }) {
  const { color, type, space, radius } = useTheme();
  const { show } = useToast();
  const [notes, setNotes] = useState<VideoNote[] | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<VideoNote | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    listVideoNotes(contentId).then((r) => setNotes(r.notes)).catch(() => setNotes([]));
  }, [contentId]);
  useEffect(() => {
    load();
  }, [load]);

  const add = () => {
    onPause();
    setDraft({ at: Math.floor(currentTime), body: '' });
  };

  const save = async () => {
    if (!draft || !draft.body.trim()) return;
    setBusy(true);
    try {
      if (draft.id) {
        const n = await updateVideoNote(draft.id, draft.body.trim());
        setNotes((p) => p?.map((x) => (x.id === n.id ? n : x)) ?? p);
      } else {
        const n = await createVideoNote({ content_id: contentId, timestamp_seconds: draft.at, body: draft.body.trim() });
        setNotes((p) => [...(p ?? []), n].sort((a, b) => a.timestamp_seconds - b.timestamp_seconds));
      }
      setDraft(null);
    } catch (e) {
      const code = e instanceof ApiError ? e.code : undefined;
      show(
        code === 'images_not_supported' ? 'Images aren’t supported in notes yet.'
        : code === 'too_many_notes' ? 'You’ve reached the note limit for this video.'
        : 'Couldn’t save your note. Your text is still here — try again.',
        'error',
      );
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    const n = confirmDelete;
    if (!n) return;
    setBusy(true);
    try {
      await deleteVideoNote(n.id);
      setNotes((p) => p?.filter((x) => x.id !== n.id) ?? p);
      setConfirmDelete(null);
    } catch {
      show('Couldn’t delete the note.', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ marginTop: space.lg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: space.sm }}>
        <Text accessibilityRole="header" style={[type['type/overline'], { color: color('text/tertiary'), flex: 1 }]}>MY NOTES</Text>
        <TextButton label={`+ Note at ${formatClock(Math.floor(currentTime))}`} onPress={add} />
      </View>

      {notes == null ? null : notes.length === 0 ? (
        <Text style={[type['type/body-m'], { color: color('text/secondary') }]}>
          Pause on anything worth remembering and add a note — it’s saved with the moment in the video.
        </Text>
      ) : (
        <View style={{ gap: space.xs }}>
          {notes.map((n) => (
            <View key={n.id} style={{ backgroundColor: color('bg/surface'), borderRadius: radius.md, padding: space.sm, flexDirection: 'row', gap: space.sm }}>
              <Pressable
                onPress={() => onSeek(n.timestamp_seconds)}
                accessibilityRole="button"
                accessibilityLabel={`Jump to ${formatClock(n.timestamp_seconds)}`}
                style={{ minHeight: 44, minWidth: 56, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm, backgroundColor: color('accent/tint') }}
              >
                <Text style={[type['type/caption'], { color: color('accent/default') }]}>{formatClock(n.timestamp_seconds)}</Text>
              </Pressable>
              <View style={{ flex: 1, justifyContent: 'center' }}>
                <RichContent value={n.body} format="rich_v1" variant="option" />
              </View>
              <View style={{ justifyContent: 'center' }}>
                <Pressable onPress={() => setDraft({ id: n.id, at: n.timestamp_seconds, body: n.body })} accessibilityRole="button" accessibilityLabel="Edit note" hitSlop={6} style={{ minWidth: 36, minHeight: 36, alignItems: 'center', justifyContent: 'center' }}>
                  <NotePencil size={18} color={color('text/secondary')} />
                </Pressable>
                <Pressable onPress={() => setConfirmDelete(n)} accessibilityRole="button" accessibilityLabel="Delete note" hitSlop={6} style={{ minWidth: 36, minHeight: 36, alignItems: 'center', justifyContent: 'center' }}>
                  <Trash size={18} color={color('semantic/danger')} />
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      )}

      <BottomSheet visible={!!draft} onClose={() => setDraft(null)} title={draft ? `${draft.id ? 'Edit note' : 'Note'} at ${formatClock(draft.at)}` : ''} dismissable={!busy}>
        {draft ? (
          <View style={{ gap: space.md }}>
            <InputField
              label="Note"
              value={draft.body}
              onChangeText={(v) => setDraft((d) => (d ? { ...d, body: v } : d))}
              multiline
              maxLength={MAX}
              autoFocus
              placeholder="What do you want to remember?"
            />
            <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>**bold**, H~2~O, x^2^ and “- ” lists work here.</Text>
            <PrimaryButton label="Save note" onPress={save} loading={busy} disabled={!draft.body.trim()} />
          </View>
        ) : null}
      </BottomSheet>

      <BottomSheet visible={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Delete this note?" dismissable={!busy}>
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <SecondaryButton label="Cancel" onPress={() => setConfirmDelete(null)} style={{ flex: 1 }} />
          <PrimaryButton label="Delete" onPress={remove} loading={busy} style={{ flex: 1 }} />
        </View>
      </BottomSheet>
    </View>
  );
}
