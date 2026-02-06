import React, { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, View, ViewToken } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';

import { VideoCard } from '@/src/features/feed/components/VideoCard';
import { useFeed } from '@/src/features/feed/hooks/useFeed';
import { AppText } from '@/src/shared/components/ui/AppText';
import { Button } from '@/src/shared/components/ui/Button';
import { Screen } from '@/src/shared/components/layout/Screen';
import { useNetworkStatus } from '@/src/shared/hooks/useNetworkStatus';
import { spacing } from '@/src/shared/theme/spacing';
import { VideoFeedItem } from '@/src/shared/types/api';

const viewabilityConfig = {
  itemVisiblePercentThreshold: 70,
};

export function FeedScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { isConnected } = useNetworkStatus();
  const [sort, setSort] = useState<'random' | 'latest' | 'popular'>('random');
  const [activeId, setActiveId] = useState<string | null>(null);

  const { data, isFetchingNextPage, fetchNextPage, hasNextPage, isLoading, refetch } = useFeed(sort);

  const videos = useMemo(() => data?.pages.flatMap((page) => page) ?? [], [data]);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const first = viewableItems[0]?.item as VideoFeedItem | undefined;
      setActiveId(first?.id ?? null);
    }
  ).current;

  const renderItem = useCallback(
    ({ item }: { item: VideoFeedItem }) => (
      <VideoCard
        video={item}
        isActive={activeId === item.id}
        onPress={() => router.push(`/video/${item.id}`)}
      />
    ),
    [activeId, router]
  );

  const keyExtractor = useCallback((item: VideoFeedItem) => item.id, []);

  const handleEndReached = () => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  };

  return (
    <Screen style={styles.container}>
      {!isConnected ? (
        <View style={styles.offline}>
          <AppText variant="caption">{t('common.offline')}</AppText>
        </View>
      ) : null}
      <View style={styles.header}>
        <AppText variant="heading2">{t('tabs.feed')}</AppText>
        <View style={styles.sortRow}>
          <Button label={t('feed.sortRandom')} onPress={() => setSort('random')} variant={sort === 'random' ? 'primary' : 'secondary'} />
          <Button label={t('feed.sortLatest')} onPress={() => setSort('latest')} variant={sort === 'latest' ? 'primary' : 'secondary'} />
          <Button label={t('feed.sortPopular')} onPress={() => setSort('popular')} variant={sort === 'popular' ? 'primary' : 'secondary'} />
        </View>
      </View>
      <FlatList
        data={videos}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.5}
        viewabilityConfig={viewabilityConfig}
        onViewableItemsChanged={onViewableItemsChanged}
        ListEmptyComponent={
          isLoading ? null : (
            <View style={styles.empty}>
              <AppText>{t('feed.empty')}</AppText>
              <Button label={t('common.retry')} onPress={() => refetch()} variant="secondary" />
            </View>
          )
        }
        ListFooterComponent={
          isFetchingNextPage ? (
            <View style={styles.footer}>
              <ActivityIndicator />
            </View>
          ) : null
        }
        contentContainerStyle={styles.listContent}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.lg,
  },
  header: {
    marginTop: spacing.lg,
    marginBottom: spacing.md,
    gap: spacing.md,
  },
  sortRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  listContent: {
    paddingBottom: spacing.xxxl,
  },
  footer: {
    paddingVertical: spacing.md,
  },
  empty: {
    marginTop: spacing.xl,
    gap: spacing.md,
    alignItems: 'center',
  },
  offline: {
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
});
