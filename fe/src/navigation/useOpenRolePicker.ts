import { useCallback } from 'react';
import { useRouter } from 'expo-router';
import { ROUTES } from './routes';

/**
 * Opens the role picker with a clean stack: every screen opened so far is dropped,
 * so there is nothing behind it to go back to (and no stale role's screens left mounted).
 */
export function useOpenRolePicker(): () => void {
  const router = useRouter();
  return useCallback(() => {
    if (router.canDismiss()) router.dismissAll();
    router.replace(ROUTES.auth.rolePicker);
  }, [router]);
}
