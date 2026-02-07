import { useIsFocused } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, StyleSheet, View, ViewToken } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';

import { VideoCard } from '@/src/features/feed/components/VideoCard';
import { useMyVideos } from '@/src/features/profile/hooks/useMyVideos';
import { Screen } from '@/src/shared/components/layout/Screen';
import { AppText } from '@/src/shared/components/ui/AppText';
import { Button } from '@/src/shared/components/ui/Button';
import { Card } from '@/src/shared/components/ui/Card';
import { spacing } from '@/src/shared/theme/spacing';
import { useTheme } from '@/src/shared/theme/ThemeProvider';
import { MyVideoItem, VideoFeedItem } from '@/src/shared/types/api';
import { formatDate } from '@/src/shared/utils/formatters';

const viewabilityConfig = {
  itemVisiblePercentThreshold: 70,
};

export function MyVideosScreen() {
  const { t } = useTranslation();
  const isFocused = useIsFocused();
  const { palette } = useTheme();
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, refetch } = useMyVideos();
  const [activeId, setActiveId] = useState<string | null>(null);

  const videos = useMemo(() => data?.pages.flatMap((page) => page) ?? [], [data]);

  const isPlayable = useCallback(
    (item: MyVideoItem) => item.status === 'PUBLISHED' && typeof item.url === 'string' && item.url.length > 0,
    []
  );

  const toFeedItem = useCallback(
    (item: MyVideoItem): VideoFeedItem => ({
      id: item.id,
      title: item.title,
      description: item.description,
      url: item.url as string,
      like_count: item.like_count,
      created_at: item.created_at,
      is_liked: item.is_liked,
      uploader: item.uploader,
    }),
    []
  );

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const firstPlayable = viewableItems
        .map((token) => token.item as MyVideoItem | undefined)
        .find((item) => item && isPlayable(item));
      setActiveId(firstPlayable?.id ?? null);
    }
  ).current;

  const renderItem = useCallback(
    ({ item }: { item: MyVideoItem }) => {
      if (isPlayable(item)) {
        return (
          <VideoCard
            video={toFeedItem(item)}
            isActive={activeId === item.id}
            isScreenActive={isFocused}
            showUploader={false}
            showAnonymousBadge={item.is_anonymous}
          />
        );
      }

      const statusIcon: keyof typeof Ionicons.glyphMap =
        item.status === 'DRAFT'
          ? 'document-text-outline'
          : item.status === 'PROCESSING'
            ? 'time-outline'
            : item.status === 'FAILED'
              ? 'alert-circle-outline'
              : 'videocam-off-outline';

      const statusText =
        item.status === 'DRAFT'
          ? t('profile.videoStatusDraft')
          : item.status === 'PROCESSING'
            ? t('profile.videoStatusProcessing')
            : item.status === 'FAILED'
              ? t('profile.videoStatusFailed')
              : t('profile.videoStatusUnavailable');

      return (
        <Card style={styles.statusCard}>
          <View style={styles.statusHeader}>
            <View style={styles.statusTitleRow}>
              <AppText variant="bodyBold" style={styles.statusTitleText}>
                {item.title ?? t('video.untitled')}
              </AppText>
            </View>
            <Ionicons name={statusIcon} size={18} color={item.status === 'FAILED' ? palette.error : palette.text.secondary} />
          </View>
          <AppText variant="caption">{formatDate(item.created_at)}</AppText>
          {item.is_anonymous ? (
            <View
              style={[
                styles.anonymousBadge,
                {
                  borderColor: palette.border,
                  backgroundColor: palette.background,
                },
              ]}
            >
              <AppText variant="caption" style={styles.anonymousBadgeText}>
                {t('video.anonymous')}
              </AppText>
            </View>
          ) : null}
          <AppText variant="caption" style={styles.statusText}>
            {statusText}
          </AppText>
          {item.status === 'FAILED' ? (
            <Button label={t('common.retry')} variant="outline" onPress={() => refetch()} style={styles.retryButton} />
          ) : null}
        </Card>
      );
    },
    [
      activeId,
      isFocused,
      isPlayable,
      palette.background,
      palette.border,
      palette.error,
      palette.text.secondary,
      refetch,
      t,
      toFeedItem,
    ]
  );

  useEffect(() => {
    if (!isFocused) {
      setActiveId(null);
    }
  }, [isFocused]);

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
  statusCard: {
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  statusTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: spacing.xs,
  },
  statusTitleText: {
    flexShrink: 1,
  },
  anonymousBadge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  anonymousBadgeText: {
    fontSize: 11,
  },
  statusText: {
    opacity: 0.85,
  },
  retryButton: {
    marginTop: spacing.xs,
    alignSelf: 'flex-start',
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
