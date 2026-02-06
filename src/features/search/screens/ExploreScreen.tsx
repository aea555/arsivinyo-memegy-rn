import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';

import { VideoCard } from '@/src/features/feed/components/VideoCard';
import { useFeed } from '@/src/features/feed/hooks/useFeed';
import { useSearch } from '@/src/features/search/hooks/useSearch';
import { AppText } from '@/src/shared/components/ui/AppText';
import { Input } from '@/src/shared/components/ui/Input';
import { Button } from '@/src/shared/components/ui/Button';
import { Screen } from '@/src/shared/components/layout/Screen';
import { useDebounce } from '@/src/shared/hooks/useDebounce';
import { spacing } from '@/src/shared/theme/spacing';
import { VideoFeedItem } from '@/src/shared/types/api';

export function ExploreScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<'relevance' | 'recent' | 'popular'>('relevance');

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
      <VideoCard video={item} isActive={false} onPress={() => router.push(`/video/${item.id}`)} />
    ),
    [router]
  );

  const handleEndReached = () => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  };

  return (
    <Screen style={styles.container}>
      <AppText variant="heading2">{t('tabs.explore')}</AppText>
      <View style={styles.controls}>
        <Input
          placeholder={t('search.placeholder')}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
        />
        <View style={styles.sortRow}>
          <Button
            label={t('search.sortRelevance')}
            onPress={() => setSort('relevance')}
            variant={sort === 'relevance' ? 'primary' : 'secondary'}
          />
          <Button
            label={t('search.sortRecent')}
            onPress={() => setSort('recent')}
            variant={sort === 'recent' ? 'primary' : 'secondary'}
          />
          <Button
            label={t('search.sortPopular')}
            onPress={() => setSort('popular')}
            variant={sort === 'popular' ? 'primary' : 'secondary'}
          />
        </View>
      </View>
      <FlatList
        data={videos}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={
          isLoading ? null : (
            <View style={styles.empty}>
              <AppText>{isSearching ? t('search.empty') : t('feed.empty')}</AppText>
              {isSearching ? <AppText variant="caption">{t('search.hint')}</AppText> : null}
            </View>
          )
        }
        contentContainerStyle={styles.listContent}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  controls: {
    gap: spacing.md,
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  sortRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  listContent: {
    paddingBottom: spacing.xxxl,
  },
  empty: {
    marginTop: spacing.xl,
    gap: spacing.sm,
    alignItems: 'center',
  },
});
