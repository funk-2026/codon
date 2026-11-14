import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, type Href } from 'expo-router';
import { Bell, WarningCircle } from 'phosphor-react-native';
import { EmptyState, SecondaryButton, SkeletonBlock, TextButton, ScreenHeader, Screen } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import type { NotificationItem } from '@/src/api/discover';
import { useMarkNotificationsRead, useNotifications } from '@/src/queries/discover';

const ago = (iso: string) => {
  const m = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h} h ago` : `${Math.floor(h / 24)} d ago`;
};

export function NotificationsList({ routeFor, emptyText }: { routeFor: (n: NotificationItem) => string | null; emptyText: string }) {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const list = useNotifications();
  const markRead = useMarkNotificationsRead();
  const rows = list.data?.pages.flatMap((p) => p.items) ?? [];
  const unread = list.data?.pages[0]?.unread_count ?? 0;
  const loading = list.isPending;
  const error = list.isError;
  const load = () => void list.refetch();

  const open = (n: NotificationItem) => {
    if (!n.read_at) markRead.mutate([n.id]);
    const route = routeFor(n);
    if (route) router.push(route as Href);
  };

  const readAll = () => markRead.mutate(undefined);

  return (
    <Screen>
      <ScreenHeader title="Notifications" right={<>
{unread > 0 ? <TextButton label="Mark all read" onPress={readAll} /> : null}
</>} />
      <ScrollView contentContainerStyle={{ padding: space.md, gap: space.sm, paddingBottom: space['3xl'] + insets.bottom }}>
        {loading ? (
          [0, 1, 2].map((i) => <SkeletonBlock key={i} height={72} radius={radius.md} />)
        ) : error ? (
          <EmptyState icon={<WarningCircle size={32} color={color('semantic/danger')} weight="fill" />} title="Couldn’t load notifications" description="Check your connection and try again." action={<TextButton label="Retry" onPress={load} />} />
        ) : rows.length === 0 ? (
          <EmptyState icon={<Bell size={32} color={color('text/tertiary')} />} title="Nothing yet" description={emptyText} />
        ) : (
          <>
            {rows.map((n) => (
              <Pressable
                key={n.id}
                onPress={() => open(n)}
                accessibilityRole="button"
                accessibilityLabel={`${n.title}. ${n.body}. ${ago(n.created_at)}. ${n.read_at ? '' : 'Unread'}`}
                style={{ backgroundColor: n.read_at ? color('bg/surface') : color('accent/tint'), borderRadius: radius.md, padding: space.md, gap: 2 }}
              >
                <View style={{ flexDirection: 'row' }}>
                  <Text style={[type['type/body-m-medium'], { color: color('text/primary'), flex: 1 }]}>{n.title}</Text>
                  <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>{ago(n.created_at)}</Text>
                </View>
                {n.body ? <Text style={[type['type/body-m'], { color: color('text/secondary') }]}>{n.body}</Text> : null}
              </Pressable>
            ))}
            {list.hasNextPage ? <SecondaryButton label="Load more" onPress={() => void list.fetchNextPage()} loading={list.isFetchingNextPage} /> : null}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}
