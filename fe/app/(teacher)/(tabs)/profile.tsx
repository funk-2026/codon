import { useRouter } from 'expo-router';
import { Stack } from 'phosphor-react-native';
import { Chip, ErrorBanner, ListRow } from '@/src/components';
import { StaffProfileScreen } from '@/src/screens/StaffProfileScreen';
import { ROUTES } from '@/src/navigation/routes';
import { useAuth } from '@/src/auth/AuthContext';
import { useMe, useTeacherContentCount } from '@/src/queries/profile';

export default function TeacherProfileTab() {
  const router = useRouter();
  const auth = useAuth();
  const me = useMe();
  const count = useTeacherContentCount();
  const canManageAll = !!me.data?.user?.can_manage_all_content;
  const isAdmin = auth.status === 'authenticated' && auth.user.role === 'admin';

  return (
    <StaffProfileScreen
      roleLabel="Teacher"
      canSwitchRole={isAdmin}
      routes={{ manageDevices: ROUTES.teacher.manageDevices, giveFeedback: ROUTES.teacher.giveFeedback }}
      badges={canManageAll ? <Chip label="Can manage all content" tone="accent" /> : null}
      extras={
        <>
          {me.isError || count.isError ? (
            <ErrorBanner onRetry={() => { void me.refetch(); void count.refetch(); }} />
          ) : null}
          <ListRow
            Icon={Stack}
            label={`My Content${count.data != null ? ` — ${count.data} items` : ''}`}
            onPress={() => router.push(ROUTES.teacher.content)}
          />
        </>
      }
    />
  );
}
