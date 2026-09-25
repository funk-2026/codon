import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, Text, TextInput, View, type NativeSyntheticEvent, type TextInputSelectionChangeEventData } from 'react-native';
import { Eye, EyeSlash, Image as ImageIcon, ListBullets, TextB, TextItalic, TextSubscript, TextSuperscript, Function as FunctionIcon, WarningCircle, X, Camera } from 'phosphor-react-native';
import { useTheme } from '@/src/theme/ThemeProvider';
import { BottomSheet, InputField, PrimaryButton, SecondaryButton, TextButton, useToast } from '@/src/components';
import type { MediaMap, MediaView } from './ast';
import { mediaRefs } from './parse';
import { RichContent } from './RichContent';
import { MediaImage } from './MediaImage';
import { imageAlt, insertAt, insertImage, removeImage, setImageAlt, toggleList, wrapSelection, type Selection } from './edit';
import { useMediaUpload } from '@/src/media/useMediaUpload';
import type { MediaPurpose } from '@/src/api/media';
import { updateMediaAlt } from '@/src/api/media';

export type RichFieldProps = {
  label: string;
  value: string;
  onChange: (v: string) => void;
  /** Resolved media for images already referenced in `value` (from the server) plus fresh uploads. */
  media: MediaMap;
  onMedia: (view: MediaView) => void;
  purpose: MediaPurpose;
  maxChars: number;
  required?: boolean;
  placeholder?: string;
  minLines?: number;
  error?: string | null;
  /** Images allowed in this field (options are usually text or one small image). */
  maxImages?: number;
  compact?: boolean;
  testID?: string;
};

/**
 * The teacher's rich-text field: a plain TextInput holding the markup (the
 * source of truth — teachers can always see and fix exactly what is stored),
 * plus a toolbar, live preview, character budget and image management.
 */
