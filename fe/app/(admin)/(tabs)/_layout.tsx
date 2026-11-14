import { House, Users, ClipboardText, CreditCard, User } from 'phosphor-react-native';
import { RoleTabs } from '@/src/navigation/RoleTabs';
import { totalWaiting, useAdminInbox } from '@/src/admin/useAdminInbox';

export default function AdminTabs() {
  const inbox = useAdminInbox();
  return (
    <RoleTabs
      tabs={[
        { name: 'home', title: 'Home', Icon: House },
        { name: 'users', title: 'Users', Icon: Users },
        { name: 'review', title: 'Review', Icon: ClipboardText, badge: totalWaiting(inbox.data) },
        { name: 'payments', title: 'Payments', Icon: CreditCard },
        { name: 'profile', title: 'Profile', Icon: User },
      ]}
    />
  );
}
