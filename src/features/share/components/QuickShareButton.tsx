import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';

import { useQuickShareVideo } from '@/src/features/share/hooks/useQuickShareVideo';
import { AppText } from '@/src/shared/components/ui/AppText';
import { withAlpha } from '@/src/shared/theme/colorUtils';
import { spacing } from '@/src/shared/theme/spacing';
import { useTheme } from '@/src/shared/theme/ThemeProvider';

type QuickShareButtonProps = {
  videoId: string;
  suggestedName?: string | null;
  variant?: 'default' | 'overlay';
  iconOnly?: boolean;
  onPressStart?: () => void;
};

export function QuickShareButton({
  videoId,
  suggestedName,
  variant = 'default',
  iconOnly = false,
  onPressStart,
}: QuickShareButtonProps) {
  const { t } = useTranslation();
  const { palette } = useTheme();
  const { isBusy, onQuickShare } = useQuickShareVideo(videoId, suggestedName);
  const isOverlay = variant === 'overlay';
  const baseColor = palette.accent;
  const iconColor = iconOnly ? palette.text.primary : isOverlay ? palette.onAccent : baseColor;
  const buttonStyle = isOverlay
    ? iconOnly
      ? styles.overlayIconButton
      : styles.overlayButton
    : iconOnly
      ? styles.iconButton
      : styles.button;

  return (
    <Pressable
      onPress={() => {
        onPressStart?.();
        void onQuickShare();
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
          opacity: isBusy ? 0.85 : 1,
        },
        pressed && !isBusy
          ? [
              styles.pressed,
              {
                backgroundColor: iconOnly
                  ? withAlpha(palette.overlay, 0.82)
                  : isOverlay
                    ? withAlpha(baseColor, 0.84)
                    : withAlpha(baseColor, 0.22),
              },
            ]
          : null,
      ]}
      accessibilityRole="button"
      accessibilityLabel={t('video.quickShare')}
    >
      {iconOnly ? (
        isBusy ? (
          <ActivityIndicator size="small" color={iconColor} />
        ) : (
          <Ionicons
            name="flash-outline"
            size={isOverlay ? 24 : 20}
            color={iconColor}
          />
        )
      ) : (
        <>
          <Ionicons
            name={isBusy ? 'time-outline' : 'flash-outline'}
            size={isOverlay ? 18 : 16}
            color={iconColor}
          />
          <AppText
            variant="caption"
            style={[
              isOverlay ? styles.overlayLabel : styles.label,
              { color: isOverlay ? palette.onAccent : baseColor },
            ]}
          >
            {isBusy ? t('video.quickSharePreparing') : t('video.quickShare')}
          </AppText>
        </>
      )}
    </Pressable>
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
  label: {
    fontSize: 13,
  },
  overlayLabel: {
    fontSize: 12,
  },
  pressed: {
    transform: [{ scale: 0.98 }],
  },
});