export function RichField({
  label, value, onChange, media, onMedia, purpose, maxChars, required, placeholder, minLines = 3, error, maxImages = 4, compact, testID,
}: RichFieldProps) {
  const { color, type, space, radius } = useTheme();
  const { show } = useToast();
  const sel = useRef<Selection>({ start: value.length, end: value.length });
  const [pending, setPending] = useState<Selection | undefined>(undefined);
  const [preview, setPreview] = useState(false);
  const [imageSheet, setImageSheet] = useState(false);
  const [editAlt, setEditAlt] = useState<string | null>(null);
  const [altText, setAltText] = useState('');
  const valueRef = useRef(value);
  valueRef.current = value;

  const refs = useMemo(() => mediaRefs(value, 'rich_v1'), [value]);
  const over = value.length > maxChars;

  // Insert into the CURRENT text when an upload finishes (the teacher may have kept typing meanwhile).
  const uploader = useMediaUpload(purpose, {
    onReady: (item) => {
      if (!item.view || !item.mediaId) return;
      onMedia(item.view);
      const r = insertImage(valueRef.current, sel.current, item.mediaId, '');
      onChange(r.text);
      sel.current = r.selection;
      setPending(r.selection);
      // an image without alt text is an accessibility gap — prompt right away
      setEditAlt(item.mediaId);
      setAltText('');
    },
  });

  useEffect(() => {
    if (pending) setPending(undefined); // controlled selection is applied once, then released
  }, [pending]);

  const apply = (r: { text: string; selection: Selection }) => {
    onChange(r.text);
    sel.current = r.selection;
    setPending(r.selection);
  };

  const onSel = (e: NativeSyntheticEvent<TextInputSelectionChangeEventData>) => {
    sel.current = e.nativeEvent.selection;
  };

  const tools: { key: string; a11y: string; icon: React.ReactNode; run: () => void }[] = [
    { key: 'b', a11y: 'Bold', icon: <TextB size={20} color={color('text/primary')} />, run: () => apply(wrapSelection(value, sel.current, '**')) },
    { key: 'i', a11y: 'Italic', icon: <TextItalic size={20} color={color('text/primary')} />, run: () => apply(wrapSelection(value, sel.current, '*')) },
    { key: 'sub', a11y: 'Subscript', icon: <TextSubscript size={20} color={color('text/primary')} />, run: () => apply(wrapSelection(value, sel.current, '~')) },
    { key: 'sup', a11y: 'Superscript', icon: <TextSuperscript size={20} color={color('text/primary')} />, run: () => apply(wrapSelection(value, sel.current, '^')) },
    { key: 'math', a11y: 'Formula', icon: <FunctionIcon size={20} color={color('text/primary')} />, run: () => apply(wrapSelection(value, sel.current, '$')) },
    { key: 'list', a11y: 'Bulleted list', icon: <ListBullets size={20} color={color('text/primary')} />, run: () => apply(toggleList(value, sel.current)) },
    {
      key: 'img', a11y: 'Add image', icon: <ImageIcon size={20} color={color('text/primary')} />,
      run: () => (refs.length >= maxImages ? show(`At most ${maxImages} images here.`, 'error') : setImageSheet(true)),
    },
  ];

  const busyItems = uploader.items.filter((i) => i.stage !== 'ready');

  return (
    <View style={{ gap: space.xs }} testID={testID}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Text style={[type['type/body-m-medium'], { color: color('text/primary'), flex: 1 }]}>
          {label}{required ? <Text style={{ color: color('semantic/danger') }}> *</Text> : null}
        </Text>
        <Pressable onPress={() => setPreview((p) => !p)} accessibilityRole="button" accessibilityState={{ selected: preview }} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 36, paddingHorizontal: space.xs }}>
          {preview ? <EyeSlash size={18} color={color('accent/default')} /> : <Eye size={18} color={color('text/secondary')} />}
          <Text style={[type['type/caption'], { color: preview ? color('accent/default') : color('text/secondary') }]}>{preview ? 'Editing' : 'Preview'}</Text>
        </Pressable>
      </View>

      {!compact ? (
        <View style={{ flexDirection: 'row', gap: 2 }}>
          {tools.map((t) => (
            <Pressable
              key={t.key}
              onPress={t.run}
              accessibilityRole="button"
              accessibilityLabel={t.a11y}
              style={({ pressed }) => ({ width: 40, height: 40, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? color('bg/sunken') : 'transparent' })}
            >
              {t.icon}
            </Pressable>
          ))}
        </View>
      ) : (
        <Pressable onPress={() => setImageSheet(true)} accessibilityRole="button" accessibilityLabel="Add image" style={{ alignSelf: 'flex-start', minHeight: 32 }}>
          <Text style={[type['type/caption'], { color: color('accent/default') }]}>+ image</Text>
        </Pressable>
      )}

      {preview ? (
        <View style={{ minHeight: 48, padding: space.md, borderRadius: radius.md, backgroundColor: color('bg/sunken') }}>
          {value.trim() ? <RichContent value={value} format="rich_v1" media={media} variant="stem" /> : <Text style={[type['type/body-m'], { color: color('text/tertiary') }]}>Nothing to preview yet.</Text>}
        </View>
      ) : (
        <TextInput
          value={value}
          onChangeText={onChange}
          onSelectionChange={onSel}
          selection={pending}
          multiline
          placeholder={placeholder}
          placeholderTextColor={color('text/tertiary')}
          accessibilityLabel={label}
          textAlignVertical="top"
          style={[
            type['type/body-l'],
            {
              color: color('text/primary'), backgroundColor: color('bg/surface'), borderRadius: radius.md, padding: space.md,
              minHeight: minLines * 24 + space.md * 2, borderWidth: 1.5, borderColor: error || over ? color('semantic/danger') : color('border/subtle'),
            },
          ]}
        />
      )}

      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={[type['type/caption'], { color: error ? color('semantic/danger') : color('text/tertiary'), flex: 1 }]} accessibilityLiveRegion="polite">{error ?? ' '}</Text>
        <Text style={[type['type/caption'], { color: over ? color('semantic/danger') : color('text/tertiary') }]}>{value.length}/{maxChars}</Text>
      </View>

      {/* Images used in this field */}
      {(refs.length > 0 || busyItems.length > 0) ? (
        <View style={{ gap: space.xs }}>
          {refs.map((id) => {
            const m = media[id];
            const alt = imageAlt(value, id);
            return (
              <View key={id} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: color('bg/sunken'), borderRadius: radius.md, padding: space.xs }}>
                <View style={{ width: 56 }}>
                  <MediaImage media={m} variant="thumb" alt={alt} disableFallbackHeight />
                </View>
                <Pressable style={{ flex: 1, minHeight: 44, justifyContent: 'center' }} onPress={() => { setEditAlt(id); setAltText(alt); }} accessibilityRole="button" accessibilityLabel={alt ? `Edit description: ${alt}` : 'Add a description for this image'}>
                  {alt ? (
                    <Text style={[type['type/caption'], { color: color('text/secondary') }]} numberOfLines={2}>{alt}</Text>
                  ) : (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <WarningCircle size={16} color={color('semantic/warning')} weight="fill" />
                      <Text style={[type['type/caption'], { color: color('semantic/warning') }]}>Add a description (for screen readers)</Text>
                    </View>
                  )}
                </Pressable>
                <Pressable onPress={() => onChange(removeImage(value, id))} hitSlop={8} accessibilityRole="button" accessibilityLabel="Remove image" style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
                  <X size={18} color={color('text/secondary')} />
                </Pressable>
              </View>
            );
          })}
          {busyItems.map((it) => (
            <View key={it.key} style={{ backgroundColor: color('bg/sunken'), borderRadius: radius.md, padding: space.sm, gap: 6 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={[type['type/caption'], { color: it.stage === 'failed' ? color('semantic/danger') : color('text/secondary'), flex: 1 }]}>
                  {it.stage === 'failed' ? it.error?.message : it.stage === 'preparing' ? 'Preparing image…' : it.stage === 'uploading' ? `Uploading ${Math.round(it.progress * 100)}%` : 'Processing…'}
                </Text>
                {it.stage === 'failed' && it.error?.retryable ? <TextButton label="Retry" onPress={() => uploader.retry(it.key)} /> : null}
                <TextButton label={it.stage === 'failed' ? 'Dismiss' : 'Cancel'} onPress={() => uploader.cancel(it.key)} />
              </View>
              {it.stage !== 'failed' ? (
                <View style={{ height: 4, borderRadius: 2, backgroundColor: color('border/subtle') }}>
                  <View style={{ width: `${Math.round((it.stage === 'processing' ? 1 : it.progress) * 100)}%`, height: 4, borderRadius: 2, backgroundColor: color('accent/default') }} />
                </View>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}

      <BottomSheet visible={imageSheet} onClose={() => setImageSheet(false)} title="Add an image">
        <View style={{ gap: space.sm }}>
          <PrimaryButton label="Choose from photos" onPress={() => { setImageSheet(false); void uploader.pickFromLibrary(false); }} />
          <SecondaryButton label="Take a photo" onPress={() => { setImageSheet(false); void uploader.takePhoto(); }} />
          {uploader.permissionDenied ? (
            <View style={{ gap: 4 }}>
              <Text style={[type['type/body-m'], { color: color('semantic/danger') }]}>
                Codon doesn’t have access to your {uploader.permissionDenied === 'camera' ? 'camera' : 'photos'}.
              </Text>
              <TextButton label="Open settings" onPress={uploader.openSettings} />
            </View>
          ) : null}
          <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>
            JPEG, PNG or WebP · up to {(uploader.limits.max_bytes / 1_000_000).toFixed(0)} MB. Large photos are shrunk automatically.
          </Text>
        </View>
      </BottomSheet>

      <BottomSheet visible={editAlt != null} onClose={() => setEditAlt(null)} title="Describe this image">
        <View style={{ gap: space.md }}>
          <Text style={[type['type/body-m'], { color: color('text/secondary') }]}>
            Say what the image shows, so students using a screen reader can answer too. e.g. “Bar chart: enzyme activity rises then falls with temperature”.
          </Text>
          <InputField label="Description" value={altText} onChangeText={setAltText} multiline />
          <PrimaryButton
            label="Save"
            onPress={() => {
              if (editAlt) {
                onChange(setImageAlt(valueRef.current, editAlt, altText));
                void updateMediaAlt(editAlt, altText.trim()).catch(() => {});
              }
              setEditAlt(null);
            }}
          />
          <TextButton label="Skip for now" onPress={() => setEditAlt(null)} />
        </View>
      </BottomSheet>
    </View>
  );
}
