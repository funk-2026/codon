import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { ClockCounterClockwise, WarningCircle } from 'phosphor-react-native';
import { EmptyState, Screen, ScreenHeader, SecondaryButton, SkeletonBlock, TextButton } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { listAuditLog, type AuditEntry } from '@/src/api/adminOps';
import { useCursorList } from '@/src/queries/useCursorList';
import { useRefetchOnFocus } from '@/src/queries/useRefetchOnFocus';
import { auditDetail } from '@/src/admin/auditDetail';
import { shadow } from '@/src/theme/elevation';

const LABEL: Record<string, string> = {
  'user.role_change': 'Changed a role',
  'user.teacher_permissions': 'Changed teacher permissions',
  'user.suspend': 'Suspended an account',
  'user.reactivate': 'Reactivated an account',
  'user.session_revoke': 'Signed a user out of a device',
  'user.sessions_revoke_all': 'Signed a user out everywhere',
  'user.grant_access': 'Gave or extended access',
  'user.purge_personal_data': 'Erased personal data',
  'content.takedown': 'Took content down',
  'setting.update': 'Changed a setting',
  'tag.merge': 'Merged tags',
  'preset.create': 'Created a custom test preset',
  'preset.update': 'Edited a custom test preset',
  'preset.delete': 'Deleted a custom test preset',
  'bookmark_collection.update': 'Edited a bookmark collection',
  'question.correction_applied': 'Applied a question correction',
  'question.metadata_update': 'Edited question tags',
};

const detail = auditDetail;

const when = (iso: string) => new Date(iso).toLocaleString([], { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

/** Who changed what, newest first. Opened from a user, it shows only that account's history. */
export default function AuditLogRoute() {
  const { color, type, space, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const { target } = useLocalSearchParams<{ target?: string }>();
  const list = useCursorList<AuditEntry, Awaited<ReturnType<typeof listAuditLog>>>(
    ['admin', 'audit', target ?? 'all'],
    (cursor) => listAuditLog({ target: target || undefined, limit: 50, cursor }),
    (r) => r.items,
  );
  useRefetchOnFocus(list.load);

  return (
    <Screen>
      <ScreenHeader title={target ? 'Account history' : 'Audit log'} />
      <ScrollView contentContainerStyle={{ padding: space.md, gap: space.xs, paddingBottom: space['3xl'] + insets.bottom }} showsVerticalScrollIndicator={false}>
        {list.loading ? (
          [0, 1, 2, 3].map((i) => <SkeletonBlock key={i} height={72} radius={radius.md} />)
        ) : list.error ? (
          <EmptyState
            icon={<WarningCircle size={32} color={color('semantic/danger')} weight="fill" />}
            title="Couldn’t load the audit log"
            description="Check your connection and try again."
            action={<TextButton label="Retry" onPress={list.load} />}
          />
        ) : list.rows.length === 0 ? (
          <EmptyState icon={<ClockCounterClockwise size={32} color={color('text/tertiary')} />} title="Nothing recorded yet" description="Changes admins make will show up here." />
        ) : (
          <>
            {list.rows.map((e) => (
              <View key={e.id} style={[{ backgroundColor: color('bg/surface'), borderRadius: radius.md, padding: space.sm }, shadow()]}>
                <Text style={[type['type/body-m-medium'], { color: color('text/primary') }]}>{LABEL[e.action] ?? e.action}</Text>
                {detail(e) ? <Text style={[type['type/body-m'], { color: color('text/secondary'), marginTop: 2 }]}>{detail(e)}</Text> : null}
                <Text style={[type['type/caption'], { color: color('text/tertiary'), marginTop: 2 }]} numberOfLines={1}>
                  {e.actor_name || e.actor_phone || 'An admin'} · {when(e.created_at)}
                </Text>
                {e.target ? <Text style={[type['type/caption'], { color: color('text/tertiary') }]} numberOfLines={1}>{e.target}</Text> : null}
              </View>
            ))}
            {list.hasMore ? <SecondaryButton label={list.more ? 'Loading…' : 'Load more'} onPress={() => void list.loadMore()} loading={list.more} /> : null}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}
