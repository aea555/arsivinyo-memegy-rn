import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AppText } from '@/src/shared/components/ui/AppText';
import { useTheme } from '@/src/shared/theme/ThemeProvider';
import { spacing } from '@/src/shared/theme/spacing';

type SettingsRowProps = {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  right?: React.ReactNode;
  onPress?: () => void;
  showChevron?: boolean;
  isLast?: boolean;
};

export function SettingsRow({
  title,
  subtitle,
  icon,
  right,
  onPress,
  showChevron = true,
  isLast = false,
}: SettingsRowProps) {
  const { palette } = useTheme();
  const rowStyle = [
    styles.row,
    {
      borderBottomColor: palette.border,
      backgroundColor: palette.surface,
      borderBottomWidth: isLast ? 0 : StyleSheet.hairlineWidth,
    },
  ];

  const content = (
    <View style={rowStyle}>
      <View style={styles.left}>
        {icon ? (
          <View style={[styles.icon, { backgroundColor: palette.background, borderColor: palette.border }]}>
            {icon}
          </View>
        ) : null}
        <View style={styles.text}>
          <AppText variant="bodyBold">{title}</AppText>
          {subtitle ? (
            <AppText variant="caption" style={{ color: palette.text.secondary }}>
              {subtitle}
            </AppText>
          ) : null}
        </View>
      </View>
      <View style={styles.right}>
        {right}
        {showChevron ? <Ionicons name="chevron-forward" size={18} color={palette.text.secondary} /> : null}
      </View>
    </View>
  );

  if (!onPress) {
    return <View>{content}</View>;
  }

  return (
    <Pressable onPress={onPress} style={({ pressed, hovered }) => [pressed && styles.pressed, hovered && styles.hovered]}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  text: {
    flex: 1,
    gap: spacing.xs,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  pressed: {
    opacity: 0.95,
    transform: [{ scale: 0.99 }],
  },
  hovered: {
    opacity: 0.98,
  },
});
