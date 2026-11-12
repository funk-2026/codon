import { useCallback } from 'react';
import { useRouter, type Href } from 'expo-router';
import { useAuth } from '@/src/auth/AuthContext';
import { ROUTES } from './routes';

/**
 * Back that always lands somewhere. A deep link or notification can open a detail
 * screen with no history; then plain `router.back()` does nothing and the user is
 * stuck. This falls back to the given route, or to the signed-in role's home.
 */
export function useSafeBack(fallback?: Href): () => void {
  const router = useRouter();
  const auth = useAuth();
  const role = auth.status === 'authenticated' ? auth.user.role : null;
  const home: Href =
    fallback ??
    (role === 'teacher'
      ? ROUTES.teacher.home
      : role === 'admin'
        ? ROUTES.admin.home
        : role === 'student'
          ? ROUTES.student.home
          : ROUTES.auth.phoneEntry);

  return useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace(home);
  }, [router, home]);
}
