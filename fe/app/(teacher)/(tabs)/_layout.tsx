import { ChatCircleDots, House, Stack as StackIcon, User } from 'phosphor-react-native';
import { RoleTabs } from '@/src/navigation/RoleTabs';

export default function TeacherTabs() {
  return (
    <RoleTabs
      tabs={[
        { name: 'home', title: 'Home', Icon: House },
        { name: 'content', title: 'Content', Icon: StackIcon },
        { name: 'questions', title: 'Questions', Icon: ChatCircleDots },
        { name: 'profile', title: 'Profile', Icon: User },
      ]}
    />
  );
}
