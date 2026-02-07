import { useIsFocused } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, Easing, FlatList, KeyboardAvoidingView, Platform, StyleSheet, View, ViewToken } from 'react-native';

import { VideoCard } from '@/src/features/feed/components/VideoCard';
import { useSearch } from '@/src/features/search/hooks/useSearch';
import { layoutConfig } from '@/src/shared/config/layoutConfig';
import { Screen } from '@/src/shared/components/layout/Screen';
import { AppText } from '@/src/shared/components/ui/AppText';
import { Card } from '@/src/shared/components/ui/Card';
import { Input } from '@/src/shared/components/ui/Input';
import { SegmentedControl } from '@/src/shared/components/ui/SegmentedControl';
import { useAutoHideControlsOnScroll } from '@/src/shared/hooks/useAutoHideControlsOnScroll';
import { useDebounce } from '@/src/shared/hooks/useDebounce';
import { spacing } from '@/src/shared/theme/spacing';
import { VideoFeedItem } from '@/src/shared/types/api';
import {
  clampSearchQueryDraft,
  SEARCH_MAX_QUERY_CHARS,
} from '@/src/shared/utils/inputLimits';

const viewabilityConfig = {
  itemVisiblePercentThreshold: 70,
};
const LIST_INITIAL_RENDER_COUNT = 3;
const LIST_BATCH_RENDER_COUNT = 3;
const LIST_WINDOW_SIZE = 4;
const LIST_BATCH_UPDATE_MS = 32;

