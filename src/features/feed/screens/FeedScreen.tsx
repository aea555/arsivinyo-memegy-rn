import { useIsFocused } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  View,
  ViewToken,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ImmersiveFeedItem } from '@/src/features/feed/components/ImmersiveFeedItem';
import { useFeed } from '@/src/features/feed/hooks/useFeed';
import { subscribeFeedRandomRefresh } from '@/src/features/feed/services/feedEvents';
import { AppText } from '@/src/shared/components/ui/AppText';
import { Button } from '@/src/shared/components/ui/Button';
import { SortFilterDropdown } from '@/src/shared/components/ui/SortFilterDropdown';
import { Screen } from '@/src/shared/components/layout/Screen';
import { useNetworkStatus } from '@/src/shared/hooks/useNetworkStatus';
import { withAlpha } from '@/src/shared/theme/colorUtils';
import { spacing } from '@/src/shared/theme/spacing';
import { useTheme } from '@/src/shared/theme/ThemeProvider';
import { VideoFeedItem } from '@/src/shared/types/api';
import { useAppSettingsStore } from '@/src/store/appSettingsStore';

const viewabilityConfig = {
  itemVisiblePercentThreshold: 60,
};
const FEED_PERF_DEBUG =
  __DEV__ &&
  (globalThis as typeof globalThis & { __MEMEGY_FEED_PERF__?: boolean }).__MEMEGY_FEED_PERF__ === true;

