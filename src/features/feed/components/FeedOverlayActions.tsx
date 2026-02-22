import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import {
  FeedActionId,
  FeedActionLayoutPresetId,
  FeedActionSlot,
  resolveFeedActionLayoutPreset,
} from '@/src/features/feed/config/actionLayout';
import { DownloadButton } from '@/src/features/download/components/DownloadButton';
import { useToggleLike } from '@/src/features/feed/hooks/useToggleLike';
import { ReportVideoButton } from '@/src/features/reports/components/ReportVideoButton';
import { QuickShareButton } from '@/src/features/share/components/QuickShareButton';
import { layoutConfig } from '@/src/shared/config/layoutConfig';
import { AppText } from '@/src/shared/components/ui/AppText';
import { LikeButton } from '@/src/shared/components/ui/LikeButton';
import { withAlpha } from '@/src/shared/theme/colorUtils';
import { useTheme } from '@/src/shared/theme/ThemeProvider';
import { VideoFeedItem } from '@/src/shared/types/api';
import { formatCount } from '@/src/shared/utils/formatters';

type FeedOverlayActionsProps = {
  video: VideoFeedItem;
  muted: boolean;
  onToggleMute: () => void;
  safeAreaTop: number;
  safeAreaBottom: number;
  layoutPresetId?: FeedActionLayoutPresetId;
};

const FEED_PRIMARY_ACTIONS: FeedActionId[] = ['mute', 'like', 'download', 'report', 'shareHub'];

function FeedOverlayActionsBase({
  video,
  muted,
  onToggleMute,
  safeAreaTop,
  safeAreaBottom,
  layoutPresetId,
}: FeedOverlayActionsProps) {
  const { t } = useTranslation();
  const { palette } = useTheme();
  const toggleLike = useToggleLike(video.id);
  const currentLiked = video.is_liked ?? false;
  const layout = React.useMemo(() => resolveFeedActionLayoutPreset(layoutPresetId), [layoutPresetId]);

  const tabBarClearance = React.useMemo(
    () => Math.max(layoutConfig.tabBar.height + layoutConfig.tabBar.paddingBottom, 64),
    [],
  );

  const handleLikePress = React.useCallback(() => {
    toggleLike.mutate({ currentLiked });
  }, [currentLiked, toggleLike]);

  const actionsBySlot = React.useMemo(() => {
    const grouped: Record<FeedActionSlot, FeedActionId[]> = {
      topRight: [],
      rightRail: [],
      bottomRight: [],
    };

    for (const action of FEED_PRIMARY_ACTIONS) {
      grouped[layout.slots[action]].push(action);
    }

    return grouped;
  }, [layout.slots]);

  const topRightTop = safeAreaTop + layout.topRight.topOffset;
  const rightRailBottom = tabBarClearance + safeAreaBottom + layout.rightRail.bottomOffset;
  const bottomRightBottom = tabBarClearance + safeAreaBottom + layout.bottomRight.bottomOffset;

  const zoneScale = (slot: FeedActionSlot): number => {
    if (slot === 'topRight') return layout.topRight.scale;
    if (slot === 'rightRail') return layout.rightRail.scale;
    return layout.bottomRight.scale;
  };

  const renderAction = (action: FeedActionId, slot: FeedActionSlot) => {
    if (action === 'mute') {
      return (
        <View key={action} style={{ transform: [{ scale: zoneScale(slot) }] }}>
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
        </View>
      );
    }

    if (action === 'like') {
      return (
        <View key={action} style={{ transform: [{ scale: zoneScale(slot) }] }}>
          {video.is_liked !== undefined ? (
            <View style={styles.likeGroup}>
              <LikeButton
                liked={currentLiked}
                count={video.like_count}
                onPress={handleLikePress}
                disabled={toggleLike.isPending}
                variant="overlay"
                iconOnly
              />
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
        </View>
      );
    }

    if (action === 'download') {
      return (
        <View key={action} style={{ transform: [{ scale: zoneScale(slot) }] }}>
          <DownloadButton videoId={video.id} suggestedName={video.title} variant="overlay" iconOnly />
        </View>
      );
    }

    if (action === 'report') {
      return (
        <View key={action} style={{ transform: [{ scale: zoneScale(slot) }] }}>
          <ReportVideoButton videoId={video.id} variant="overlay" />
        </View>
      );
    }

    if (action === 'shareHub') {
      return (
        <View key={action} style={{ transform: [{ scale: zoneScale(slot) }] }}>
          <QuickShareButton
            videoId={video.id}
            suggestedName={video.title}
            variant="overlay"
            iconOnly
          />
        </View>
      );
    }

    return null;
  };

  return (
    <View style={styles.overlayRoot} pointerEvents="box-none">
      {actionsBySlot.topRight.length > 0 ? (
        <View
          style={[
            styles.topRightZone,
            {
              top: topRightTop,
              right: layout.topRight.rightOffset,
            },
          ]}
          pointerEvents="box-none"
        >
          {actionsBySlot.topRight.map((action) => renderAction(action, 'topRight'))}
        </View>
      ) : null}

      {actionsBySlot.rightRail.length > 0 ? (
        <View
          style={[
            styles.rightRailZone,
            {
              right: layout.rightRail.rightOffset,
              bottom: rightRailBottom,
              gap: layout.rightRail.gap,
            },
          ]}
          pointerEvents="box-none"
        >
          {actionsBySlot.rightRail.map((action) => renderAction(action, 'rightRail'))}
        </View>
      ) : null}

      {actionsBySlot.bottomRight.length > 0 ? (
        <View
          style={[
            styles.bottomRightZone,
            {
              right: layout.bottomRight.rightOffset,
              bottom: bottomRightBottom,
            },
          ]}
          pointerEvents="box-none"
        >
          {actionsBySlot.bottomRight.map((action) => renderAction(action, 'bottomRight'))}
        </View>
      ) : null}
    </View>
  );
}

function areFeedOverlayActionsPropsEqual(prev: FeedOverlayActionsProps, next: FeedOverlayActionsProps) {
  return (
    prev.muted === next.muted &&
    prev.onToggleMute === next.onToggleMute &&
    prev.safeAreaTop === next.safeAreaTop &&
    prev.safeAreaBottom === next.safeAreaBottom &&
    prev.layoutPresetId === next.layoutPresetId &&
    prev.video.id === next.video.id &&
    prev.video.like_count === next.video.like_count &&
    prev.video.is_liked === next.video.is_liked &&
    prev.video.title === next.video.title &&
    prev.video.url === next.video.url
  );
}

export const FeedOverlayActions = React.memo(FeedOverlayActionsBase, areFeedOverlayActionsPropsEqual);

const styles = StyleSheet.create({
  overlayRoot: {
    ...StyleSheet.absoluteFillObject,
  },
  topRightZone: {
    position: 'absolute',
    alignItems: 'flex-end',
    gap: 6,
  },
  rightRailZone: {
    position: 'absolute',
    width: 48,
    alignItems: 'center',
  },
  bottomRightZone: {
    position: 'absolute',
    alignItems: 'flex-end',
    gap: 6,
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
  pressed: {
    transform: [{ scale: 0.98 }],
  },
});
