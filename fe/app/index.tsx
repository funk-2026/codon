import { useEffect } from 'react';
import { View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useTheme } from '@/src/theme/ThemeProvider';
import { useAuth, type Role } from '@/src/auth/AuthContext';
import { ROUTES } from '@/src/navigation/routes';
import { kvGet } from '@/src/storage/kv';

const ROLE_HOME: Record<Role, Href> = {
  student: ROUTES.student.home,
  teacher: ROUTES.teacher.home,
  admin: ROUTES.admin.home,
};

export default function IndexRoute() {
  const { color } = useTheme();
  const auth = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (auth.status === 'loading') return;

    let isMounted = true;

    const navigate = async () => {
      if (auth.status === 'authenticated') {
        if (auth.user.role === 'admin') {
          const { getAdminActiveRole } = await import('@/src/auth/tokenStore');
          const activeRole = await getAdminActiveRole();
          if (!isMounted) return;
          if (activeRole) {
            router.replace(ROLE_HOME[activeRole]);
          } else {
            router.replace(ROUTES.auth.rolePicker as any);
          }
        } else {
          router.replace(ROLE_HOME[auth.user.role]);
        }
      } else {
        // First launch: a short intro, once.
        const seen = await kvGet<boolean>('intro-seen', false);
        if (!isMounted) return;
        router.replace(seen ? ROUTES.auth.phoneEntry : (ROUTES.auth.onboarding as any));
      }
    };

    navigate();

    return () => {
      isMounted = false;
    };
  }, [auth.status, auth.user, router]);

  return <View style={{ flex: 1, backgroundColor: color('bg/canvas') }} />;
}
