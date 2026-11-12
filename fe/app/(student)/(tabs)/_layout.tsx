import { House, Exam, BookOpen, HandHeart, User } from 'phosphor-react-native';
import { RoleTabs } from '@/src/navigation/RoleTabs';

export default function StudentTabs() {
  return (
    <RoleTabs
      tabs={[
        { name: 'home', title: 'Home', Icon: House },
        { name: 'practice', title: 'Practice', Icon: Exam },
        { name: 'learn', title: 'Learn', Icon: BookOpen },
        { name: 'support', title: 'Support', Icon: HandHeart },
        { name: 'profile', title: 'Profile', Icon: User },
      ]}
    />
  );
}
