import { useIsFocused } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, KeyboardAvoidingView, Platform, StyleSheet, View, ViewToken } from 'react-native';

import { VideoCard } from '@/src/features/feed/components/VideoCard';
import { useFeed } from '@/src/features/feed/hooks/useFeed';
import { useSearch } from '@/src/features/search/hooks/useSearch';
import { Screen } from '@/src/shared/components/layout/Screen';
import { AppText } from '@/src/shared/components/ui/AppText';
import { Card } from '@/src/shared/components/ui/Card';
import { Input } from '@/src/shared/components/ui/Input';
import { SegmentedControl } from '@/src/shared/components/ui/SegmentedControl';
import { useDebounce } from '@/src/shared/hooks/useDebounce';
import { spacing } from '@/src/shared/theme/spacing';
import { VideoFeedItem } from '@/src/shared/types/api';

const viewabilityConfig = {
  itemVisiblePercentThreshold: 70,
};

export function ExploreScreen() {
  const { t } = useTranslation();
  const isFocused = useIsFocused();
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<'relevance' | 'recent' | 'popular'>('relevance');
  const [activeId, setActiveId] = useState<string | null>(null);

  const handleQueryChange = useCallback((text: string) => {
    setQuery(text);
  }, []);

  const debouncedQuery = useDebounce(query, 400);
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

  const {
    data: popularData,
    fetchNextPage: fetchNextPopular,
    hasNextPage: hasNextPopular,
    isFetchingNextPage: isFetchingPopular,
    isLoading: isLoadingPopular,
  } = useFeed('popular', { enabled: !isSearching });

  const videos = useMemo(() => {
    const pages = isSearching ? searchData?.pages : popularData?.pages;
    return pages?.flatMap((page) => page) ?? [];
  }, [isSearching, popularData, searchData]);

  const isLoading = isSearching ? isLoadingSearch : isLoadingPopular;
  const isFetchingNextPage = isSearching ? isFetchingSearch : isFetchingPopular;
  const hasNextPage = isSearching ? hasNextSearch : hasNextPopular;
  const fetchNextPage = isSearching ? fetchNextSearch : fetchNextPopular;

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
    if (hasNextPage && !isFetchingNextPage) {
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
        <View style={styles.controls}>
          <Card style={styles.controlsCard}>
            <Input
              placeholder={t('search.placeholder')}
              value={query}
              onChangeText={handleQueryChange}
              autoCapitalize="none"
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
          </Card>
        </View>
        <FlatList
          data={videos}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.5}
          viewabilityConfig={viewabilityConfig}
          onViewableItemsChanged={onViewableItemsChanged}
          keyboardShouldPersistTaps="handled"
          removeClippedSubviews={false}
          ListEmptyComponent={
            isLoading ? null : (
              <View style={styles.empty}>
                <AppText>{isSearching ? t('search.empty') : t('feed.empty')}</AppText>
                {isSearching ? <AppText variant="caption">{t('search.hint')}</AppText> : null}
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
    gap: spacing.md,
  },
  controls: {
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  controlsCard: {
    gap: spacing.md,
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
