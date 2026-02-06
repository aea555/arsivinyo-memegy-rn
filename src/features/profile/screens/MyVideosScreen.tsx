import React, { useCallback, useMemo } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { VideoCard } from '@/src/features/feed/components/VideoCard';
import { useMyVideos } from '@/src/features/profile/hooks/useMyVideos';
import { Screen } from '@/src/shared/components/layout/Screen';
import { AppText } from '@/src/shared/components/ui/AppText';
import { spacing } from '@/src/shared/theme/spacing';
import { VideoFeedItem } from '@/src/shared/types/api';

export function MyVideosScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useMyVideos();

  const videos = useMemo(() => data?.pages.flatMap((page) => page) ?? [], [data]);

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
    <Screen title={t('tabs.myVideos')} contentStyle={styles.container}>
      <FlatList
        data={videos}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
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
