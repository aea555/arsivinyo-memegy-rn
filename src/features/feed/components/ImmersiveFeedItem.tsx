import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { FeedInfoPopup } from '@/src/features/feed/components/FeedInfoPopup';
import { FeedOverlayActions } from '@/src/features/feed/components/FeedOverlayActions';
import { VideoPlayer } from '@/src/features/feed/components/VideoPlayer';
import { AppText } from '@/src/shared/components/ui/AppText';
import { withAlpha } from '@/src/shared/theme/colorUtils';
import { spacing } from '@/src/shared/theme/spacing';
import { useTheme } from '@/src/shared/theme/ThemeProvider';
import { VideoFeedItem } from '@/src/shared/types/api';
import { formatDate } from '@/src/shared/utils/formatters';

type ImmersiveFeedItemProps = {
  video: VideoFeedItem;
  isActive: boolean;
  isScreenActive: boolean;
  height: number;
  autoPlayEnabled: boolean;
  resetOnInactive: boolean;
  muted: boolean;
  holdFastForwardRate: number;
  preserveAspectRatio: boolean;
  onVideoEnd?: () => void;
  onToggleMute: () => void;
};

const INFO_AUTO_DISMISS_MS = 2800;

function ImmersiveFeedItemBase({
  video,
  isActive,
  isScreenActive,
  height,
  autoPlayEnabled,
  resetOnInactive,
  muted,
  holdFastForwardRate,
  preserveAspectRatio,
  onVideoEnd,
  onToggleMute,
}: ImmersiveFeedItemProps) {
  const { t } = useTranslation();
  const { palette } = useTheme();
  const [infoVisible, setInfoVisible] = useState(false);

  useEffect(() => {
    if (!isActive && infoVisible) {
      setInfoVisible(false);
    }
  }, [infoVisible, isActive]);

  useEffect(() => {
    if (!infoVisible) return;
    const timer = setTimeout(() => {
      setInfoVisible(false);
    }, INFO_AUTO_DISMISS_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [infoVisible]);

  const uploaderName = video.uploader ? `@${video.uploader.username}` : t('video.anonymous');
  const title = video.title?.trim() || t('video.untitled');
  const description = video.description?.trim() || null;
  const hasPlayableUrl = typeof video.url === 'string' && video.url.length > 0;

  const bottomScrim = useMemo(() => ['transparent', withAlpha('#000000', 0.68)] as const, []);
  const handleToggleInfo = useCallback(() => {
    setInfoVisible((prev) => !prev);
  }, []);

  return (
    <View style={[styles.container, { height }]}>
      {hasPlayableUrl ? (
        <VideoPlayer
          uri={video.url}
          isActive={isActive}
          isScreenActive={isScreenActive}
          variant="immersive"
          height={height}
          contentFit={preserveAspectRatio ? 'contain' : 'cover'}
          showNativeControls={false}
          autoPlayEnabled={autoPlayEnabled}
          allowTapToToggle
          resetOnDeactivate={resetOnInactive}
          muted={muted}
          holdFastForwardRate={holdFastForwardRate}
          onPlaybackEnd={onVideoEnd}
        />
      ) : (
        <View style={[styles.fallback, { backgroundColor: palette.mediaBackground }]}>
          <AppText variant="bodyBold">{t('feed.videoMetaUnavailable')}</AppText>
        </View>
      )}

      <LinearGradient colors={bottomScrim} style={styles.bottomScrim} pointerEvents="none" />

      <View style={styles.overlayRoot} pointerEvents="box-none">
        <View style={styles.bottomRow}>
          <View style={styles.leftMeta}>
            <AppText variant="heading2" style={styles.title} numberOfLines={2}>
              {title}
            </AppText>
            {video.is_nsfw ? (
              <View style={[styles.nsfwBadge, { borderColor: withAlpha(palette.warning, 0.9) }]}>
                <AppText variant="caption" style={{ color: palette.warning }}>
                  {t('video.nsfw')}
                </AppText>
              </View>
            ) : null}
            {description ? (
              <AppText variant="caption" style={styles.subtitle} numberOfLines={2}>
                {description}
              </AppText>
            ) : null}
            <View style={styles.metaStack}>
              <AppText variant="caption" style={styles.metaText} numberOfLines={1}>
                {uploaderName}
              </AppText>
              <AppText variant="caption" style={styles.metaDate} numberOfLines={1}>
                {formatDate(video.created_at)}
              </AppText>
            </View>
            <FeedInfoPopup video={video} visible={infoVisible} />
          </View>
          <FeedOverlayActions
            video={video}
            infoVisible={infoVisible}
            onToggleInfo={handleToggleInfo}
            muted={muted}
            onToggleMute={onToggleMute}
          />
        </View>
      </View>
    </View>
  );
}

function areImmersiveFeedItemPropsEqual(prev: ImmersiveFeedItemProps, next: ImmersiveFeedItemProps) {
  return (
    prev.isActive === next.isActive &&
    prev.isScreenActive === next.isScreenActive &&
    prev.height === next.height &&
    prev.autoPlayEnabled === next.autoPlayEnabled &&
    prev.resetOnInactive === next.resetOnInactive &&
    prev.muted === next.muted &&
    prev.holdFastForwardRate === next.holdFastForwardRate &&
    prev.preserveAspectRatio === next.preserveAspectRatio &&
    prev.onVideoEnd === next.onVideoEnd &&
    prev.onToggleMute === next.onToggleMute &&
    prev.video.id === next.video.id &&
    prev.video.url === next.video.url &&
    prev.video.is_liked === next.video.is_liked &&
    prev.video.like_count === next.video.like_count &&
    prev.video.title === next.video.title &&
    prev.video.description === next.video.description &&
    prev.video.is_nsfw === next.video.is_nsfw &&
    prev.video.created_at === next.video.created_at &&
    prev.video.uploader?.id === next.video.uploader?.id &&
    prev.video.uploader?.username === next.video.uploader?.username
  );
}

export const ImmersiveFeedItem = React.memo(ImmersiveFeedItemBase, areImmersiveFeedItemPropsEqual);

const styles = StyleSheet.create({
  container: {
    width: '100%',
    position: 'relative',
    overflow: 'hidden',
  },
  fallback: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  bottomScrim: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 280,
  },
  overlayRoot: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
  metaText: {
    color: '#FFFFFF',
    opacity: 0.92,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  leftMeta: {
    flex: 1,
    gap: spacing.sm,
    paddingBottom: spacing.sm,
  },
  title: {
    color: '#FFFFFF',
  },
  subtitle: {
    color: '#FFFFFF',
    opacity: 0.9,
  },
  nsfwBadge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: withAlpha('#000000', 0.45),
  },
  metaStack: {
    gap: 2,
    marginTop: spacing.xs,
  },
  metaDate: {
    color: '#FFFFFF',
    opacity: 0.75,
  },
});
