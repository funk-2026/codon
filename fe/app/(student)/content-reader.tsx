import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type ScrollViewInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { CaretLeft, WarningCircle, LockSimple } from 'phosphor-react-native';
import { WebView } from 'react-native-webview';
import { EmptyState, PrimaryButton, SkeletonBlock, TextButton, Screen, ScreenHeader } from '@/src/components';
import { BookmarkToggle } from '@/src/bookmarks/BookmarkToggle';
import { useTheme } from '@/src/theme/ThemeProvider';
import type { ContentItem } from '@/src/api/content';
import { ApiError } from '@/src/api/client';
import { ROUTES } from '@/src/navigation/routes';
import { shadow } from '@/src/theme/elevation';
import { useContentItem } from '@/src/queries/curriculum';



export default function ContentReaderRoute() {
  const { color, type, space, radius } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const scrollRef = useRef<ScrollViewInstance>(null);
  
  const contentQuery = useContentItem(id);
  const loading = contentQuery.isPending;
  const accessDenied = contentQuery.error instanceof ApiError && contentQuery.error.status === 403;
  const loadError = contentQuery.isError && !accessDenied;
  const content = contentQuery.data ? { item: contentQuery.data.item, url: contentQuery.data.url } : null;
  const siblings: ContentItem[] = contentQuery.data?.siblings ?? [];
  const load = () => void contentQuery.refetch();

  const [progress, setProgress] = useState(0);
  const [scrolled, setScrolled] = useState(false);


  const topBarBg = useSharedValue(0);
  const bgSurface = color('bg/surface');

  useEffect(() => {
    topBarBg.value = withTiming(scrolled ? 1 : 0, { duration: 200 });
  }, [scrolled, topBarBg]);

  const topBarStyle = useAnimatedStyle(() => ({
    backgroundColor: topBarBg.value === 1 ? bgSurface : 'transparent',
    borderBottomWidth: topBarBg.value === 1 ? 1 : 0,
  }));

  const onScroll = (e: { nativeEvent: { contentOffset: { y: number }; contentSize: { height: number }; layoutMeasurement: { height: number } } }) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    const y = contentOffset.y;
    const max = contentSize.height - layoutMeasurement.height;
    setProgress(max > 0 ? y / max : 0);
    setScrolled(y > 40);
  };

  return (
    <Screen>
      {/* Sticky top bar */}
      <Animated.View
        style={[
          {
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            paddingTop: insets.top,
            zIndex: 10,
            borderBottomColor: color('border/subtle'),
          },
          topBarStyle,
        ]}
      >
        <ScreenHeader />
        <View style={{ height: 2, backgroundColor: color('bg/sunken') }}>
          <View
            style={{
              width: `${progress * 100}%`,
              height: 2,
              backgroundColor: color('accent/default'),
            }}
          />
        </View>
      </Animated.View>

      <ScrollView
        ref={scrollRef}
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{
          paddingHorizontal: space.lg,
          paddingTop: insets.top + 56,
          paddingBottom: space['3xl'] + insets.bottom,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Content header */}
        {loading ? (
          <View style={{ gap: space.sm }}>
            <SkeletonBlock width={90} height={16} radius={radius.sm} />
            <SkeletonBlock width={220} height={28} radius={radius.sm} />
          </View>
        ) : (
          <>
            <Text style={[type['type/caption'], { color: color('text/tertiary') }]}>
              {content?.item?.content_type === 'video' ? 'Video Class' : 'Document'}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
              <Text style={[type['type/h1'], { color: color('text/primary'), marginTop: space['2xs'], flex: 1 }]}>
                {content?.item?.title || 'Unable to load'}
              </Text>
              <BookmarkToggle type="content" id={content?.item?.id} />
            </View>
            {content?.item?.author_name ? (
              <Text style={[type['type/caption'], { color: color('text/tertiary'), marginTop: space['2xs'] }]}>By {content.item.author_name}</Text>
            ) : null}
          </>
        )}

        {loading ? (
          <View style={{ marginTop: space.lg, gap: space.md }}>
            <SkeletonBlock height={18} radius={radius.sm} />
            <SkeletonBlock height={18} radius={radius.sm} />
            <SkeletonBlock height={18} width="80%" radius={radius.sm} />
            <SkeletonBlock height={18} radius={radius.sm} />
            <SkeletonBlock height={18} width="60%" radius={radius.sm} />
          </View>
        ) : loadError ? (
          <EmptyState
            icon={<WarningCircle size={32} color={color('semantic/danger')} weight="fill" />}
            title="Couldn't load this content"
            description="Something went wrong loading this page. Check your connection and try again."
            action={<TextButton label="Retry" onPress={load} />}
            style={{ marginTop: space.xl }}
          />
        ) : accessDenied ? (
          <EmptyState
            icon={<LockSimple size={32} color={color('text/tertiary')} weight="fill" />}
            title="Subscription required"
            description="Subscribe to a plan to unlock this document."
            action={
              <PrimaryButton
                label="View Plans"
                onPress={() => router.replace(ROUTES.student.subscriptionPlans)}
              />
            }
            style={{ marginTop: space.xl }}
          />
        ) : (
          <>
            {/* Body */}
            <View style={content?.item?.body_text ? { marginTop: space.lg } : { marginTop: space.lg, height: 500 }}>
              {content?.item?.body_text ? (
                <Text style={[type['type/body-l'], { color: color('text/primary') }]}>{content.item.body_text}</Text>
              ) : content?.url ? (
                <WebView source={{ uri: content.url }} style={styles.docView} />
              ) : (
                <Text style={[type['type/body-l'], { color: color('text/secondary') }]}>
                  This document isn&apos;t available yet.
                </Text>
              )}
            </View>

            {/* End-of-content footer */}
            <View
              style={{
                borderTopWidth: 1,
                borderTopColor: color('border/subtle'),
                marginTop: space.xl,
                paddingTop: space.lg,
              }}
            >
              <Text
                style={[
                  type['type/overline'],
                  { color: color('text/tertiary'), marginBottom: space.sm },
                ]}
              >
                MORE IN THIS CHAPTER
              </Text>
              <View style={{ gap: space.xs }}>
                {siblings.map((s) => (
                  <Pressable
                    key={s.id}
                    onPress={() => router.push({ pathname: ROUTES.student.contentReader, params: { id: s.id } })}
                    style={({ pressed }) => [
                      styles.siblingRow,
                      {
                        backgroundColor: color('bg/surface'),
                        borderRadius: radius.md,
                        padding: space.sm,
                        opacity: pressed ? 0.94 : 1,
                      },
                      shadow(),
                    ]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[type['type/body-m-medium'], { color: color('text/primary') }]}
                        numberOfLines={1}
                      >
                        {s.title}
                      </Text>
                      <Text style={[type['type/caption'], { color: color('text/tertiary'), marginTop: 2 }]}>
                        {s.content_type === 'video' ? 'Video' : 'Document'}
                      </Text>
                    </View>
                    <CaretLeft size={18} color={color('text/tertiary')} style={{ transform: [{ rotate: '180deg' }] }} />
                  </Pressable>
                ))}
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}


const styles = StyleSheet.create({
  topBar: { flexDirection: 'row', alignItems: 'center' },
  siblingRow: { flexDirection: 'row', alignItems: 'center' },
  docView: { flex: 1 },
});
