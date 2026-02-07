import React from 'react';
import { StyleSheet, View, ViewProps } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';

import { layoutConfig } from '@/src/shared/config/layoutConfig';
import { useTheme } from '@/src/shared/theme/ThemeProvider';
import { AppHeader } from '@/src/shared/components/layout/AppHeader';

type ScreenProps = ViewProps & {
  title?: string;
  showBack?: boolean;
  rightAction?: React.ReactNode;
  contentStyle?: ViewProps['style'];
};

export function Screen({ style, title, showBack, rightAction, contentStyle, children, ...rest }: ScreenProps) {
  const { palette } = useTheme();
  const hasGradient = Boolean(palette.backgroundGradient);

  return (
    <SafeAreaView
      style={[styles.base, { backgroundColor: palette.background }, style]}
      {...rest}
      edges={['top', 'left', 'right']}
    >
      {hasGradient ? (
        <LinearGradient
          pointerEvents="none"
          colors={[palette.backgroundGradient!.start, palette.backgroundGradient!.end]}
          start={{ x: 0.08, y: 0.02 }}
          end={{ x: 0.96, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
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
    paddingHorizontal: layoutConfig.screen.horizontalPadding,
  },
  withHeader: {
    paddingTop: layoutConfig.screen.withHeaderTopPadding,
  },
  noHeader: {
    paddingTop: layoutConfig.screen.noHeaderTopPadding,
    paddingBottom: layoutConfig.screen.noHeaderBottomPadding,
  },
});
