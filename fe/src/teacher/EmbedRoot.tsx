import { View } from 'react-native';
import { Screen } from '@/src/components';

/**
 * Lets a full screen also live inside a tab: as a route it is a normal Screen with its own
 * header; embedded it is just a flexible box and the tab supplies the header.
 */
export function EmbedRoot({ embedded, children }: { embedded?: boolean; children: React.ReactNode }) {
  return embedded ? <View style={{ flex: 1 }}>{children}</View> : <Screen>{children}</Screen>;
}
