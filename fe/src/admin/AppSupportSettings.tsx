import { useEffect, useState } from 'react';
import { Switch, Text, View } from 'react-native';
import { InputField, PrimaryButton, SkeletonBlock, TextButton, useToast } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { shadow } from '@/src/theme/elevation';
import { getCustomTestSettings, patchCustomTestSettings, type AdminSetting } from '@/src/api/adminCustom';

const FIELDS: { key: string; label: string; help?: string; keyboard?: 'default' | 'email-address' | 'number-pad' }[] = [
  { key: 'app.min_version', label: 'Minimum app version', help: 'Older versions are asked to update, like 1.2.0. Leave blank for no gate.' },
  { key: 'app.store_url_android', label: 'Play Store link', help: 'Must start with https://' },
  { key: 'app.store_url_ios', label: 'App Store link', help: 'Must start with https://' },
  { key: 'legal.terms_url', label: 'Terms of Service link', help: 'Must start with https://. Hidden in the app until set.' },
  { key: 'legal.privacy_url', label: 'Privacy Policy link', help: 'Must start with https://. Stores require one.' },
  { key: 'legal.cancellation_url', label: 'Cancellation policy link', help: 'Must start with https://. Hidden in the app until set.' },
  { key: 'app.share_url', label: 'Invite friends link', help: 'The link shared when a student invites a friend. Must start with https://' },
  { key: 'support.contact_name', label: 'Contact name', help: 'Shown with the phone number under Help, like Dr. Yogesh Desarda.' },
  { key: 'support.phone', label: 'Contact phone', help: 'Shown under Help and opens the dialler, like +919987134790.' },
  { key: 'social.instagram_url', label: 'Instagram link', help: 'Must start with https://. Hidden until set.' },
  { key: 'social.youtube_url', label: 'YouTube link', help: 'Must start with https://. Hidden until set.' },
  { key: 'social.telegram_url', label: 'Telegram link', help: 'Must start with https://. Hidden until set.' },
  { key: 'social.whatsapp_channel_url', label: 'WhatsApp channel link', help: 'Must start with https://. Hidden until set.' },
  { key: 'social.facebook_url', label: 'Facebook link', help: 'Must start with https://. Hidden until set.' },
  { key: 'support.email', label: 'Support email', keyboard: 'email-address' },
  { key: 'support.whatsapp', label: 'Support WhatsApp number', help: 'Digits only, with the country code, like 919876543210.', keyboard: 'number-pad' },
  { key: 'results.percentile_min', label: 'Students needed before percentile shows', help: 'Exam results always show rank X of N. Percentile appears once this many students have a score.', keyboard: 'number-pad' },
  { key: 'exams.min_result_gap_minutes', label: 'Minutes before live-exam results open', help: 'The least time between a live exam ending and its results opening, so the key can be checked.', keyboard: 'number-pad' },
  { key: 'resets.cooldown_days', label: 'Days between self-resets', help: 'How long a student waits before clearing the same kind of study data again.', keyboard: 'number-pad' },
];

/** The app's public links, version gate and analytics switch. Blank means "not set". */
export function AppSupportSettings() {
  const { color, type, space, radius } = useTheme();
  const { show } = useToast();
  const [loaded, setLoaded] = useState<AdminSetting[] | null>(null);
  const [error, setError] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const load = () => {
    setError(false);
    getCustomTestSettings()
      .then((r) => {
        setLoaded(r.settings);
        setValues(Object.fromEntries(r.settings.map((s) => [s.key, s.value])));
      })
      .catch(() => setError(true));
  };
  useEffect(load, []);

  const original = (k: string) => loaded?.find((s) => s.key === k)?.value ?? '';
  const keys = [...FIELDS.map((f) => f.key), 'analytics.events'];
  const changed = keys.filter((k) => (values[k] ?? '') !== original(k));

  const save = async () => {
    setBusy(true);
    try {
      await patchCustomTestSettings(Object.fromEntries(changed.map((k) => [k, (values[k] ?? '').trim()])));
      show('Saved', 'success');
      load();
    } catch (e) {
      show(e instanceof Error && e.message ? e.message : 'Couldn’t save. Check the values.', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ marginTop: space.xl }}>
      <Text style={[type['type/overline'], { color: color('text/tertiary'), marginBottom: space.sm }]}>APP, LINKS AND SUPPORT</Text>
      <View style={[{ backgroundColor: color('bg/surface'), borderRadius: radius.md, padding: space.md, gap: space.md }, shadow()]}>
        {error ? (
          <TextButton label="Couldn’t load these settings. Retry" onPress={load} />
        ) : !loaded ? (
          <SkeletonBlock height={160} radius={radius.md} />
        ) : (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                <Text style={[type['type/body-l'], { color: color('text/primary') }]}>Collect app usage events</Text>
                <Text style={[type['type/caption'], { color: color('text/tertiary'), marginTop: 2 }]}>
                  Screen views, sign-ins, test starts and purchases, for product analytics. The app build must also have analytics switched on.
                </Text>
              </View>
              <Switch
                value={values['analytics.events'] === 'true'}
                onValueChange={(v) => setValues((m) => ({ ...m, 'analytics.events': v ? 'true' : 'false' }))}
                trackColor={{ false: color('border/strong'), true: color('accent/default') }}
                thumbColor={color('bg/surface')}
              />
            </View>
            {FIELDS.map((f) => (
              <InputField
                key={f.key}
                label={f.label}
                helperText={f.help}
                value={values[f.key] ?? ''}
                onChangeText={(v) => setValues((m) => ({ ...m, [f.key]: v }))}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType={f.keyboard}
              />
            ))}
            <PrimaryButton label={changed.length ? `Save ${changed.length} change${changed.length === 1 ? '' : 's'}` : 'Saved'} onPress={save} loading={busy} disabled={changed.length === 0} />
          </>
        )}
      </View>
    </View>
  );
}
