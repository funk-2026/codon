import { House, Stack as StackIcon, UploadSimple, User } from 'phosphor-react-native';
import { RoleTabs } from '@/src/navigation/RoleTabs';

export default function TeacherTabs() {
  return (
    <RoleTabs
      tabs={[
        { name: 'home', title: 'Home', Icon: House },
        { name: 'content', title: 'My Content', Icon: StackIcon },
        { name: 'upload', title: 'Upload', Icon: UploadSimple },
        { name: 'profile', title: 'Profile', Icon: User },
      ]}
    />
  );
}
