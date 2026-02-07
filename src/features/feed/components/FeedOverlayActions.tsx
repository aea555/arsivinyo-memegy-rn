import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { DownloadButton } from '@/src/features/download/components/DownloadButton';
import { useToggleLike } from '@/src/features/feed/hooks/useToggleLike';
import { AppText } from '@/src/shared/components/ui/AppText';
import { LikeButton } from '@/src/shared/components/ui/LikeButton';
import { withAlpha } from '@/src/shared/theme/colorUtils';
import { spacing } from '@/src/shared/theme/spacing';
import { useTheme } from '@/src/shared/theme/ThemeProvider';
import { VideoFeedItem } from '@/src/shared/types/api';

type FeedOverlayActionsProps = {
  video: VideoFeedItem;
  onToggleInfo: () => void;
  infoVisible: boolean;
};

export function FeedOverlayActions({ video, onToggleInfo, infoVisible }: FeedOverlayActionsProps) {
  const { t } = useTranslation();
  const { palette } = useTheme();
  const toggleLike = useToggleLike(video.id);

  return (
    <View style={styles.container} pointerEvents="box-none">
      {video.is_liked !== undefined ? (
        <LikeButton
          liked={video.is_liked ?? false}
          count={video.like_count}
          onPress={() => toggleLike.mutate({ currentLiked: video.is_liked ?? false })}
          disabled={toggleLike.isPending}
          variant="overlay"
        />
      ) : (
        <View style={[styles.counterFallback, { backgroundColor: withAlpha(palette.overlay, 0.9) }]}>
          <Ionicons name="heart-outline" size={18} color={palette.text.secondary} />
          <AppText variant="caption">{video.like_count}</AppText>
        </View>
      )}
      <DownloadButton videoId={video.id} suggestedName={video.title} variant="overlay" />
      <Pressable
        onPress={onToggleInfo}
        style={({ pressed }) => [
          styles.infoButton,
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
        <Ionicons name="information-circle-outline" size={17} color={infoVisible ? palette.onAccent : palette.text.primary} />
        <AppText
          variant="caption"
          style={{ color: infoVisible ? palette.onAccent : palette.text.primary }}
        >
          {infoVisible ? t('feed.hideInfo') : t('feed.info')}
        </AppText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 106,
    alignItems: 'stretch',
    gap: spacing.sm,
  },
  counterFallback: {
    minHeight: 40,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  infoButton: {
    minHeight: 40,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  pressed: {
    transform: [{ scale: 0.98 }],
  },
});
