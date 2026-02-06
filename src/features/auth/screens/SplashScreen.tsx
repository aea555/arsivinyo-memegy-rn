import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

import { AppText } from '@/src/shared/components/ui/AppText';
import { Screen } from '@/src/shared/components/layout/Screen';

export function SplashScreen() {
  const ripple1 = useRef(new Animated.Value(0)).current;
  const ripple2 = useRef(new Animated.Value(0)).current;
  const ripple3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const makeRipple = (value: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.parallel([
            Animated.timing(value, { toValue: 1, duration: 1800, useNativeDriver: true }),
          ]),
          Animated.timing(value, { toValue: 0, duration: 0, useNativeDriver: true }),
        ])
      );

    const a1 = makeRipple(ripple1, 0);
    const a2 = makeRipple(ripple2, 300);
    const a3 = makeRipple(ripple3, 600);

    a1.start();
    a2.start();
    a3.start();

    return () => {
      a1.stop();
      a2.stop();
      a3.stop();
    };
  }, [ripple1, ripple2, ripple3]);

  const rippleStyle = (value: Animated.Value) => ({
    opacity: value.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0] }),
    transform: [
      {
        scale: value.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1.6] }),
      },
    ],
  });

  return (
    <Screen style={styles.container} contentStyle={styles.content}>
      <View style={styles.animationWrapper}>
        <Animated.View style={[styles.ripple, rippleStyle(ripple1)]} />
        <Animated.View style={[styles.ripple, rippleStyle(ripple2)]} />
        <Animated.View style={[styles.ripple, rippleStyle(ripple3)]} />
        <View style={styles.logoCircle}>
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
    backgroundColor: '#1B1B1B',
  },
  content: {
    paddingTop: 0,
    paddingHorizontal: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  animationWrapper: {
    width: 220,
    height: 220,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ripple: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 2,
    borderColor: '#5A5A5A',
  },
  logoCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1B1B1B',
  },
  logoText: {
    textAlign: 'center',
    color: '#FFFFFF',
  },
});
