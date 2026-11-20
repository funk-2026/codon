import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Camera, CaretRight, ChatCircleText, ChartLineUp, FilePdf, Gear, Info, PencilSimple, Receipt, Shield, UsersThree, ShareNetwork } from 'phosphor-react-native';
import type { Icon } from 'phosphor-react-native';
import { ErrorBanner, SkeletonBlock, Screen, ScreenHeader, useToast } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { useAuth } from '@/src/auth/AuthContext';
import { useMe } from '@/src/queries/profile';
import { keys } from '@/src/queries/keys';
import { useRefetchOnFocus } from '@/src/queries/useRefetchOnFocus';
import { useMediaUpload } from '@/src/media/useMediaUpload';
import { MediaImage } from '@/src/rich/MediaImage';
import { updateMe, type Subscription } from '@/src/api/profile';
import { ROUTES } from '@/src/navigation/routes';
import { shadow } from '@/src/theme/elevation';

type KycState = 'not_started' | 'pending' | 'verified' | 'action_needed' | null;
const KYC: Record<Exclude<KycState, null>, { label: string; token: 'text/tertiary' | 'semantic/warning' | 'semantic/success' | 'semantic/danger' }> = {
  not_started: { label: 'Not started', token: 'text/tertiary' },
  pending: { label: 'Pending', token: 'semantic/warning' },
  verified: { label: 'Verified', token: 'semantic/success' },
  action_needed: { label: 'Action needed', token: 'semantic/danger' },
};

const ROWS: { label: string; text: string; Icon: Icon; href: string }[] = [
  { label: 'Edit Profile', text: 'Name, exam date, state', Icon: PencilSimple, href: ROUTES.student.editProfile },
  { label: 'My progress', text: 'QBank, tests, videos, Schema', Icon: ChartLineUp, href: ROUTES.student.myProgress },
  { label: 'My plan and payments', text: 'Your plan and receipts', Icon: Receipt, href: ROUTES.student.payments },
  { label: 'Settings', text: 'Theme, reminders, account', Icon: Gear, href: ROUTES.student.settings },
  { label: 'How to use this app', text: 'A short guide to each feature', Icon: FilePdf, href: ROUTES.student.howToUse },
  { label: 'Our team and faculty', text: 'The people behind Codon', Icon: UsersThree, href: ROUTES.student.team },
  { label: 'Give feedback', text: 'Report a problem or send an idea', Icon: ChatCircleText, href: ROUTES.student.giveFeedback },
  { label: 'Help and information', text: 'FAQ, contact, policies, legal', Icon: Info, href: ROUTES.student.help },
  { label: 'Community and sharing', text: 'Follow us and invite friends', Icon: ShareNetwork, href: ROUTES.student.community },
];

