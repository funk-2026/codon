import { AppState, Platform } from 'react-native';
import { QueryClient, focusManager } from '@tanstack/react-query';
import { ApiError } from '@/src/api/client';

/** Retry network blips, never retry a request the server already rejected (4xx). */
function shouldRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
  return failureCount < 2;
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: shouldRetry,
      refetchOnReconnect: true,
    },
  },
});

// React Native has no window focus: map app foreground/background onto React Query's focus.
export function wireAppStateFocus(): () => void {
  if (Platform.OS === 'web') return () => {};
  const sub = AppState.addEventListener('change', (s) => focusManager.setFocused(s === 'active'));
  return () => sub.remove();
}
