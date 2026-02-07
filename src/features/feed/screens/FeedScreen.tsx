import { useIsFocused } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, NativeScrollEvent, NativeSyntheticEvent, StyleSheet, View, ViewToken } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ImmersiveFeedItem } from '@/src/features/feed/components/ImmersiveFeedItem';
import { useFeed } from '@/src/features/feed/hooks/useFeed';
import { AppText } from '@/src/shared/components/ui/AppText';
import { Button } from '@/src/shared/components/ui/Button';
import { Card } from '@/src/shared/components/ui/Card';
import { SegmentedControl } from '@/src/shared/components/ui/SegmentedControl';
import { Screen } from '@/src/shared/components/layout/Screen';
import { useNetworkStatus } from '@/src/shared/hooks/useNetworkStatus';
import { withAlpha } from '@/src/shared/theme/colorUtils';
import { spacing } from '@/src/shared/theme/spacing';
import { useTheme } from '@/src/shared/theme/ThemeProvider';
import { VideoFeedItem } from '@/src/shared/types/api';
import { useAppSettingsStore } from '@/src/store/appSettingsStore';

const viewabilityConfig = {
  itemVisiblePercentThreshold: 45,
};
const SWIPE_LOCK_MS = 500;

export function FeedScreen() {
  const { t } = useTranslation();
  const isFocused = useIsFocused();
  const insets = useSafeAreaInsets();
  const { palette } = useTheme();
  const autoPlayFeedVideos = useAppSettingsStore((state) => state.autoPlayFeedVideos);
  const feedPreserveAspectRatio = useAppSettingsStore((state) => state.feedPreserveAspectRatio);
  const { isConnected } = useNetworkStatus();
  const [sort, setSort] = useState<'random' | 'latest' | 'popular'>('random');
  const [activeIndex, setActiveIndex] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [isSwipeLocked, setIsSwipeLocked] = useState(false);
  const listRef = useRef<FlatList<VideoFeedItem>>(null);
  const activeIndexRef = useRef(0);
  const swipeUnlockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data, isFetchingNextPage, fetchNextPage, hasNextPage, isLoading, refetch } = useFeed(sort);

  const videos = useMemo(() => {
    const flattened = data?.pages.flatMap((page) => page) ?? [];
    const seen = new Set<string>();
    const deduped: VideoFeedItem[] = [];

    for (const item of flattened) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      deduped.push(item);
    }
    return deduped;
  }, [data]);

  const activeId = videos[activeIndex]?.id ?? null;

  useEffect(() => {
    activeIndexRef.current = activeIndex;
  }, [activeIndex]);

  const clearSwipeUnlockTimer = useCallback(() => {
    if (swipeUnlockTimerRef.current) {
      clearTimeout(swipeUnlockTimerRef.current);
      swipeUnlockTimerRef.current = null;
    }
  }, []);

  const lockSwipeTemporarily = useCallback(() => {
    clearSwipeUnlockTimer();
    setIsSwipeLocked(true);
    swipeUnlockTimerRef.current = setTimeout(() => {
      setIsSwipeLocked(false);
      swipeUnlockTimerRef.current = null;
    }, SWIPE_LOCK_MS);
  }, [clearSwipeUnlockTimer]);

  const applyActiveIndex = useCallback(
    (nextIndex: number) => {
      if (videos.length === 0) {
        setActiveIndex((prev) => (prev === 0 ? prev : 0));
        return;
      }
      const clamped = Math.max(0, Math.min(nextIndex, videos.length - 1));
      setActiveIndex((prev) => (prev === clamped ? prev : clamped));
    },
    [videos.length]
  );

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const firstVisible = viewableItems.find((item) => item.isViewable && typeof item.index === 'number');
      if (!firstVisible || typeof firstVisible.index !== 'number') return;
      applyActiveIndex(firstVisible.index);
    },
    [applyActiveIndex]
  );

  const renderItem = useCallback(
    ({ item }: { item: VideoFeedItem }) => (
      <ImmersiveFeedItem
        video={item}
        isActive={activeId === item.id}
        isScreenActive={isFocused}
        height={viewportHeight}
        autoPlayEnabled={autoPlayFeedVideos}
        preserveAspectRatio={feedPreserveAspectRatio}
      />
    ),
    [activeId, autoPlayFeedVideos, feedPreserveAspectRatio, isFocused, viewportHeight]
  );

  useEffect(() => {
    if (!isFocused) {
      clearSwipeUnlockTimer();
      setIsSwipeLocked(false);
      setActiveIndex(-1);
      return;
    }
    if (activeIndex < 0) {
      applyActiveIndex(0);
      return;
    }
    if (videos.length > 0 && activeIndex >= videos.length) {
      applyActiveIndex(videos.length - 1);
    }
  }, [activeIndex, applyActiveIndex, clearSwipeUnlockTimer, isFocused, videos.length]);

  useEffect(() => {
    clearSwipeUnlockTimer();
    setIsSwipeLocked(false);
    setActiveIndex(0);
    requestAnimationFrame(() => {
      listRef.current?.scrollToOffset({ offset: 0, animated: false });
    });
  }, [clearSwipeUnlockTimer, sort]);

  useEffect(() => {
    return () => {
      clearSwipeUnlockTimer();
    };
  }, [clearSwipeUnlockTimer]);

  useEffect(() => {
    if (videos.length === 0) return;
    if (activeIndex >= videos.length - 2 && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [activeIndex, fetchNextPage, hasNextPage, isFetchingNextPage, videos.length]);

  const onMomentumScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (viewportHeight <= 0) return;
      const nextIndex = Math.round(event.nativeEvent.contentOffset.y / viewportHeight);
      const previousIndex = activeIndexRef.current;
      applyActiveIndex(nextIndex);
      if (nextIndex !== previousIndex) {
        lockSwipeTemporarily();
      }
    },
    [applyActiveIndex, lockSwipeTemporarily, viewportHeight]
  );

  const getItemLayout = useCallback(
    (_data: ArrayLike<VideoFeedItem> | null | undefined, index: number) => ({
      index,
      length: viewportHeight,
      offset: viewportHeight * index,
    }),
    [viewportHeight]
  );

  const handleLayout = useCallback((height: number) => {
    if (height <= 0 || Math.abs(height - viewportHeight) < 1) return;
    setViewportHeight(height);
  }, [viewportHeight]);

  const keyExtractor = useCallback((item: VideoFeedItem) => item.id, []);

  const handleEndReached = () => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  };

  const isEmpty = !isLoading && videos.length === 0;

  return (
    <Screen contentStyle={styles.screenContent}>
      {!isConnected ? (
        <View style={[styles.offline, { top: insets.top + spacing.sm }]}>
          <AppText variant="caption" style={{ color: palette.onAccent }}>
            {t('common.offline')}
          </AppText>
        </View>
      ) : null}
      <View style={[styles.sortOverlay, { top: insets.top + spacing.sm }]}>
        <Card style={[styles.sortCard, { backgroundColor: withAlpha(palette.overlay, 0.93) }]}>
          <SegmentedControl
            value={sort}
            onChange={(value) => setSort(value as 'random' | 'latest' | 'popular')}
            options={[
              { label: t('feed.sortRandom'), value: 'random' },
              { label: t('feed.sortLatest'), value: 'latest' },
              { label: t('feed.sortPopular'), value: 'popular' },
            ]}
          />
        </Card>
      </View>
      <View
        style={styles.container}
        onLayout={(event) => {
          handleLayout(event.nativeEvent.layout.height);
        }}
      >
        <FlatList
          key={`feed-${sort}`}
          ref={listRef}
          data={videos}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.55}
          viewabilityConfig={viewabilityConfig}
          onViewableItemsChanged={onViewableItemsChanged}
          onMomentumScrollEnd={onMomentumScrollEnd}
          scrollEnabled={!isSwipeLocked}
          pagingEnabled
          disableIntervalMomentum
          decelerationRate="normal"
          snapToInterval={viewportHeight > 0 ? viewportHeight : undefined}
          snapToAlignment="start"
          removeClippedSubviews={false}
          initialNumToRender={2}
          maxToRenderPerBatch={2}
          windowSize={3}
          getItemLayout={viewportHeight > 0 ? getItemLayout : undefined}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            isLoading ? null : (
              <View style={styles.empty}>
                <AppText>{t('feed.empty')}</AppText>
                <Button label={t('common.retry')} onPress={() => refetch()} variant="secondary" />
              </View>
            )
          }
          contentContainerStyle={[styles.listContent, isEmpty ? styles.listEmptyContainer : null]}
        />
      </View>
      {isFetchingNextPage && !isEmpty ? (
        <View style={styles.paginationHint} pointerEvents="none">
          <View style={[styles.paginationPill, { backgroundColor: withAlpha(palette.overlay, 0.9) }]}>
            <ActivityIndicator size="small" color={palette.text.primary} />
            <AppText variant="caption">{t('common.loading')}</AppText>
          </View>
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  screenContent: {
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 0,
  },
  container: {
    flex: 1,
  },
  sortOverlay: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    zIndex: 30,
  },
  sortCard: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: 14,
  },
  listContent: {
    flexGrow: 1,
  },
  listEmptyContainer: {
    justifyContent: 'center',
  },
  paginationHint: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    bottom: spacing.xl,
    alignItems: 'center',
  },
  paginationPill: {
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  empty: {
    gap: spacing.md,
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  offline: {
    position: 'absolute',
    alignSelf: 'center',
    zIndex: 35,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: '#CF1E2A',
  },
});