/** The student's own page. Opens from the avatar on Home. Tapping the photo changes the photo only. */
export default function ProfileHomeRoute() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const { show } = useToast();
  const qc = useQueryClient();
  const me = useMe();
  useRefetchOnFocus(() => void me.refetch());

  const photo = useMediaUpload('profile_photo', {
    onReady: (it) => {
      if (!it.mediaId) return;
      updateMe({ photo_media_id: it.mediaId })
        .then(() => qc.invalidateQueries({ queryKey: keys.me }))
        .catch(() => show('Couldn’t save your photo.', 'error'));
    },
  });
  const uploading = photo.items.some((i) => i.stage !== 'ready' && i.stage !== 'failed');

  const sub: Subscription | null = me.data?.active_subscription ?? null;
  const kycState = (user?.kyc_status as KycState) || 'not_started';
  const name = user?.name || 'Student';
  const initials = (name.trim().split(/\s+/).map((w) => w[0]).join('').slice(0, 2) || 'S').toUpperCase();
  const photoId = me.data?.user?.photo_media_id ?? undefined;
  const view = (photo.items.find((i) => i.stage === 'ready')?.view) ?? (photoId ? me.data?.media?.[photoId] : undefined);

  return (
    <Screen>
      <ScreenHeader title="Profile" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: space.md, paddingBottom: space['3xl'] }} showsVerticalScrollIndicator={false}>
        <View style={{ alignItems: 'center', marginTop: space.xl }}>
          <Pressable
            onPress={() => void photo.pickFromLibrary(false)}
            disabled={uploading}
            accessibilityRole="button"
            accessibilityLabel="Change profile photo"
            style={{ width: 96, height: 96, borderRadius: 48 }}
          >
            <View style={{ width: 96, height: 96, borderRadius: 48, overflow: 'hidden', backgroundColor: color('accent/tint'), alignItems: 'center', justifyContent: 'center' }}>
              {view ? <MediaImage media={view} variant="thumb" maxHeight={96} /> : <Text style={[type['type/display'], { color: color('accent/default'), fontSize: 32 }]}>{initials}</Text>}
            </View>
            <View style={{ position: 'absolute', right: 0, bottom: 0, width: 32, height: 32, borderRadius: 16, backgroundColor: color('action/primary'), borderWidth: 2, borderColor: color('bg/canvas'), alignItems: 'center', justifyContent: 'center' }}>
              <Camera size={16} color={color('action/on-primary')} weight="fill" />
            </View>
          </Pressable>
          {uploading ? <Text style={[type['type/caption'], { color: color('text/tertiary'), marginTop: space.xs }]}>Uploading…</Text> : null}
          {photo.items.some((i) => i.stage === 'failed') ? <Text style={[type['type/caption'], { color: color('semantic/danger'), marginTop: space.xs }]}>The photo didn’t upload. Try again.</Text> : null}
          {photo.permissionDenied ? <Text style={[type['type/caption'], { color: color('semantic/danger'), marginTop: space.xs }]}>Allow photo access in Settings to change your photo.</Text> : null}
          <Text style={[type['type/h2'], { color: color('text/primary'), marginTop: space.sm }]} numberOfLines={1}>{name}</Text>
          <View style={{ backgroundColor: color('bg/sunken'), borderRadius: radius.pill, paddingHorizontal: space.sm, paddingVertical: 2, marginTop: space['2xs'] }}>
            <Text style={[type['type/caption'], { color: color('text/secondary') }]}>{user?.selected_course_id ? 'Enrolled' : 'No course yet'}</Text>
          </View>
        </View>

        {me.isError ? <View style={{ marginTop: space.md }}><ErrorBanner onRetry={() => void me.refetch()} /></View> : null}

        <View style={{ marginTop: space.lg }}>
          {me.isPending ? (
            <SkeletonBlock height={72} radius={radius.lg} />
          ) : sub ? (
            // A paid plan shows what it is and when it ends. There is nothing to buy or renew from here.
            <View style={[{ backgroundColor: color('bg/surface'), borderRadius: radius.lg, padding: space.md }, shadow()]}>
              <Text style={[type['type/overline'], { color: color('text/tertiary') }]}>ACTIVE PLAN</Text>
              <Text style={[type['type/h3'], { color: color('text/primary'), marginTop: 2 }]}>{sub.plan?.name || 'Subscription'}</Text>
              <Text style={[type['type/caption'], { color: color('text/secondary') }]}>Active until {new Date(sub.end_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</Text>
            </View>
          ) : (
            <Pressable onPress={() => router.push(ROUTES.student.subscriptionPlans)} accessibilityRole="button" style={({ pressed }) => [{ backgroundColor: color('bg/surface'), borderRadius: radius.lg, padding: space.md, opacity: pressed ? 0.94 : 1 }, shadow()]}>
              <Text style={[type['type/overline'], { color: color('text/tertiary') }]}>PLAN</Text>
              <Text style={[type['type/h3'], { color: color('text/primary'), marginTop: 2 }]}>You’re on free access</Text>
              <Text style={[type['type/body-m-medium'], { color: color('accent/default'), marginTop: space['2xs'] }]}>View plans</Text>
            </Pressable>
          )}
        </View>

        {me.data?.kyc_required ? (
          <Pressable
            onPress={() => router.push(kycState !== 'not_started' ? ROUTES.student.kycStatus : ROUTES.student.kycSubmission)}
            accessibilityRole="button"
            style={({ pressed }) => [{ marginTop: space.md, flexDirection: 'row', alignItems: 'center', backgroundColor: color('bg/surface'), borderRadius: radius.md, padding: space.md, opacity: pressed ? 0.94 : 1 }, shadow()]}
          >
            <Shield size={20} color={color('text/secondary')} />
            <Text style={[type['type/body-l'], { color: color('text/primary'), flex: 1, marginLeft: space.sm }]}>Identity verification</Text>
            <Text style={[type['type/caption'], { color: color(KYC[kycState ?? 'not_started'].token), marginRight: space.xs }]}>{KYC[kycState ?? 'not_started'].label}</Text>
            <CaretRight size={18} color={color('text/tertiary')} />
          </Pressable>
        ) : null}

        <View style={[{ marginTop: space.lg, backgroundColor: color('bg/surface'), borderRadius: radius.lg, overflow: 'hidden' }, shadow()]}>
          {ROWS.map((r, i) => (
            <Pressable
              key={r.label}
              onPress={() => router.push(r.href as never)}
              accessibilityRole="button"
              accessibilityLabel={`${r.label}. ${r.text}`}
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.md, minHeight: 60, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: color('border/subtle'), opacity: pressed ? 0.85 : 1 })}
            >
              <r.Icon size={22} color={color('accent/default')} weight="duotone" />
              <View style={{ flex: 1 }}>
                <Text style={[type['type/body-l'], { color: color('text/primary') }]}>{r.label}</Text>
                <Text style={[type['type/caption'], { color: color('text/tertiary') }]} numberOfLines={1}>{r.text}</Text>
              </View>
              <CaretRight size={18} color={color('text/tertiary')} />
            </Pressable>
          ))}
        </View>
        <View style={{ height: space.md }} />
      </ScrollView>
    </Screen>
  );
}
