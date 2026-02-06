import React from 'react';
import { StyleSheet, View, ViewProps } from 'react-native';

import { useTheme } from '@/src/shared/theme/ThemeProvider';

export function Card({ style, ...rest }: ViewProps) {
  const { palette } = useTheme();

  return (
    <View
      style={[
        styles.base,
        {
          backgroundColor: palette.surface,
          borderColor: palette.border,
        },
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
});
