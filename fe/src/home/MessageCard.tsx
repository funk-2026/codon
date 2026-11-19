import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { useTheme } from '@/src/theme/ThemeProvider';
import { getHomeMessage, type HomeMessage } from '@/src/api/discover';
import { MediaImage } from '@/src/rich/MediaImage';
import type { MediaMap } from '@/src/rich/ast';

/** A short quote with a name and photo, set by an admin. Hidden when there is none, or the request fails. */
export function MessageCard() {
  const { color, type, space, radius } = useTheme();
  const [msg, setMsg] = useState<HomeMessage | null>(null);
  const [media, setMedia] = useState<MediaMap>({});
  useEffect(() => {
    getHomeMessage().then((r) => { setMsg(r.message); setMedia(r.media ?? {}); }).catch(() => setMsg(null));
  }, []);
  if (!msg) return null;
  const photo = msg.media_id ? media[msg.media_id] : undefined;
  return (
    <View style={{ marginTop: space.xl }}>
      <Text style={[type['type/overline'], { color: color('text/tertiary'), marginBottom: space.xs }]}>A MESSAGE FROM {msg.name.toUpperCase()}</Text>
      <View style={{ backgroundColor: color('accent/tint'), borderRadius: radius.lg, padding: space.md, gap: space.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <View style={{ width: 56, height: 56, borderRadius: 28, overflow: 'hidden', backgroundColor: color('bg/surface'), alignItems: 'center', justifyContent: 'center' }}>
            {photo ? <MediaImage media={photo} variant="thumb" maxHeight={56} /> : <Text style={[type['type/h2'], { color: color('accent/default') }]}>{msg.name.replace(/^Dr\.?\s*/i, '').charAt(0).toUpperCase()}</Text>}
          </View>
          <Text style={[type['type/h3'], { color: color('text/primary'), flex: 1 }]}>{msg.name}</Text>
        </View>
        <Text style={[type['type/body-l'], { color: color('text/primary'), fontStyle: 'italic' }]}>“{msg.quote}”</Text>
      </View>
    </View>
  );
}
