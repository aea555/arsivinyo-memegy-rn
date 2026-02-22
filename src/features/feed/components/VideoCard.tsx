import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { DownloadButton } from '@/src/features/download/components/DownloadButton';
import { ReportVideoButton } from '@/src/features/reports/components/ReportVideoButton';
import { QuickShareButton } from '@/src/features/share/components/QuickShareButton';
import { ShareButton } from '@/src/features/share/components/ShareButton';
import { VideoPlayer } from './VideoPlayer';
import { useToggleLike } from '@/src/features/feed/hooks/useToggleLike';
import { AppText } from '@/src/shared/components/ui/AppText';
import { Card } from '@/src/shared/components/ui/Card';
import { LikeButton } from '@/src/shared/components/ui/LikeButton';
import { layoutConfig } from '@/src/shared/config/layoutConfig';
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
  farRightAction?: React.ReactNode;
  renderFarRightAction?: (videoId: string) => React.ReactNode;
};

function VideoCardBase({
  video,
  isActive,
  isScreenActive = true,
  showUploader = true,
  showAnonymousBadge = false,
  extraAction,
  renderExtraAction,
  farRightAction,
  renderFarRightAction,
}: VideoCardProps) {
  const { t } = useTranslation();
  const { palette } = useTheme();
  const toggleLike = useToggleLike(video.id);
  const showLike = video.is_liked !== undefined;
  const metaLine = showUploader
    ? `${video.uploader ? `@${video.uploader.username}` : t('video.anonymous')} - ${formatDate(video.created_at)}`
    : formatDate(video.created_at);
  const showNsfwBadge = Boolean(video.is_nsfw);
  const showInlineNsfwBadge = showNsfwBadge && !showAnonymousBadge;
  const resolvedExtraAction = renderExtraAction
    ? renderExtraAction(video.id)
    : extraAction;
  const resolvedFarRightAction = renderFarRightAction
    ? renderFarRightAction(video.id)
    : farRightAction;

  return (
    <Card style={styles.card}>
      <View style={styles.mediaBleed}>
        <VideoPlayer
        uri={video.url}
        isActive={isActive}
        isScreenActive={isScreenActive}
        flatBottomCorners
        showMinimalControls
      />
      </View>
      <View style={styles.meta}>
        <View style={styles.metaTopRow}>
          <View style={styles.metaText}>
            <View style={styles.titleRow}>
              <AppText variant="bodyBold" style={styles.titleText}>
                {video.title ?? t('video.untitled')}
              </AppText>
              {showInlineNsfwBadge ? (
                <View
                  style={[
                    styles.metaBadge,
                    {
                      borderColor: palette.warning,
                      backgroundColor: palette.background,
                    },
                  ]}
                >
                  <AppText variant="caption" style={[styles.metaBadgeText, { color: palette.warning }]}>
                    {t('video.nsfw')}
                  </AppText>
                </View>
              ) : null}
            </View>
            <AppText variant="caption">{metaLine}</AppText>
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
        <View style={styles.actionsRow}>
          <View style={styles.actionsLeft}>
            <DownloadButton videoId={video.id} suggestedName={video.title} iconOnly />
            <QuickShareButton videoId={video.id} suggestedName={video.title} iconOnly />
            <ShareButton url={video.url} title={video.title} iconOnly />
            <ReportVideoButton videoId={video.id} />
            {resolvedExtraAction}
          </View>
          {resolvedFarRightAction ? (
            <View style={styles.actionsRight}>{resolvedFarRightAction}</View>
          ) : null}
        </View>
        {showAnonymousBadge ? (
          <View style={styles.metaBadgesRow}>
            <View
              style={[
                styles.metaBadge,
                {
                  borderColor: palette.border,
                  backgroundColor: palette.background,
                },
              ]}
            >
              <AppText variant="caption" style={styles.metaBadgeText}>
                {t('video.anonymous')}
              </AppText>
            </View>
            {showNsfwBadge ? (
              <View
                style={[
                  styles.metaBadge,
                  {
                    borderColor: palette.warning,
                    backgroundColor: palette.background,
                  },
                ]}
              >
                <AppText variant="caption" style={[styles.metaBadgeText, { color: palette.warning }]}>
                  {t('video.nsfw')}
                </AppText>
              </View>
            ) : null}
          </View>
        ) : null}
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
    prev.farRightAction === next.farRightAction &&
    prev.renderFarRightAction === next.renderFarRightAction &&
    prev.video.id === next.video.id &&
    prev.video.url === next.video.url &&
    prev.video.title === next.video.title &&
    prev.video.description === next.video.description &&
    prev.video.is_nsfw === next.video.is_nsfw &&
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
  mediaBleed: {
    marginTop: -layoutConfig.card.padding,
    marginLeft: -layoutConfig.card.padding,
    marginRight: -layoutConfig.card.padding,
  },
  meta: {
    marginTop: spacing.md,
    gap: spacing.xs,
  },
  metaTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.lg,
  },
  metaText: {
    flex: 1,
    gap: 2,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
    width: '100%',
  },
  actionsLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  actionsRight: {
    marginLeft: spacing.sm,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  titleText: {
    flexShrink: 1,
  },
  metaBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
  },
  metaBadge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  metaBadgeText: {
    fontSize: 11,
  },
  likes: {
    width: 96,
    gap: spacing.xs,
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
  },
});
