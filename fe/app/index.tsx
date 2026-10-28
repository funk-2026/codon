import { useEffect } from 'react';
import { View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useTheme } from '@/src/theme/ThemeProvider';
import { useAuth, type Role } from '@/src/auth/AuthContext';

const ROLE_HOME: Record<Role, Href> = {
  student: '/(student)/(home)',
  teacher: '/(teacher)/(tabs)/(home)',
  admin: '/(admin)/(home)',
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
            router.replace('/role-picker' as any);
          }
        } else {
          router.replace(ROLE_HOME[auth.user.role]);
        }
      } else {
        router.replace('/phone-entry');
      }
    };

    navigate();

    return () => {
      isMounted = false;
    };
  }, [auth.status, auth.user, router]);

  return <View style={{ flex: 1, backgroundColor: color('bg/canvas') }} />;
}
