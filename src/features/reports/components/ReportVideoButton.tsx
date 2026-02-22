import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ReportVideoModal } from '@/src/features/reports/components/ReportVideoModal';
import { withAlpha } from '@/src/shared/theme/colorUtils';
import { useTheme } from '@/src/shared/theme/ThemeProvider';

type ReportVideoButtonProps = {
  videoId: string;
  variant?: 'surface' | 'overlay';
};

export function ReportVideoButton({ videoId, variant = 'surface' }: ReportVideoButtonProps) {
  const { t } = useTranslation();
  const { palette } = useTheme();
  const [open, setOpen] = useState(false);
  const isOverlay = variant === 'overlay';
  const iconColor = isOverlay ? palette.text.primary : palette.warning;

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={t('reports.openReport')}
        style={[
          isOverlay ? styles.overlayIconButton : styles.iconButton,
          {
            borderColor: withAlpha(palette.border, 0.85),
            backgroundColor: withAlpha(palette.overlay, 0.9),
          },
          /*
            Keep warning tint only in non-overlay contexts so it still reads as a report action
            while matching button sizing/chrome with other action buttons.
          */
          !isOverlay
            ? {
                borderColor: withAlpha(palette.warning, 0.48),
                backgroundColor: withAlpha(palette.warning, 0.14),
              }
            : null,
        ]}
      >
        <Ionicons name="flag-outline" size={isOverlay ? 24 : 20} color={iconColor} />
      </Pressable>
      <ReportVideoModal
        visible={open}
        videoId={videoId}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  overlayIconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
