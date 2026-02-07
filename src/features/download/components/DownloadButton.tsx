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
  variant?: 'default' | 'overlay';
  iconOnly?: boolean;
};

export function DownloadButton({
  videoId,
  suggestedName,
  variant = 'default',
  iconOnly = false,
}: DownloadButtonProps) {
  const { t } = useTranslation();
  const { palette } = useTheme();
  const { state, isBusy, onPress } = useVideoDownload(videoId, suggestedName);
  const [confirmVisible, setConfirmVisible] = React.useState(false);
  const isOverlay = variant === 'overlay';

  const progress = Math.max(0, Math.min(100, Math.round(state.progress * 100)));
  const baseColor =
    state.status === 'success'
      ? palette.success
      : state.status === 'error'
        ? palette.error
        : palette.accent;
  const iconColor = iconOnly ? palette.text.primary : palette.onAccent;
  const defaultIconColor = baseColor;
  const buttonStyle = isOverlay
    ? iconOnly
      ? styles.overlayIconButton
      : styles.overlayButton
    : iconOnly
      ? styles.iconButton
      : styles.button;
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
          buttonStyle,
          {
            borderColor: iconOnly
              ? withAlpha(palette.border, 0.85)
              : isOverlay
                ? withAlpha(baseColor, 0.9)
                : withAlpha(baseColor, 0.48),
            backgroundColor: iconOnly
              ? withAlpha(palette.overlay, 0.9)
              : isOverlay
                ? withAlpha(baseColor, 0.9)
                : withAlpha(baseColor, 0.14),
          },
          pressed
            ? [
                styles.pressed,
                {
                  backgroundColor: iconOnly
                    ? withAlpha(palette.overlay, 0.82)
                    : isOverlay
                      ? withAlpha(baseColor, 0.86)
                      : withAlpha(baseColor, 0.22),
                },
              ]
            : null,
        ]}
        accessibilityRole="button"
        accessibilityLabel={t('video.download')}
      >
        {iconOnly ? (
          isBusy ? (
            <ActivityIndicator size="small" color={iconColor} />
          ) : (
            <Ionicons
              name={iconName}
              size={isOverlay ? 24 : 20}
              color={iconColor}
            />
          )
        ) : (
          <View style={isOverlay ? styles.overlayIconWrap : styles.iconWrap}>
            {isBusy ? (
              <ActivityIndicator size="small" color={isOverlay ? palette.onAccent : defaultIconColor} />
            ) : (
              <Ionicons
                name={iconName}
                size={isOverlay ? 18 : 16}
                color={isOverlay ? iconColor : defaultIconColor}
              />
            )}
          </View>
        )}
        {!iconOnly ? (
          <AppText
            variant="caption"
            style={[
              isOverlay ? styles.overlayLabel : styles.label,
              { color: isOverlay ? palette.onAccent : baseColor },
            ]}
          >
            {isBusy ? `${progress}%` : t('video.download')}
          </AppText>
        ) : null}
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
    minHeight: 36,
    minWidth: 112,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    alignSelf: 'flex-start',
  },
  overlayButton: {
    minHeight: 40,
    minWidth: 92,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  iconButton: {
    height: 38,
    width: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  overlayIconButton: {
    height: 50,
    width: 50,
    borderRadius: 25,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrap: {
    width: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 13,
  },
  overlayIconWrap: {
    width: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlayLabel: {
    fontSize: 12,
  },
  pressed: {
    transform: [{ scale: 0.98 }],
  },
});
