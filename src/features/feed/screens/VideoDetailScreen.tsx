import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { VideoPlayer } from '@/src/features/feed/components/VideoPlayer';
import { useCachedVideo } from '@/src/features/feed/hooks/useCachedVideo';
import { useToggleLike } from '@/src/features/feed/hooks/useToggleLike';
import { AppText } from '@/src/shared/components/ui/AppText';
import { Button } from '@/src/shared/components/ui/Button';
import { Screen } from '@/src/shared/components/layout/Screen';
import { spacing } from '@/src/shared/theme/spacing';
import { formatDate, formatCount } from '@/src/shared/utils/formatters';

export function VideoDetailScreen() {
  const { t } = useTranslation();
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
      <VideoPlayer uri={video.url} isActive={true} />
      <View style={styles.meta}>
        <AppText variant="heading2">{video.title ?? t('video.untitled')}</AppText>
        <AppText variant="caption">
          {video.uploader ? `@${video.uploader.username}` : 'Anonymous'} - {formatDate(video.created_at)}
        </AppText>
        <View style={styles.likes}>
          <AppText variant="caption">{t('video.likes')}</AppText>
          <AppText variant="bodyBold">{formatCount(video.like_count)}</AppText>
          {video.is_liked !== undefined ? (
            <Button
              label={video.is_liked ? t('video.unlike') : t('video.like')}
              onPress={() => toggleLike.mutate()}
              disabled={toggleLike.isPending}
              variant={video.is_liked ? 'secondary' : 'primary'}
            />
          ) : null}
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
    gap: spacing.xs,
  },
});
