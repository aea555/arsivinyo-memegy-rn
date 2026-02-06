import React from 'react';
import { StyleSheet, View } from 'react-native';
import LottieView from 'lottie-react-native';

import { AppText } from '@/src/shared/components/ui/AppText';
import { Screen } from '@/src/shared/components/layout/Screen';
import { useTheme } from '@/src/shared/theme/ThemeProvider';

export function SplashScreen() {
  const { palette } = useTheme();

  return (
    <Screen style={styles.container}>
      <View style={styles.animationWrapper}>
        <LottieView
          source={require('@/assets/animations/splash-ripple.json')}
          autoPlay
          loop
          style={styles.lottie}
        />
        <View style={[styles.logoCircle, { borderColor: palette.accent, backgroundColor: palette.surface }]}>
          <AppText variant="heading1" style={styles.logoText}>
            A
          </AppText>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  animationWrapper: {
    width: 220,
    height: 220,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lottie: {
    position: 'absolute',
    width: 220,
    height: 220,
  },
  logoCircle: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    textAlign: 'center',
  },
});
