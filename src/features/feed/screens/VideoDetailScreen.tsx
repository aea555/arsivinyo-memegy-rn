import { useIsFocused } from '@react-navigation/native';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { VideoPlayer } from '@/src/features/feed/components/VideoPlayer';
import { useCachedVideo } from '@/src/features/feed/hooks/useCachedVideo';
import { useToggleLike } from '@/src/features/feed/hooks/useToggleLike';
import { AppText } from '@/src/shared/components/ui/AppText';
import { LikeButton } from '@/src/shared/components/ui/LikeButton';
import { Screen } from '@/src/shared/components/layout/Screen';
import { spacing } from '@/src/shared/theme/spacing';
import { formatDate } from '@/src/shared/utils/formatters';

export function VideoDetailScreen() {
  const { t } = useTranslation();
  const isFocused = useIsFocused();
  const params = useLocalSearchParams();
  const videoId = Array.isArray(params.id) ? params.id[0] : params.id;
  const video = useCachedVideo(videoId);

  const toggleLike = useToggleLike(videoId ?? '');

  if (!video || !videoId) {
    return (
      <Screen title={t('video.title')} showBack contentStyle={styles.container}>
        <AppText variant="heading2">{t('video.noDetails')}</AppText>
      </Screen>
    );
  }

  return (
    <Screen title={video.title ?? t('video.title')} showBack contentStyle={styles.container}>
      <VideoPlayer uri={video.url} isActive={isFocused} isScreenActive={isFocused} />
      <View style={styles.meta}>
        <AppText variant="heading2">{video.title ?? t('video.untitled')}</AppText>
        <AppText variant="caption">
          {video.uploader ? `@${video.uploader.username}` : t('video.anonymous')} - {formatDate(video.created_at)}
        </AppText>
        <View style={styles.likes}>
          {video.is_liked !== undefined ? (
            <LikeButton
              liked={video.is_liked}
              count={video.like_count}
              onPress={() => toggleLike.mutate({ currentLiked: video.is_liked ?? false })}
              disabled={toggleLike.isPending}
            />
          ) : (
            <AppText variant="caption">{video.like_count}</AppText>
          )}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  meta: {
    gap: spacing.sm,
  },
  likes: {
    marginTop: spacing.md,
    alignItems: 'flex-start',
  },
});
