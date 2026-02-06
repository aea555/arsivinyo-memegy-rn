import React from 'react';
import { StyleSheet, View, ViewProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '@/src/shared/theme/ThemeProvider';
import { AppHeader } from '@/src/shared/components/layout/AppHeader';
import { spacing } from '@/src/shared/theme/spacing';

type ScreenProps = ViewProps & {
  title?: string;
  showBack?: boolean;
  rightAction?: React.ReactNode;
  contentStyle?: ViewProps['style'];
};

export function Screen({ style, title, showBack, rightAction, contentStyle, children, ...rest }: ScreenProps) {
  const { palette } = useTheme();

  return (
    <SafeAreaView
      style={[styles.base, { backgroundColor: palette.background }, style]}
      {...rest}
      edges={['top', 'left', 'right']}
    >
      {title ? <AppHeader title={title} showBack={showBack} rightAction={rightAction} /> : null}
      <View style={[styles.content, title ? styles.withHeader : styles.noHeader, contentStyle]}>
        {children}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  base: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  withHeader: {
    paddingTop: spacing.lg,
  },
  noHeader: {
    paddingTop: spacing.xl,
  },
});