export function FeedScreen() {
  const { t } = useTranslation();
  const isFocused = useIsFocused();
  const insets = useSafeAreaInsets();
  const { palette } = useTheme();
  const autoPlayFeedVideos = useAppSettingsStore((state) => state.autoPlayFeedVideos);
  const autoSwipeFeedVideos = useAppSettingsStore((state) => state.autoSwipeFeedVideos);
  const resetFeedVideoOnSwipe = useAppSettingsStore((state) => state.resetFeedVideoOnSwipe);
  const feedHoldFastForwardSpeed = useAppSettingsStore((state) => state.feedHoldFastForwardSpeed);
  const feedPreserveAspectRatio = useAppSettingsStore((state) => state.feedPreserveAspectRatio);
  const feedIncludeNsfw = useAppSettingsStore((state) => state.feedIncludeNsfw);
  const setFeedIncludeNsfw = useAppSettingsStore((state) => state.setFeedIncludeNsfw);
  const { isConnected } = useNetworkStatus();
  const [sort, setSort] = useState<'random' | 'latest' | 'popular'>('random');
  const [sortPickerVisible, setSortPickerVisible] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [randomRefreshNonce, setRandomRefreshNonce] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const listRef = useRef<FlatList<VideoFeedItem>>(null);
  const renderCountRef = useRef(0);
  const activeIndexRef = useRef(activeIndex);
  const pausedIndexRef = useRef(0);
  const lastAutoAdvanceRef = useRef<{ videoId: string; at: number } | null>(null);

  const { data, isFetchingNextPage, fetchNextPage, hasNextPage, isLoading, refetch } = useFeed(sort, {
    randomRefreshNonce,
  });

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
  const sortOptions = useMemo(
    () => [
      { label: t('feed.sortRandom'), value: 'random' as const },
      { label: t('feed.sortLatest'), value: 'latest' as const },
      { label: t('feed.sortPopular'), value: 'popular' as const },
    ],
    [t]
  );
  const selectedSortLabel = useMemo(
    () => sortOptions.find((option) => option.value === sort)?.label ?? t('feed.sortRandom'),
    [sort, sortOptions, t]
  );

  renderCountRef.current += 1;
  if (FEED_PERF_DEBUG) {
    console.debug('[feed.perf] render', {
      renderCount: renderCountRef.current,
      sort,
      activeIndex,
      totalVideos: videos.length,
    });
  }

  useEffect(() => {
    activeIndexRef.current = activeIndex;
    if (activeIndex >= 0) {
      pausedIndexRef.current = activeIndex;
    }
  }, [activeIndex]);

  const applyActiveIndex = useCallback(
    (nextIndex: number, source: 'viewability' | 'focus' | 'sort' = 'viewability') => {
      if (videos.length === 0) {
        setActiveIndex((prev) => (prev === 0 ? prev : 0));
        return;
      }
      const clamped = Math.max(0, Math.min(nextIndex, videos.length - 1));
      if (FEED_PERF_DEBUG && clamped !== activeIndexRef.current) {
        console.debug('[feed.perf] active-index', {
          source,
          from: activeIndexRef.current,
          to: clamped,
        });
      }
      setActiveIndex((prev) => (prev === clamped ? prev : clamped));
    },
    [videos.length]
  );

  const applyActiveIndexRef = useRef(applyActiveIndex);
  useEffect(() => {
    applyActiveIndexRef.current = applyActiveIndex;
  }, [applyActiveIndex]);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const firstVisible = viewableItems.find(
        (item) => item.isViewable && typeof item.index === 'number'
      );
      if (!firstVisible || typeof firstVisible.index !== 'number') return;
      applyActiveIndexRef.current(firstVisible.index, 'viewability');
    }
  ).current;

  const handleToggleMute = useCallback(() => {
    setIsMuted((prev) => !prev);
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: VideoFeedItem }) => (
      <ImmersiveFeedItem
        video={item}
        isActive={activeId === item.id}
        isScreenActive={isFocused}
        height={viewportHeight}
        autoPlayEnabled={autoPlayFeedVideos}
        resetOnInactive={resetFeedVideoOnSwipe}
        muted={isMuted}
        holdFastForwardRate={feedHoldFastForwardSpeed}
        preserveAspectRatio={feedPreserveAspectRatio}
        onToggleMute={handleToggleMute}
        onVideoEnd={() => {
          if (!autoSwipeFeedVideos) return;
          if (activeId !== item.id) return;

          const now = Date.now();
          const lastAutoAdvance = lastAutoAdvanceRef.current;
          if (
            lastAutoAdvance &&
            lastAutoAdvance.videoId === item.id &&
            now - lastAutoAdvance.at < 900
          ) {
            return;
          }
          lastAutoAdvanceRef.current = { videoId: item.id, at: now };

          const currentIndex = activeIndexRef.current;
          const nextIndex = currentIndex + 1;
          if (nextIndex >= videos.length) {
            if (hasNextPage && !isFetchingNextPage) {
              void fetchNextPage();
            }
            return;
          }

          listRef.current?.scrollToIndex({ index: nextIndex, animated: true });
          applyActiveIndexRef.current(nextIndex, 'viewability');
        }}
      />
    ),
    [
      activeId,
      autoPlayFeedVideos,
      autoSwipeFeedVideos,
      isMuted,
      feedHoldFastForwardSpeed,
      resetFeedVideoOnSwipe,
      feedPreserveAspectRatio,
      fetchNextPage,
      handleToggleMute,
      hasNextPage,
      isFetchingNextPage,
      isFocused,
      videos.length,
      viewportHeight,
    ]
  );

  useEffect(() => {
    if (!isFocused) {
      if (activeIndexRef.current >= 0) {
        pausedIndexRef.current = activeIndexRef.current;
      }
      setActiveIndex(-1);
      return;
    }
    if (activeIndex < 0) {
      applyActiveIndex(pausedIndexRef.current, 'focus');
      return;
    }
    if (videos.length > 0 && activeIndex >= videos.length) {
      applyActiveIndex(videos.length - 1, 'focus');
    }
  }, [activeIndex, applyActiveIndex, isFocused, videos.length]);

  useEffect(() => {
    pausedIndexRef.current = 0;
    setActiveIndex((prev) => (prev === 0 ? prev : 0));
    requestAnimationFrame(() => {
      listRef.current?.scrollToOffset({ offset: 0, animated: false });
    });
  }, [sort]);

  useEffect(() => {
    const unsubscribe = subscribeFeedRandomRefresh(() => {
      if (sort !== 'random') return;
      lastAutoAdvanceRef.current = null;
      pausedIndexRef.current = 0;
      setActiveIndex((prev) => (prev === 0 ? prev : 0));
      setRandomRefreshNonce((prev) => prev + 1);
      requestAnimationFrame(() => {
        listRef.current?.scrollToOffset({ offset: 0, animated: false });
      });
    });
    return unsubscribe;
  }, [sort]);

  useEffect(() => {
    if (videos.length === 0) return;
    if (activeIndex >= videos.length - 2 && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [activeIndex, fetchNextPage, hasNextPage, isFetchingNextPage, videos.length]);

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

  const handleEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

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
      <View
        style={styles.container}
        onLayout={(event) => {
          handleLayout(event.nativeEvent.layout.height);
        }}
        >
        {sortPickerVisible ? (
          <Pressable
            style={styles.sortBackdropTouch}
            onPress={() => setSortPickerVisible(false)}
            accessibilityRole="button"
            accessibilityLabel={t('common.cancel')}
          />
        ) : null}
        <View pointerEvents="box-none" style={[styles.sortControlWrap, { top: insets.top + spacing.sm }]}>
          <SortFilterDropdown
            triggerLabel={selectedSortLabel}
            triggerA11yLabel={t('feed.sort')}
            visible={sortPickerVisible}
            onToggleVisible={() => setSortPickerVisible((prev) => !prev)}
            options={sortOptions}
            selectedValue={sort}
            onSelect={(value) => {
              setSort(value);
              setSortPickerVisible(false);
            }}
            quickToggleLabel={t('feed.showNsfw')}
            quickToggleA11yLabel={t('feed.showNsfw')}
            quickToggleEnabled={feedIncludeNsfw}
            quickToggleTone="warning"
            onQuickToggle={() => {
              void setFeedIncludeNsfw(!feedIncludeNsfw);
            }}
            triggerMaxWidth={210}
            dropdownMinWidth={168}
          />
        </View>
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
          pagingEnabled
          disableIntervalMomentum
          decelerationRate="fast"
          snapToInterval={viewportHeight > 0 ? viewportHeight : undefined}
          snapToAlignment="start"
          removeClippedSubviews={false}
          initialNumToRender={1}
          maxToRenderPerBatch={1}
          windowSize={2}
          updateCellsBatchingPeriod={16}
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
  sortBackdropTouch: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9,
  },
  sortControlWrap: {
    position: 'absolute',
    left: spacing.md,
    zIndex: 20,
  },
});
