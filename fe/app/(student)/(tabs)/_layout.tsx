import { House, Exam, MonitorPlay, Lightbulb, User, Timer } from 'phosphor-react-native';
import { RoleTabs } from '@/src/navigation/RoleTabs';

// Five tabs. Profile is still a screen of this group but opens from the avatar on Home, not from the bar.
export default function StudentTabs() {
  return (
    <RoleTabs
      tabs={[
        { name: 'home', title: 'Home', Icon: House },
        { name: 'practice', title: 'MCQs', Icon: Exam },
        { name: 'learn', title: 'Video', Icon: MonitorPlay },
        { name: 'tests', title: 'Tests', Icon: Timer },
        { name: 'support', title: 'Brain Hack', Icon: Lightbulb },
        { name: 'profile', title: 'Profile', Icon: User, hidden: true },
      ]}
    />
  );
}
