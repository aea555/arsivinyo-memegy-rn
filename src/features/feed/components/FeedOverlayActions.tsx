import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { DownloadButton } from '@/src/features/download/components/DownloadButton';
import { useToggleLike } from '@/src/features/feed/hooks/useToggleLike';
import { QuickShareButton } from '@/src/features/share/components/QuickShareButton';
import { ShareButton } from '@/src/features/share/components/ShareButton';
import { AppText } from '@/src/shared/components/ui/AppText';
import { LikeButton } from '@/src/shared/components/ui/LikeButton';
import { withAlpha } from '@/src/shared/theme/colorUtils';
import { spacing } from '@/src/shared/theme/spacing';
import { useTheme } from '@/src/shared/theme/ThemeProvider';
import { VideoFeedItem } from '@/src/shared/types/api';
import { formatCount } from '@/src/shared/utils/formatters';

type FeedOverlayActionsProps = {
  video: VideoFeedItem;
  onToggleInfo: () => void;
  infoVisible: boolean;
  muted: boolean;
  onToggleMute: () => void;
};

function FeedOverlayActionsBase({
  video,
  onToggleInfo,
  infoVisible,
  muted,
  onToggleMute,
}: FeedOverlayActionsProps) {
  const { t } = useTranslation();
  const { palette } = useTheme();
  const toggleLike = useToggleLike(video.id);
  const currentLiked = video.is_liked ?? false;
  const handleLikePress = React.useCallback(() => {
    toggleLike.mutate({ currentLiked });
  }, [currentLiked, toggleLike]);

  return (
    <View style={styles.container} pointerEvents="box-none">
      <Pressable
        onPress={onToggleMute}
        style={({ pressed }) => [
          styles.iconButton,
          {
            backgroundColor: withAlpha(palette.overlay, 0.9),
            borderColor: withAlpha(palette.border, 0.85),
          },
          pressed ? styles.pressed : null,
        ]}
        accessibilityRole="button"
        accessibilityLabel={muted ? t('feed.unmute') : t('feed.mute')}
      >
        <Ionicons
          name={muted ? 'volume-mute-outline' : 'volume-high-outline'}
          size={20}
          color={palette.text.primary}
        />
      </Pressable>
      {video.is_liked !== undefined ? (
        <View style={styles.likeGroup}>
          <View style={styles.scaledActionWrap}>
            <LikeButton
              liked={currentLiked}
              count={video.like_count}
              onPress={handleLikePress}
              disabled={toggleLike.isPending}
              variant="overlay"
              iconOnly
            />
          </View>
          <View
            style={[
              styles.likeCountBadge,
              {
                backgroundColor: withAlpha('#000000', 0.58),
                borderColor: withAlpha(palette.border, 0.74),
              },
            ]}
          >
            <AppText variant="caption" style={[styles.likeCount, { color: '#FFFFFF' }]}>
              {formatCount(video.like_count)}
            </AppText>
          </View>
        </View>
      ) : (
        <View style={styles.likeGroup}>
          <View
            style={[
              styles.counterFallback,
              {
                backgroundColor: withAlpha(palette.overlay, 0.9),
                borderColor: withAlpha(palette.border, 0.85),
              },
            ]}
          >
            <Ionicons name="heart-outline" size={24} color={palette.text.secondary} />
          </View>
          <View
            style={[
              styles.likeCountBadge,
              {
                backgroundColor: withAlpha('#000000', 0.58),
                borderColor: withAlpha(palette.border, 0.74),
              },
            ]}
          >
            <AppText variant="caption" style={[styles.likeCount, { color: '#FFFFFF' }]}>
              {formatCount(video.like_count)}
            </AppText>
          </View>
        </View>
      )}
      <View style={styles.scaledActionWrap}>
        <DownloadButton videoId={video.id} suggestedName={video.title} variant="overlay" iconOnly />
      </View>
      <View style={styles.scaledActionWrap}>
        <QuickShareButton videoId={video.id} suggestedName={video.title} variant="overlay" iconOnly />
      </View>
      <View style={styles.scaledActionWrap}>
        <ShareButton url={video.url} title={video.title} variant="overlay" iconOnly />
      </View>
      <Pressable
        onPress={onToggleInfo}
        style={({ pressed }) => [
          styles.iconButton,
          {
            backgroundColor: infoVisible
              ? withAlpha(palette.accent, 0.9)
              : withAlpha(palette.overlay, 0.9),
            borderColor: infoVisible ? withAlpha(palette.accent, 0.96) : withAlpha(palette.border, 0.85),
          },
          pressed ? styles.pressed : null,
        ]}
        accessibilityRole="button"
        accessibilityLabel={infoVisible ? t('feed.hideInfo') : t('feed.info')}
      >
        <Ionicons
          name="information-circle-outline"
          size={20}
          color={infoVisible ? palette.onAccent : palette.text.primary}
        />
      </Pressable>
    </View>
  );
}

function areFeedOverlayActionsPropsEqual(prev: FeedOverlayActionsProps, next: FeedOverlayActionsProps) {
  return (
    prev.infoVisible === next.infoVisible &&
    prev.onToggleInfo === next.onToggleInfo &&
    prev.muted === next.muted &&
    prev.onToggleMute === next.onToggleMute &&
    prev.video.id === next.video.id &&
    prev.video.like_count === next.video.like_count &&
    prev.video.is_liked === next.video.is_liked &&
    prev.video.title === next.video.title
  );
}

export const FeedOverlayActions = React.memo(FeedOverlayActionsBase, areFeedOverlayActionsPropsEqual);

const styles = StyleSheet.create({
  container: {
    width: 48,
    alignItems: 'center',
    gap: spacing.xs,
  },
  counterFallback: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  likeGroup: {
    alignItems: 'center',
    gap: 3,
  },
  likeCountBadge: {
    minWidth: 30,
    minHeight: 18,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  likeCount: {
    textAlign: 'center',
    minWidth: 0,
    opacity: 0.98,
    textShadowColor: 'rgba(0, 0, 0, 0.72)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scaledActionWrap: {
    transform: [{ scale: 0.88 }],
  },
  pressed: {
    transform: [{ scale: 0.98 }],
  },
});
