import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { UsersThree } from 'phosphor-react-native';
import { BottomSheet, EmptyState, Screen, ScreenHeader, SkeletonBlock, TextButton } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';
import { listFaculty, type Faculty } from '@/src/api/reference';
import { MediaImage } from '@/src/rich/MediaImage';
import { shadow } from '@/src/theme/elevation';

/** The people behind Codon: cards from the faculty roster an admin maintains, each opening a longer introduction. */
export default function TeamRoute() {
  const { color, type, space, radius } = useTheme();
  const q = useQuery({ queryKey: ['faculty'], queryFn: listFaculty, staleTime: 5 * 60_000 });
  const [open, setOpen] = useState<Faculty | null>(null);
  const media = q.data?.media ?? {};

  const photo = (f: Faculty, size: number) => (
    <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden', backgroundColor: color('accent/tint'), alignItems: 'center', justifyContent: 'center' }}>
      {f.media_id && media[f.media_id] ? <MediaImage media={media[f.media_id]} variant="thumb" maxHeight={size} /> : <Text style={[type['type/h3'], { color: color('accent/default') }]}>{f.name.replace(/^Dr\.?\s*/i, '').charAt(0).toUpperCase()}</Text>}
    </View>
  );

  return (
    <Screen>
      <ScreenHeader title="Our team and faculty" />
      <ScrollView contentContainerStyle={{ padding: space.md, gap: space.sm, paddingBottom: space['3xl'] }}>
        {q.isPending ? (
          [0, 1].map((i) => <SkeletonBlock key={i} height={120} radius={radius.lg} />)
        ) : q.isError ? (
          <EmptyState icon={<UsersThree size={32} color={color('text/tertiary')} />} title="Couldn’t load the team" description="Check your connection and try again." action={<TextButton label="Try again" onPress={() => void q.refetch()} />} />
        ) : q.data.faculty.length === 0 ? (
          <EmptyState icon={<UsersThree size={32} color={color('text/tertiary')} />} title="Meet the team soon" description="We’ll introduce the doctors and mentors behind Codon here." />
        ) : (
          q.data.faculty.map((f) => (
            <Pressable key={f.id} onPress={() => setOpen(f)} accessibilityRole="button" accessibilityLabel={`${f.name}. Meet`} style={({ pressed }) => [{ backgroundColor: color('bg/surface'), borderRadius: radius.lg, padding: space.md, gap: space.sm, opacity: pressed ? 0.94 : 1 }, shadow()]}>
              <View style={{ flexDirection: 'row', gap: space.md, alignItems: 'center' }}>
                {photo(f, 64)}
                <View style={{ flex: 1 }}>
                  <Text style={[type['type/h3'], { color: color('text/primary') }]}>{f.name}</Text>
                  {f.title ? <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>{f.title}</Text> : null}
                </View>
              </View>
              {f.summary ? <Text style={[type['type/body-m'], { color: color('text/secondary') }]} numberOfLines={3}>{f.summary}</Text> : null}
              <Text style={[type['type/body-m-medium'], { color: color('accent/default'), alignSelf: 'flex-end' }]}>Meet {f.name.split(' ')[0] === 'Dr.' ? f.name.split(' ')[1] ?? 'them' : f.name.split(' ')[0]} →</Text>
            </Pressable>
          ))
        )}
      </ScrollView>
      <BottomSheet visible={!!open} onClose={() => setOpen(null)} title={open?.name ?? ''} maxHeightPct={0.9}>
        {open ? (
          <ScrollView contentContainerStyle={{ alignItems: 'center', gap: space.sm, paddingBottom: space.lg }}>
            {photo(open, 120)}
            {open.title ? <Text style={[type['type/body-m-medium'], { color: color('text/secondary') }]}>{open.title}</Text> : null}
            <Text style={[type['type/body-l'], { color: color('text/primary'), alignSelf: 'stretch' }]}>{open.about || open.summary || ''}</Text>
          </ScrollView>
        ) : null}
      </BottomSheet>
    </Screen>
  );
}
