import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { VideoPlayer } from './VideoPlayer';
import { useToggleLike } from '@/src/features/feed/hooks/useToggleLike';
import { AppText } from '@/src/shared/components/ui/AppText';
import { Card } from '@/src/shared/components/ui/Card';
import { Button } from '@/src/shared/components/ui/Button';
import { spacing } from '@/src/shared/theme/spacing';
import { formatCount, formatDate } from '@/src/shared/utils/formatters';
import { VideoFeedItem } from '@/src/shared/types/api';

type VideoCardProps = {
  video: VideoFeedItem;
  isActive: boolean;
  onPress: () => void;
};

export function VideoCard({ video, isActive, onPress }: VideoCardProps) {
  const { t } = useTranslation();
  const toggleLike = useToggleLike(video.id);
  const showLike = video.is_liked !== undefined;

  return (
    <Card style={styles.card}>
      <Pressable onPress={onPress}>
        <VideoPlayer uri={video.url} isActive={isActive} />
      </Pressable>
      <View style={styles.meta}>
        <View style={styles.metaText}>
          <AppText variant="bodyBold">{video.title ?? t('video.untitled')}</AppText>
          <AppText variant="caption">
            {video.uploader ? `@${video.uploader.username}` : 'Anonymous'} - {formatDate(video.created_at)}
          </AppText>
        </View>
        <View style={styles.likes}>
          <AppText variant="caption">{t('video.likes')}</AppText>
          <AppText variant="bodyBold">{formatCount(video.like_count)}</AppText>
          {showLike ? (
            <Button
              label={video.is_liked ? t('video.unlike') : t('video.like')}
              onPress={() => toggleLike.mutate()}
              disabled={toggleLike.isPending}
              variant={video.is_liked ? 'secondary' : 'primary'}
            />
          ) : null}
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.lg,
  },
  meta: {
    marginTop: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  metaText: {
    flex: 1,
    gap: spacing.xs,
  },
  likes: {
    width: 120,
    gap: spacing.xs,
    alignItems: 'flex-end',
  },
});
