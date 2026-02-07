import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { FeedInfoPopup } from '@/src/features/feed/components/FeedInfoPopup';
import { FeedOverlayActions } from '@/src/features/feed/components/FeedOverlayActions';
import { VideoPlayer } from '@/src/features/feed/components/VideoPlayer';
import { AppText } from '@/src/shared/components/ui/AppText';
import { withAlpha } from '@/src/shared/theme/colorUtils';
import { spacing } from '@/src/shared/theme/spacing';
import { useTheme } from '@/src/shared/theme/ThemeProvider';
import { formatDate } from '@/src/shared/utils/formatters';
import { VideoFeedItem } from '@/src/shared/types/api';

type ImmersiveFeedItemProps = {
  video: VideoFeedItem;
  isActive: boolean;
  isScreenActive: boolean;
  height: number;
  autoPlayEnabled: boolean;
  preserveAspectRatio: boolean;
};

const INFO_AUTO_DISMISS_MS = 2800;

function ImmersiveFeedItemBase({
  video,
  isActive,
  isScreenActive,
  height,
  autoPlayEnabled,
  preserveAspectRatio,
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
  const hasPlayableUrl = typeof video.url === 'string' && video.url.length > 0;

  const topScrim = useMemo(() => [withAlpha('#000000', 0.46), 'transparent'] as const, []);
  const bottomScrim = useMemo(() => ['transparent', withAlpha('#000000', 0.68)] as const, []);

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
        />
      ) : (
        <View style={[styles.fallback, { backgroundColor: palette.mediaBackground }]}>
          <AppText variant="bodyBold">{t('feed.videoMetaUnavailable')}</AppText>
        </View>
      )}

      <LinearGradient colors={topScrim} style={styles.topScrim} pointerEvents="none" />
      <LinearGradient colors={bottomScrim} style={styles.bottomScrim} pointerEvents="none" />

      <View style={styles.overlayRoot} pointerEvents="box-none">
        <View style={styles.topMeta}>
          <AppText variant="caption" style={styles.metaText}>
            {uploaderName} - {formatDate(video.created_at)}
          </AppText>
        </View>

        <View style={styles.bottomRow}>
          <View style={styles.leftMeta}>
            <AppText variant="heading2" style={styles.title} numberOfLines={2}>
              {title}
            </AppText>
            <AppText variant="caption" style={styles.subtitle} numberOfLines={2}>
              {video.description?.trim() || uploaderName}
            </AppText>
            <FeedInfoPopup video={video} visible={infoVisible} />
          </View>
          <FeedOverlayActions
            video={video}
            infoVisible={infoVisible}
            onToggleInfo={() => setInfoVisible((prev) => !prev)}
          />
        </View>
      </View>
    </View>
  );
}

export const ImmersiveFeedItem = React.memo(ImmersiveFeedItemBase);

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
  topScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 150,
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
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
  topMeta: {
    alignItems: 'flex-start',
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
});
