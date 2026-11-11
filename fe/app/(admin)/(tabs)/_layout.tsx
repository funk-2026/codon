import { House, Users, ClipboardText, CreditCard, User } from 'phosphor-react-native';
import { RoleTabs } from '@/src/navigation/RoleTabs';

export default function AdminTabs() {
  return (
    <RoleTabs
      tabs={[
        { name: 'home', title: 'Home', Icon: House },
        { name: 'users', title: 'Users', Icon: Users },
        { name: 'review', title: 'Review', Icon: ClipboardText },
        { name: 'payments', title: 'Payments', Icon: CreditCard },
        { name: 'profile', title: 'Profile', Icon: User },
      ]}
    />
  );
}
