import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, Share, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/src/shared/components/ui/AppText';
import { spacing } from '@/src/shared/theme/spacing';
import { useTheme } from '@/src/shared/theme/ThemeProvider';
import { withAlpha } from '@/src/shared/theme/colorUtils';
import { useToastStore } from '@/src/store/toastStore';

type ShareButtonProps = {
  url: string;
  title?: string | null;
  variant?: 'default' | 'overlay';
  iconOnly?: boolean;
};

export function ShareButton({ url, title, variant = 'default', iconOnly = false }: ShareButtonProps) {
  const { t } = useTranslation();
  const { palette } = useTheme();
  const showToast = useToastStore((state) => state.showToast);
  const isOverlay = variant === 'overlay';
  const baseColor = palette.accent;
  const buttonStyle = isOverlay
    ? iconOnly
      ? styles.overlayIconButton
      : styles.overlayButton
    : iconOnly
      ? styles.iconButton
      : styles.button;

  const onPress = React.useCallback(async () => {
    if (!url) {
      showToast(t('video.shareUnavailable'), 'error');
      return;
    }
    try {
      await Share.share({
        message: url,
        url,
        title: title ?? t('video.untitled'),
      });
    } catch {
      showToast(t('video.shareFailed'), 'error');
    }
  }, [showToast, t, title, url]);

  return (
    <Pressable
      onPress={() => void onPress()}
      style={({ pressed }) => [
        buttonStyle,
        {
          borderColor: isOverlay ? withAlpha(baseColor, 0.9) : withAlpha(baseColor, 0.48),
          backgroundColor: isOverlay ? withAlpha(baseColor, 0.9) : withAlpha(baseColor, 0.14),
        },
        pressed
          ? [
              styles.pressed,
              {
                backgroundColor: isOverlay
                  ? withAlpha(baseColor, 0.84)
                  : withAlpha(baseColor, 0.22),
              },
            ]
          : null,
      ]}
      accessibilityRole="button"
      accessibilityLabel={t('video.share')}
    >
      {iconOnly ? (
        <Ionicons
          name="share-social-outline"
          size={isOverlay ? 24 : 20}
          color={isOverlay ? palette.onAccent : baseColor}
        />
      ) : (
        <View style={isOverlay ? styles.overlayIconWrap : styles.iconWrap}>
          <Ionicons
            name="share-social-outline"
            size={isOverlay ? 18 : 16}
            color={isOverlay ? palette.onAccent : baseColor}
          />
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
          {t('video.share')}
        </AppText>
      ) : null}
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
