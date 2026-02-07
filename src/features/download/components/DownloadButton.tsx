import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useVideoDownload } from '@/src/features/download/hooks/useVideoDownload';
import { AppText } from '@/src/shared/components/ui/AppText';
import { ConfirmModal } from '@/src/shared/components/ui/ConfirmModal';
import { spacing } from '@/src/shared/theme/spacing';
import { useTheme } from '@/src/shared/theme/ThemeProvider';
import { withAlpha } from '@/src/shared/theme/colorUtils';

type DownloadButtonProps = {
  videoId: string;
  suggestedName?: string | null;
};

export function DownloadButton({ videoId, suggestedName }: DownloadButtonProps) {
  const { t } = useTranslation();
  const { palette } = useTheme();
  const { state, isBusy, onPress } = useVideoDownload(videoId, suggestedName);
  const [confirmVisible, setConfirmVisible] = React.useState(false);

  const progress = Math.max(0, Math.min(100, Math.round(state.progress * 100)));
  const iconColor = palette.onAccent;
  const baseColor =
    state.status === 'success'
      ? palette.success
      : state.status === 'error'
        ? palette.error
        : palette.accent;
  const iconName: keyof typeof Ionicons.glyphMap =
    state.status === 'success'
      ? 'checkmark-circle'
      : state.status === 'error'
        ? 'alert-circle'
        : 'download-outline';

  return (
    <>
      <Pressable
        onPress={() => {
          if (isBusy) return;
          setConfirmVisible(true);
        }}
        disabled={isBusy}
        style={({ pressed }) => [
          styles.button,
          {
            borderColor: withAlpha(baseColor, 0.9),
            backgroundColor: baseColor,
          },
          pressed
            ? [
                styles.pressed,
                {
                  backgroundColor: withAlpha(baseColor, 0.86),
                },
              ]
            : null,
        ]}
        accessibilityRole="button"
        accessibilityLabel={t('video.download')}
      >
        <View style={styles.iconWrap}>
          {isBusy ? (
            <ActivityIndicator size="small" color={palette.accent} />
          ) : (
            <Ionicons name={iconName} size={16} color={iconColor} />
          )}
        </View>
        <AppText variant="caption" style={[styles.label, { color: palette.onAccent }]}>
          {isBusy ? `${progress}%` : t('video.download')}
        </AppText>
      </Pressable>
      <ConfirmModal
        visible={confirmVisible}
        title={t('video.downloadConfirmTitle')}
        body={t('video.downloadConfirmBody')}
        confirmLabel={t('video.download')}
        cancelLabel={t('common.cancel')}
        onCancel={() => setConfirmVisible(false)}
        onConfirm={() => {
          setConfirmVisible(false);
          void onPress();
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 38,
    minWidth: 124,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: spacing.xs,
  },
  iconWrap: {
    width: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 12,
  },
  pressed: {
    transform: [{ scale: 0.98 }],
  },
});
