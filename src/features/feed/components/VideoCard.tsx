import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { DownloadButton } from '@/src/features/download/components/DownloadButton';
import { QuickShareButton } from '@/src/features/share/components/QuickShareButton';
import { ShareButton } from '@/src/features/share/components/ShareButton';
import { VideoPlayer } from './VideoPlayer';
import { useToggleLike } from '@/src/features/feed/hooks/useToggleLike';
import { AppText } from '@/src/shared/components/ui/AppText';
import { Card } from '@/src/shared/components/ui/Card';
import { LikeButton } from '@/src/shared/components/ui/LikeButton';
import { spacing } from '@/src/shared/theme/spacing';
import { useTheme } from '@/src/shared/theme/ThemeProvider';
import { formatDate } from '@/src/shared/utils/formatters';
import { VideoFeedItem } from '@/src/shared/types/api';

type VideoCardProps = {
  video: VideoFeedItem;
  isActive: boolean;
  isScreenActive?: boolean;
  showUploader?: boolean;
  showAnonymousBadge?: boolean;
  extraAction?: React.ReactNode;
  renderExtraAction?: (videoId: string) => React.ReactNode;
};

function VideoCardBase({
  video,
  isActive,
  isScreenActive = true,
  showUploader = true,
  showAnonymousBadge = false,
  extraAction,
  renderExtraAction,
}: VideoCardProps) {
  const { t } = useTranslation();
  const { palette } = useTheme();
  const toggleLike = useToggleLike(video.id);
  const showLike = video.is_liked !== undefined;
  const metaLine = showUploader
    ? `${video.uploader ? `@${video.uploader.username}` : t('video.anonymous')} - ${formatDate(video.created_at)}`
    : formatDate(video.created_at);
  const resolvedExtraAction = renderExtraAction
    ? renderExtraAction(video.id)
    : extraAction;

  return (
    <Card style={styles.card}>
      <VideoPlayer
        uri={video.url}
        isActive={isActive}
        isScreenActive={isScreenActive}
        showMinimalControls
      />
      <View style={styles.meta}>
        <View style={styles.metaText}>
          <View style={styles.titleRow}>
            <AppText variant="bodyBold" style={styles.titleText}>
              {video.title ?? t('video.untitled')}
            </AppText>
          </View>
          <AppText variant="caption">{metaLine}</AppText>
          <View style={styles.actionsRow}>
            <DownloadButton videoId={video.id} suggestedName={video.title} iconOnly />
            <QuickShareButton videoId={video.id} suggestedName={video.title} iconOnly />
            <ShareButton url={video.url} title={video.title} iconOnly />
            {resolvedExtraAction}
          </View>
          {showAnonymousBadge ? (
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
        </View>
        <View style={styles.likes}>
          {showLike ? (
            <LikeButton
              liked={video.is_liked ?? false}
              count={video.like_count}
              onPress={() => toggleLike.mutate({ currentLiked: video.is_liked ?? false })}
              disabled={toggleLike.isPending}
            />
          ) : (
            <AppText variant="caption">{video.like_count}</AppText>
          )}
        </View>
      </View>
    </Card>
  );
}

function areVideoCardPropsEqual(prev: VideoCardProps, next: VideoCardProps) {
  return (
    prev.isActive === next.isActive &&
    prev.isScreenActive === next.isScreenActive &&
    prev.showUploader === next.showUploader &&
    prev.showAnonymousBadge === next.showAnonymousBadge &&
    prev.extraAction === next.extraAction &&
    prev.renderExtraAction === next.renderExtraAction &&
    prev.video.id === next.video.id &&
    prev.video.url === next.video.url &&
    prev.video.title === next.video.title &&
    prev.video.description === next.video.description &&
    prev.video.created_at === next.video.created_at &&
    prev.video.is_liked === next.video.is_liked &&
    prev.video.like_count === next.video.like_count &&
    prev.video.uploader?.id === next.video.uploader?.id &&
    prev.video.uploader?.username === next.video.uploader?.username
  );
}

const MemoizedVideoCard = React.memo(VideoCardBase, areVideoCardPropsEqual);

export function VideoCard(props: VideoCardProps) {
  return <MemoizedVideoCard {...props} />;
}

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.lg,
  },
  meta: {
    marginTop: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.lg,
  },
  metaText: {
    flex: 1,
    gap: spacing.xs,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  titleText: {
    flexShrink: 1,
  },
  anonymousBadge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  anonymousBadgeText: {
    fontSize: 11,
  },
  likes: {
    width: 96,
    marginTop: spacing.sm,
    gap: spacing.xs,
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
  },
});
