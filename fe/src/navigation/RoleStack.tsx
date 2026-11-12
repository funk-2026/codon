import { Stack } from 'expo-router';
import { useStackScreenOptions } from '@/src/components/ThemedStack';

/**
 * Root stack for a role: `(tabs)` (the hubs) plus every screen opened from them.
 * Screens register by file name, so adding a screen means adding a file, not
 * editing a layout. Pass `screens` only for per-screen overrides (e.g. modals).
 */
export function RoleStack({ screens }: { screens?: Record<string, object> }) {
  const base = useStackScreenOptions();
  return (
    <Stack screenOptions={base}>
      <Stack.Screen name="(tabs)" />
      {Object.entries(screens ?? {}).map(([name, options]) => (
        <Stack.Screen key={name} name={name} options={options} />
      ))}
    </Stack>
  );
}
