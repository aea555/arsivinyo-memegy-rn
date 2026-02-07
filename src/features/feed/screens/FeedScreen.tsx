import { useIsFocused } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, View, ViewToken } from 'react-native';
import { useTranslation } from 'react-i18next';

import { VideoCard } from '@/src/features/feed/components/VideoCard';
import { useFeed } from '@/src/features/feed/hooks/useFeed';
import { AppText } from '@/src/shared/components/ui/AppText';
import { Button } from '@/src/shared/components/ui/Button';
import { Card } from '@/src/shared/components/ui/Card';
import { SegmentedControl } from '@/src/shared/components/ui/SegmentedControl';
import { Screen } from '@/src/shared/components/layout/Screen';
import { useNetworkStatus } from '@/src/shared/hooks/useNetworkStatus';
import { spacing } from '@/src/shared/theme/spacing';
import { VideoFeedItem } from '@/src/shared/types/api';

const viewabilityConfig = {
  itemVisiblePercentThreshold: 70,
};

export function FeedScreen() {
  const { t } = useTranslation();
  const isFocused = useIsFocused();
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
      <VideoCard video={item} isActive={activeId === item.id} isScreenActive={isFocused} />
    ),
    [activeId, isFocused]
  );

  useEffect(() => {
    if (!isFocused) {
      setActiveId(null);
    }
  }, [isFocused]);

  const keyExtractor = useCallback((item: VideoFeedItem) => item.id, []);

  const handleEndReached = () => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  };

  const isEmpty = !isLoading && videos.length === 0;

  return (
    <Screen title={t('tabs.feed')} contentStyle={styles.container}>
      {!isConnected ? (
        <View style={styles.offline}>
          <AppText variant="caption">{t('common.offline')}</AppText>
        </View>
      ) : null}
      <View style={styles.header}>
        <Card style={styles.headerCard}>
          <AppText variant="bodyBold">{t('feed.sort')}</AppText>
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
        contentContainerStyle={[styles.listContent, isEmpty ? styles.listEmptyContainer : null]}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  header: {
    marginBottom: spacing.md,
    gap: spacing.md,
  },
  headerCard: {
    gap: spacing.md,
  },
  listContent: {
    paddingBottom: spacing.xxxl,
    flexGrow: 1,
  },
  listEmptyContainer: {
    justifyContent: 'center',
  },
  footer: {
    paddingVertical: spacing.md,
  },
  empty: {
    gap: spacing.md,
    alignItems: 'center',
  },
  offline: {
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
});
