import { RoleStack } from '@/src/navigation/RoleStack';

// Deep links into a detail screen still get the hub tabs underneath, so Back works.
export const unstable_settings = { anchor: '(tabs)' };

export default function StudentLayout() {
  return (
    <RoleStack
      screens={{
        'test-question': { gestureEnabled: false },
      }}
    />
  );
}
