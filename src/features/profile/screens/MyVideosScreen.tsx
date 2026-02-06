import React, { useCallback, useMemo, useRef, useState } from 'react';
import { FlatList, StyleSheet, View, ViewToken } from 'react-native';
import { useTranslation } from 'react-i18next';

import { VideoCard } from '@/src/features/feed/components/VideoCard';
import { useMyVideos } from '@/src/features/profile/hooks/useMyVideos';
import { Screen } from '@/src/shared/components/layout/Screen';
import { AppText } from '@/src/shared/components/ui/AppText';
import { spacing } from '@/src/shared/theme/spacing';
import { VideoFeedItem } from '@/src/shared/types/api';

const viewabilityConfig = {
  itemVisiblePercentThreshold: 70,
};

export function MyVideosScreen() {
  const { t } = useTranslation();
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useMyVideos();
  const [activeId, setActiveId] = useState<string | null>(null);

  const videos = useMemo(() => data?.pages.flatMap((page) => page) ?? [], [data]);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const first = viewableItems[0]?.item as VideoFeedItem | undefined;
      setActiveId(first?.id ?? null);
    }
  ).current;

  const renderItem = useCallback(
    ({ item }: { item: VideoFeedItem }) => <VideoCard video={item} isActive={activeId === item.id} />,
    [activeId]
  );

  const handleEndReached = () => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  };

  return (
    <Screen title={t('tabs.myVideos')} contentStyle={styles.container}>
      <FlatList
        data={videos}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        viewabilityConfig={viewabilityConfig}
        onViewableItemsChanged={onViewableItemsChanged}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={
          isLoading ? null : (
            <View style={styles.empty}>
              <AppText>{t('profile.noVideos')}</AppText>
            </View>
          )
        }
        contentContainerStyle={[styles.listContent, videos.length === 0 ? styles.listEmptyContainer : null]}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
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
    alignItems: 'center',
  },
});
