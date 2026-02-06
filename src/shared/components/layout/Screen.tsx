import React from 'react';
import { SafeAreaView, StyleSheet, ViewProps } from 'react-native';

import { useTheme } from '@/src/shared/theme/ThemeProvider';

export function Screen({ style, ...rest }: ViewProps) {
  const { palette } = useTheme();

  return (
    <SafeAreaView
      style={[styles.base, { backgroundColor: palette.background }, style]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    flex: 1,
  },
});
