import { useIsFocused } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FlatList,
  KeyboardAvoidingView,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  ViewToken,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { VideoCard } from '@/src/features/feed/components/VideoCard';
import { useSearch } from '@/src/features/search/hooks/useSearch';
import { layoutConfig } from '@/src/shared/config/layoutConfig';
import { Screen } from '@/src/shared/components/layout/Screen';
import { AppText } from '@/src/shared/components/ui/AppText';
import { Card } from '@/src/shared/components/ui/Card';
import { FloatingSearchControls } from '@/src/shared/components/ui/FloatingSearchControls';
import { Input } from '@/src/shared/components/ui/Input';
import { SegmentedControl } from '@/src/shared/components/ui/SegmentedControl';
import { useDebounce } from '@/src/shared/hooks/useDebounce';
import { useFloatingSearchControls } from '@/src/shared/hooks/useFloatingSearchControls';
import { useTheme } from '@/src/shared/theme/ThemeProvider';
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
const DEFAULT_CONTROLS_HEIGHT = 120;

export function ExploreScreen() {
  const { t } = useTranslation();
  const isFocused = useIsFocused();
  const { palette } = useTheme();
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<'relevance' | 'recent' | 'popular'>('relevance');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [controlsHeight, setControlsHeight] = useState(DEFAULT_CONTROLS_HEIGHT);
  const searchInputRef = useRef<TextInput>(null);
  const {
    mode: controlsMode,
    onScroll: onControlsScroll,
    onScrollBeginDrag: onControlsScrollBeginDrag,
    onScrollEndDrag: onControlsScrollEndDrag,
    onMomentumScrollBegin: onControlsMomentumBegin,
    onMomentumScrollEnd: onControlsMomentumEnd,
    onInputFocus: onControlsInputFocus,
    onInputBlur: onControlsInputBlur,
    expand: expandControls,
    expandedAnimatedStyle,
    collapsedAnimatedStyle,
  } = useFloatingSearchControls();

  const handleQueryChange = useCallback((text: string) => {
    setQuery(clampSearchQueryDraft(text));
  }, []);

  useEffect(() => {
    if (!isFocused) return;
    expandControls();
  }, [expandControls, isFocused]);

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
  const listTopInset = controlsHeight + layoutConfig.list.headerBottomMargin;

  const collapsedTriggerLabel = isSearching
    ? t('search.resultsForCompact', { query: debouncedQuery.trim() })
    : t('search.openControls');

  const expandedControls = (
    <View style={styles.controls}>
      <Card style={styles.controlsCard}>
        <Input
          ref={searchInputRef}
          placeholder={t('search.placeholder')}
          value={query}
          onChangeText={handleQueryChange}
          autoCapitalize="none"
          maxLength={SEARCH_MAX_QUERY_CHARS}
          onFocus={onControlsInputFocus}
          onBlur={onControlsInputBlur}
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
  );

  const collapsedControls = (
    <Pressable
      onPress={() => {
        expandControls();
        requestAnimationFrame(() => {
          searchInputRef.current?.focus();
        });
      }}
      style={({ pressed }) => [
        styles.collapsedTrigger,
        {
          backgroundColor: palette.surface,
          borderColor: palette.border,
        },
        pressed ? styles.collapsedTriggerPressed : null,
      ]}
      accessibilityRole="button"
      accessibilityLabel={t('search.openControlsA11y')}
    >
      <Ionicons name="search" size={16} color={palette.text.primary} />
      <AppText numberOfLines={1} style={styles.collapsedTriggerText}>
        {collapsedTriggerLabel}
      </AppText>
    </Pressable>
  );

  const renderItem = useCallback(
    ({ item }: { item: VideoFeedItem }) => (
      <VideoCard video={item} isActive={activeId === item.id} isScreenActive={isFocused} />
    ),
    [activeId, isFocused]
  );

  useEffect(() => {
    if (!isFocused) return;
    if (videos.length === 0) {
      setActiveId(null);
      return;
    }
    const hasActive = activeId ? videos.some((video) => video.id === activeId) : false;
    if (hasActive) return;
    setActiveId(videos[0].id);
  }, [activeId, isFocused, videos]);

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
  const handleListScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      onControlsScroll(event);
    },
    [onControlsScroll]
  );
  const handleListTouchStart = useCallback(() => {
    if (searchInputRef.current?.isFocused()) {
      searchInputRef.current.blur();
    }
  }, []);

  const isEmpty = !isLoading && videos.length === 0;

  return (
    <Screen contentStyle={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 100}
      >
        <View style={styles.listHost}>
          <FloatingSearchControls
            mode={controlsMode}
            expandedContent={expandedControls}
            collapsedContent={collapsedControls}
            expandedAnimatedStyle={expandedAnimatedStyle}
            collapsedAnimatedStyle={collapsedAnimatedStyle}
          onMeasureHeight={(nextHeight) => {
              if (nextHeight !== controlsHeight) {
                setControlsHeight(nextHeight);
              }
            }}
            containerStyle={styles.controlsOverlay}
          />
          <FlatList
            data={videos}
            renderItem={renderItem}
            keyExtractor={(item) => item.id}
            onEndReached={handleEndReached}
            onEndReachedThreshold={0.5}
            onScroll={handleListScroll}
            onTouchStart={handleListTouchStart}
            onScrollBeginDrag={onControlsScrollBeginDrag}
            onScrollEndDrag={onControlsScrollEndDrag}
            onMomentumScrollBegin={onControlsMomentumBegin}
            onMomentumScrollEnd={onControlsMomentumEnd}
            scrollEventThrottle={16}
            viewabilityConfig={viewabilityConfig}
            onViewableItemsChanged={onViewableItemsChanged}
            keyboardShouldPersistTaps="handled"
            removeClippedSubviews={false}
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
            contentContainerStyle={[
              styles.listContent,
              { paddingTop: listTopInset },
              isEmpty ? styles.listEmptyContainer : null,
            ]}
          />
        </View>
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
  controlsCard: {
    gap: spacing.sm,
  },
  resultsForText: {
    paddingHorizontal: spacing.xs,
  },
  controlsOverlay: {
    left: 0,
    right: 0,
  },
  listHost: {
    flex: 1,
  },
  collapsedTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    alignSelf: 'flex-start',
  },
  collapsedTriggerPressed: {
    transform: [{ scale: 0.98 }],
  },
  collapsedTriggerText: {
    maxWidth: 220,
    opacity: 0.9,
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
