import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { shadows } from '@/src/shared/theme/shadows';
import { useTheme } from '@/src/shared/theme/ThemeProvider';
import { typography } from '@/src/shared/theme/typography';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';

type ButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: ButtonVariant;
  style?: any;
};

export function Button({ label, onPress, disabled, variant = 'primary', style }: ButtonProps) {
  const { palette } = useTheme();

  const backgroundColor =
    variant === 'primary'
      ? palette.accent
      : variant === 'danger'
        ? palette.error
        : variant === 'secondary'
          ? palette.surface
          : variant === 'outline'
            ? 'transparent'
            : 'transparent';

  const borderColor =
    variant === 'secondary' || variant === 'outline'
      ? palette.border
      : variant === 'ghost'
        ? palette.border
        : 'transparent';

  const textColor =
    variant === 'primary' || variant === 'danger' ? '#FFFFFF' : palette.text.primary;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed, hovered }) => [
        styles.base,
        {
          backgroundColor,
          borderColor,
          opacity: disabled ? 0.5 : 1,
          transform: pressed ? [{ scale: 0.98 }] : [{ scale: 1 }],
        },
        variant === 'primary' ? shadows.medium : shadows.subtle,
        hovered && !disabled ? styles.hovered : null,
        style,
      ]}
    >
      <Text style={[styles.label, { color: textColor }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hovered: {
    opacity: 0.95,
  },
  label: {
    ...typography.bodyBold,
  },
});
