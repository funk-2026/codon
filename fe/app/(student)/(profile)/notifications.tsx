import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, type Href } from 'expo-router';
import { Bell, CaretLeft, WarningCircle } from 'phosphor-react-native';
import { EmptyState, SecondaryButton, SkeletonBlock, TextButton } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { listNotifications, markNotificationsRead, type NotificationItem } from '@/src/api/discover';
import { routeFromNotification } from '@/src/notifications/logic';

const ago = (iso: string) => {
  const m = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h} h ago` : `${Math.floor(h / 24)} d ago`;
};

export default function NotificationsRoute() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [rows, setRows] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const r = await listNotifications({ limit: 30 });
      setRows(r.items);
      setUnread(r.unread_count);
      setCursor(r.next_cursor);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const open = async (n: NotificationItem) => {
    if (!n.read_at) {
      setRows((p) => p.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)));
      setUnread((u) => Math.max(0, u - 1));
      markNotificationsRead([n.id]).catch(() => {});
    }
    const route = routeFromNotification(n.data);
    if (route) router.push(route as Href);
  };

  const readAll = async () => {
    setRows((p) => p.map((x) => ({ ...x, read_at: x.read_at ?? new Date().toISOString() })));
    setUnread(0);
    markNotificationsRead().catch(() => void load());
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color('bg/canvas') }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.md, paddingTop: space.md }}>
        <Pressable onPress={() => router.back()} hitSlop={space.xs} accessibilityRole="button" accessibilityLabel="Back" style={{ minWidth: 44, minHeight: 44, justifyContent: 'center' }}>
          <CaretLeft size={24} color={color('text/primary')} />
        </Pressable>
        <Text accessibilityRole="header" style={[type['type/h1'], { color: color('text/primary'), flex: 1 }]}>Notifications</Text>
        {unread > 0 ? <TextButton label="Mark all read" onPress={readAll} /> : null}
      </View>
      <ScrollView contentContainerStyle={{ padding: space.md, gap: space.sm, paddingBottom: space['3xl'] + insets.bottom }}>
        {loading ? (
          [0, 1, 2].map((i) => <SkeletonBlock key={i} height={72} radius={radius.md} />)
        ) : error ? (
          <EmptyState icon={<WarningCircle size={32} color={color('semantic/danger')} weight="fill" />} title="Couldn’t load notifications" description="Check your connection and try again." action={<TextButton label="Retry" onPress={load} />} />
        ) : rows.length === 0 ? (
          <EmptyState icon={<Bell size={32} color={color('text/tertiary')} />} title="Nothing yet" description="Updates about your reports and streak will show up here." />
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
            {cursor ? <SecondaryButton label="Load more" onPress={async () => { const r = await listNotifications({ limit: 30, cursor }).catch(() => null); if (r) { setRows((p) => [...p, ...r.items]); setCursor(r.next_cursor); } }} /> : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
