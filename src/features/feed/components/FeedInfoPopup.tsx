import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/src/shared/components/ui/AppText';
import { spacing } from '@/src/shared/theme/spacing';
import { useTheme } from '@/src/shared/theme/ThemeProvider';
import { withAlpha } from '@/src/shared/theme/colorUtils';
import { formatDate } from '@/src/shared/utils/formatters';
import { VideoFeedItem } from '@/src/shared/types/api';

type FeedInfoPopupProps = {
  video: VideoFeedItem;
  visible: boolean;
};

export function FeedInfoPopup({ video, visible }: FeedInfoPopupProps) {
  const { t } = useTranslation();
  const { palette } = useTheme();

  if (!visible) return null;

  const uploaderName = video.uploader ? `@${video.uploader.username}` : t('video.anonymous');
  const title = video.title?.trim() || t('video.untitled');
  const description = video.description?.trim();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: withAlpha(palette.overlay, 0.92),
          borderColor: withAlpha(palette.border, 0.9),
        },
      ]}
      pointerEvents="none"
    >
      <AppText variant="caption" style={[styles.meta, { color: palette.text.secondary }]}>
        {t('feed.by', { uploader: uploaderName })} - {formatDate(video.created_at)}
      </AppText>
      <AppText variant="bodyBold" style={styles.title}>
        {title}
      </AppText>
      {description ? (
        <AppText variant="caption" style={styles.description}>
          {description}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
    maxWidth: '90%',
  },
  meta: {
    opacity: 0.9,
  },
  title: {
    lineHeight: 21,
  },
  description: {
    opacity: 0.95,
    lineHeight: 18,
  },
});
