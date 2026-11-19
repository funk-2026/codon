import { useMemo, useState } from 'react';
import { ScrollView, Switch, Text, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ErrorBanner, InputField, PrimaryButton, Screen, ScreenHeader, SecondaryButton, SkeletonBlock, TextButton, useToast } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { adminGetHomeMessage, adminSetHomeMessage } from '@/src/api/adminOps';
import { useMediaUpload } from '@/src/media/useMediaUpload';
import { MediaImage } from '@/src/rich/MediaImage';
import { ApiError } from '@/src/api/client';
import type { HomeMessage } from '@/src/api/discover';
import type { MediaMap } from '@/src/rich/ast';

const MAX_WORDS = 60;
const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

/** The "A message from ..." card on every student's Home: a name, a short quote and a photo. */
export default function HomeMessageRoute() {
  const { space, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const q = useQuery({ queryKey: ['admin', 'home-message'], queryFn: adminGetHomeMessage });
  return (
    <Screen>
      <ScreenHeader title="Home message" />
      <ScrollView contentContainerStyle={{ padding: space.md, gap: space.md, paddingBottom: space['3xl'] + insets.bottom }} keyboardShouldPersistTaps="handled">
        {q.isPending ? (
          <SkeletonBlock height={260} radius={radius.lg} />
        ) : q.isError ? (
          <ErrorBanner onRetry={() => void q.refetch()} />
        ) : (
          <MessageForm saved={q.data.message} media={q.data.media} />
        )}
      </ScrollView>
    </Screen>
  );
}

function MessageForm({ saved, media }: { saved: HomeMessage | null; media: MediaMap }) {
  const { color, type, space } = useTheme();
  const { show } = useToast();
  const qc = useQueryClient();
  const [name, setName] = useState(saved?.name ?? '');
  const [quote, setQuote] = useState(saved?.quote ?? '');
  const [active, setActive] = useState(saved?.is_active ?? true);
  const [mediaId, setMediaId] = useState<string | undefined>(saved?.media_id);
  const [busy, setBusy] = useState(false);
  const photo = useMediaUpload('home_message_photo', { onReady: (it) => setMediaId(it.mediaId) });

  const n = words(quote);
  const valid = name.trim().length > 0 && n >= 1 && n <= MAX_WORDS;
  const savedView = mediaId ? media[mediaId] : undefined;
  const preview = useMemo(() => photo.items.find((i) => i.stage === 'ready')?.view ?? savedView, [photo.items, savedView]);
  const uploading = photo.items.some((i) => i.stage !== 'ready' && i.stage !== 'failed');

  const save = async () => {
    if (!valid || busy || uploading) return;
    setBusy(true);
    try {
      await adminSetHomeMessage({ name: name.trim(), quote: quote.trim(), is_active: active, ...(mediaId ? { media_id: mediaId } : {}) });
      await qc.invalidateQueries({ queryKey: ['admin', 'home-message'] });
      show('Saved. Students see it on Home.', 'success');
    } catch (e) {
      show(e instanceof ApiError ? e.message : 'Couldn’t save. Try again.', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Text style={[type['type/body-m'], { color: color('text/secondary') }]}>
        A short message with a photo, shown on every student’s Home. Keep it to a few lines.
      </Text>
      <InputField label="Name" value={name} onChangeText={setName} placeholder="Dr. Yogesh Desarda" maxLength={80} />
      <InputField
        label="Message"
        value={quote}
        onChangeText={setQuote}
        multiline
        placeholder="A few warm lines for students."
        helperText={`${n} of ${MAX_WORDS} words`}
        error={n > MAX_WORDS ? `Keep it to ${MAX_WORDS} words or fewer.` : undefined}
      />
      <View style={{ gap: space.xs }}>
        <Text style={[type['type/caption'], { color: color('text/secondary') }]}>Photo</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <View style={{ width: 72, height: 72, borderRadius: 36, overflow: 'hidden', backgroundColor: color('bg/sunken'), alignItems: 'center', justifyContent: 'center' }}>
            {preview ? <MediaImage media={preview} variant="thumb" maxHeight={72} /> : <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>No photo</Text>}
          </View>
          <View style={{ flex: 1, gap: space.xs }}>
            <SecondaryButton label={preview ? 'Change photo' : 'Choose photo'} onPress={() => void photo.pickFromLibrary(false)} disabled={uploading} />
            {mediaId ? <TextButton label="Remove photo" onPress={() => { setMediaId(undefined); photo.clear(); }} /> : null}
          </View>
        </View>
        {uploading ? <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>Uploading…</Text> : null}
        {photo.items.some((i) => i.stage === 'failed') ? <Text style={[type['type/caption'], { color: color('semantic/danger') }]}>The photo didn’t upload. Choose it again.</Text> : null}
        {photo.permissionDenied ? <Text style={[type['type/caption'], { color: color('semantic/danger') }]}>Allow photo access in Settings to choose a photo.</Text> : null}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 }}>
        <View style={{ flex: 1 }}>
          <Text style={[type['type/body-m'], { color: color('text/primary') }]}>Show on Home</Text>
          <Text style={[type['type/caption'], { color: color('text/secondary') }]}>Off hides the card from students</Text>
        </View>
        <Switch value={active} onValueChange={setActive} accessibilityLabel="Show on Home" />
      </View>
      <PrimaryButton label="Save" onPress={() => void save()} loading={busy} disabled={!valid || uploading} />
    </>
  );
}
