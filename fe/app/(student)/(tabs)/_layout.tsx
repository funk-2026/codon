import { House, Exam, MonitorPlay, Lightbulb, Timer } from 'phosphor-react-native';
import { RoleTabs } from '@/src/navigation/RoleTabs';

// Five tabs. Profile is a pushed screen that opens from the avatar on Home.
export default function StudentTabs() {
  return (
    <RoleTabs
      tabs={[
        { name: 'home', title: 'Home', Icon: House },
        { name: 'practice', title: 'MCQs', Icon: Exam },
        { name: 'learn', title: 'Video', Icon: MonitorPlay },
        { name: 'tests', title: 'Tests', Icon: Timer },
        { name: 'support', title: 'Brain Hack', Icon: Lightbulb },
      ]}
    />
  );
}
