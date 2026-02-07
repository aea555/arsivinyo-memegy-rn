import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Modal, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/src/shared/components/ui/AppText';
import { withAlpha } from '@/src/shared/theme/colorUtils';
import { spacing } from '@/src/shared/theme/spacing';
import { useTheme } from '@/src/shared/theme/ThemeProvider';
import { useShadows } from '@/src/shared/theme/shadows';
import { useToastStore } from '@/src/store/toastStore';

export function AppToastHost() {
  const insets = useSafeAreaInsets();
  const { palette } = useTheme();
  const shadows = useShadows();
  const toast = useToastStore((state) => state.toast);
  const hideToast = useToastStore((state) => state.hideToast);
  const [activeToast, setActiveToast] = useState(toast);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-10)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (toast) {
      setActiveToast(toast);
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, stiffness: 230, damping: 20 }),
      ]).start();
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = setTimeout(() => {
        hideToast();
      }, toast.durationMs);
      return;
    }

    if (!activeToast) return;
    Animated.parallel([
      Animated.timing(opacity, { toValue: 0, duration: 140, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: -10, duration: 140, useNativeDriver: true }),
    ]).start(({ finished }) => {
      if (finished) {
        setActiveToast(null);
      }
    });
  }, [activeToast, hideToast, opacity, toast, translateY]);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const variant = activeToast?.variant ?? 'info';
  const iconColor = variant === 'success' ? palette.success : variant === 'error' ? palette.error : palette.accent;
  const bgColor = palette.surface;
  const borderColor = withAlpha(iconColor, 0.55);
  const iconName: keyof typeof Ionicons.glyphMap =
    variant === 'success' ? 'checkmark-circle' : variant === 'error' ? 'alert-circle' : 'information-circle';

  const topOffset = useMemo(() => insets.top + spacing.md, [insets.top]);

  if (!activeToast) return null;

  return (
    <Modal transparent visible animationType="none" statusBarTranslucent>
      <View pointerEvents="none" style={[styles.wrapper, { top: topOffset }]}>
        <Animated.View
          style={[
            styles.toast,
            shadows.strong,
            {
              backgroundColor: bgColor,
              borderColor,
              opacity,
              transform: [{ translateY }],
            },
          ]}
        >
          <Ionicons name={iconName} size={18} color={iconColor} />
          <AppText variant="bodyBold" style={styles.message}>
            {activeToast.message}
          </AppText>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  toast: {
    width: '100%',
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    elevation: 16,
  },
  message: {
    flex: 1,
  },
});
