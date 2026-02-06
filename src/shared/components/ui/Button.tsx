import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { useTheme } from '@/src/shared/theme/ThemeProvider';
import { typography } from '@/src/shared/theme/typography';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

type ButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: ButtonVariant;
};

export function Button({ label, onPress, disabled, variant = 'primary' }: ButtonProps) {
  const { palette } = useTheme();

  const backgroundColor =
    variant === 'primary'
      ? palette.accent
      : variant === 'danger'
      ? palette.error
      : variant === 'secondary'
      ? palette.surface
      : 'transparent';

  const borderColor =
    variant === 'secondary' ? palette.border : variant === 'ghost' ? palette.border : 'transparent';

  const textColor =
    variant === 'primary' || variant === 'danger' ? '#FFFFFF' : palette.text.primary;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor,
          borderColor,
          opacity: disabled ? 0.5 : pressed ? 0.9 : 1,
        },
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
  label: {
    ...typography.bodyBold,
  },
});