export function ExploreScreen() {
  const { t } = useTranslation();
  const isFocused = useIsFocused();
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<'relevance' | 'recent' | 'popular'>('relevance');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [controlsHeight, setControlsHeight] = useState(0);
  const controlsAnim = useRef(new Animated.Value(1)).current;
  const {
    isVisible: areControlsVisible,
    onScrollBeginDrag: onControlsScrollBeginDrag,
    onScrollEndDrag: onControlsScrollEndDrag,
    onMomentumScrollBegin: onControlsMomentumBegin,
    onMomentumScrollEnd: onControlsMomentumEnd,
    setInputFocused: setControlsInputFocused,
    showControlsOnFocus,
  } = useAutoHideControlsOnScroll({ graceMs: 3000 });

  const handleQueryChange = useCallback((text: string) => {
    setQuery(clampSearchQueryDraft(text));
  }, []);

  useEffect(() => {
    if (!isFocused) return;
    showControlsOnFocus();
  }, [isFocused, showControlsOnFocus]);

  useEffect(() => {
    Animated.timing(controlsAnim, {
      toValue: areControlsVisible ? 1 : 0,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [areControlsVisible, controlsAnim]);

  const controlsAnimatedStyle = useMemo(
    () => ({
      opacity: controlsAnim,
      height: controlsAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0, Math.max(controlsHeight, 1)],
      }),
      marginBottom: controlsAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0, layoutConfig.list.headerBottomMargin],
      }),
      transform: [
        {
          translateY: controlsAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [-12, 0],
          }),
        },
      ],
    }),
    [controlsAnim, controlsHeight]
  );

  const debouncedQuery = useDebounce(query, 550);
  const isSearching = debouncedQuery.trim().length > 0;

  const {
    data: searchData,
    fetchNextPage: fetchNextSearch,
    hasNextPage: hasNextSearch,
    isFetchingNextPage: isFetchingSearch,
    isLoading: isLoadingSearch,
  } = useSearch(
    debouncedQuery,
    sort
  );

  const videos = useMemo(() => searchData?.pages.flatMap((page) => page) ?? [], [searchData]);

  const isLoading = isSearching ? isLoadingSearch : false;
  const isFetchingNextPage = isSearching ? isFetchingSearch : false;
  const hasNextPage = isSearching ? hasNextSearch : false;
  const fetchNextPage = isSearching ? fetchNextSearch : undefined;
  const listHeader = useMemo(
    () => (
      <Animated.View
        style={[
          styles.controlsAnimated,
          controlsAnimatedStyle,
        ]}
        pointerEvents={areControlsVisible ? 'auto' : 'none'}
      >
        <View
          style={styles.controls}
          onLayout={(event) => {
            const nextHeight = Math.round(event.nativeEvent.layout.height);
            if (nextHeight > 0 && nextHeight !== controlsHeight) {
              setControlsHeight(nextHeight);
            }
          }}
        >
          <Card style={styles.controlsCard}>
            <Input
              placeholder={t('search.placeholder')}
              value={query}
              onChangeText={handleQueryChange}
              autoCapitalize="none"
              maxLength={SEARCH_MAX_QUERY_CHARS}
              onFocus={() => setControlsInputFocused(true)}
              onBlur={() => setControlsInputFocused(false)}
            />
            <SegmentedControl
              value={sort}
              onChange={(value) => setSort(value as 'relevance' | 'recent' | 'popular')}
              options={[
                { label: t('search.sortRelevance'), value: 'relevance' },
                { label: t('search.sortRecent'), value: 'recent' },
                { label: t('search.sortPopular'), value: 'popular' },
              ]}
            />
            {isSearching ? (
              <AppText variant="caption" style={styles.resultsForText}>
                {t('search.resultsFor', { query: debouncedQuery.trim() })}
              </AppText>
            ) : null}
          </Card>
        </View>
      </Animated.View>
    ),
    [
      areControlsVisible,
      controlsAnimatedStyle,
      controlsHeight,
      debouncedQuery,
      handleQueryChange,
      isSearching,
      query,
      setControlsInputFocused,
      sort,
      t,
    ]
  );

  const renderItem = useCallback(
    ({ item }: { item: VideoFeedItem }) => (
      <VideoCard video={item} isActive={activeId === item.id} isScreenActive={isFocused} />
    ),
    [activeId, isFocused]
  );

  useEffect(() => {
    if (!isFocused) {
      setActiveId(null);
    }
  }, [isFocused]);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const first = viewableItems[0]?.item as VideoFeedItem | undefined;
      if (!first) return;
      setActiveId((prev) => (prev === first.id ? prev : first.id));
    }
  ).current;

  const handleEndReached = () => {
    if (!isSearching) return;
    if (hasNextPage && !isFetchingNextPage && fetchNextPage) {
      fetchNextPage();
    }
  };

  const isEmpty = !isLoading && videos.length === 0;

  return (
    <Screen title={t('tabs.explore')} contentStyle={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 100}
      >
        <FlatList
          data={videos}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={listHeader}
          stickyHeaderIndices={[0]}
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.5}
          onScrollBeginDrag={onControlsScrollBeginDrag}
          onScrollEndDrag={onControlsScrollEndDrag}
          onMomentumScrollBegin={onControlsMomentumBegin}
          onMomentumScrollEnd={onControlsMomentumEnd}
          scrollEventThrottle={16}
          viewabilityConfig={viewabilityConfig}
          onViewableItemsChanged={onViewableItemsChanged}
          keyboardShouldPersistTaps="handled"
          removeClippedSubviews
          initialNumToRender={LIST_INITIAL_RENDER_COUNT}
          maxToRenderPerBatch={LIST_BATCH_RENDER_COUNT}
          windowSize={LIST_WINDOW_SIZE}
          updateCellsBatchingPeriod={LIST_BATCH_UPDATE_MS}
          ListEmptyComponent={
            isLoading ? null : (
              <View style={styles.empty}>
                <AppText>{isSearching ? t('search.empty') : t('search.hint')}</AppText>
              </View>
            )
          }
          contentContainerStyle={[styles.listContent, isEmpty ? styles.listEmptyContainer : null]}
        />
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: layoutConfig.list.headerGap,
  },
  controls: {
    gap: layoutConfig.list.headerGap,
  },
  controlsAnimated: {
    overflow: 'hidden',
  },
  controlsCard: {
    gap: spacing.sm,
  },
  resultsForText: {
    paddingHorizontal: spacing.xs,
  },
  listContent: {
    paddingBottom: spacing.xxxl,
    flexGrow: 1,
  },
  listEmptyContainer: {
    justifyContent: 'center',
  },
  empty: {
    gap: spacing.sm,
    alignItems: 'center',
  },
});
