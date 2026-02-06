import React from 'react';
import { StyleSheet, Text, TextProps } from 'react-native';

import { useTheme } from '@/src/shared/theme/ThemeProvider';
import { typography } from '@/src/shared/theme/typography';

type Variant = 'heading1' | 'heading2' | 'body' | 'bodyBold' | 'caption';

type AppTextProps = TextProps & {
  variant?: Variant;
};

export function AppText({ variant = 'body', style, ...rest }: AppTextProps) {
  const { palette } = useTheme();

  return (
    <Text
      style={[
        styles.base,
        typography[variant],
        {
          color: palette.text.primary,
        },
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    includeFontPadding: false,
  },
});
