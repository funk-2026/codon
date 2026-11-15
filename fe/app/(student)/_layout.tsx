import { View } from 'react-native';
import { RoleStack } from '@/src/navigation/RoleStack';
import { VideoSessionProvider } from '@/src/video/VideoSession';
import { MiniPlayer } from '@/src/video/MiniPlayer';

// Deep links into a detail screen still get the hub tabs underneath, so Back works.
export const unstable_settings = { anchor: '(tabs)' };

export default function StudentLayout() {
  return (
    <VideoSessionProvider>
      <View style={{ flex: 1 }}>
        <RoleStack
          screens={{
            'test-question': { gestureEnabled: false },
          }}
        />
        <MiniPlayer />
      </View>
    </VideoSessionProvider>
  );
}
