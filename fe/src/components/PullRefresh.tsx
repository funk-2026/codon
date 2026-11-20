import { useCallback, useState } from 'react';
import { ActivityIndicator, RefreshControl, Text, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useTheme } from '@/src/theme/ThemeProvider';

/**
 * Pull down to refresh: refetches whatever the screen is showing (every active query), so a screen
 * does not have to list its own. `props` goes on a ScrollView/FlatList as `refreshControl={<RefreshControl {...props} />}`.
 */
export function usePullRefresh(offset = 0) {
  const qc = useQueryClient();
  const { color } = useTheme();
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await qc.refetchQueries({ type: 'active' });
    } finally {
      setRefreshing(false);
    }
  }, [qc]);
  // Under a collapsing header the native spinner would sit behind the header on iPhone, so the header screens hide it and show a RefreshPill instead.
  const control = (
    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} progressViewOffset={offset} tintColor={offset ? 'transparent' : color('accent/default')} colors={[color('accent/default')]} />
  );
  return { refreshing, control };
}

/** "Refreshing…" under a collapsing header while a pull-to-refresh is running. */
export function RefreshPill({ visible, top }: { visible: boolean; top: number }) {
  const { color, type, space, radius } = useTheme();
  if (!visible) return null;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: top + space.xs, left: 0, right: 0, alignItems: 'center', zIndex: 5 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs, backgroundColor: color('bg/surface'), borderRadius: radius.lg, paddingHorizontal: space.sm, paddingVertical: space.xs }}>
        <ActivityIndicator size="small" color={color('accent/default')} />
        <Text style={[type['type/caption'], { color: color('text/secondary') }]}>Refreshing…</Text>
      </View>
    </View>
  );
}
