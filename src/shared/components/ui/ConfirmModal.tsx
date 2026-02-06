import React, { useEffect, useRef } from 'react';
import { Animated, Modal, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/src/shared/components/ui/AppText';
import { Button } from '@/src/shared/components/ui/Button';
import { useTheme } from '@/src/shared/theme/ThemeProvider';
import { spacing } from '@/src/shared/theme/spacing';
import { shadows } from '@/src/shared/theme/shadows';

type ConfirmModalProps = {
  visible: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
  variant?: 'default' | 'danger';
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmModal({
  visible,
  title,
  body,
  confirmLabel,
  cancelLabel,
  variant = 'default',
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const { palette } = useTheme();
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.96)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, stiffness: 220, damping: 20 }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 140, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 0.96, duration: 140, useNativeDriver: true }),
      ]).start();
    }
  }, [visible, opacity, scale]);

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onCancel}>
      <Pressable style={styles.overlay} onPress={onCancel}>
        <Animated.View
          style={[
            styles.modal,
            {
              backgroundColor: palette.surface,
              borderColor: palette.border,
              opacity,
              transform: [{ scale }],
            },
            shadows.strong,
          ]}
          onStartShouldSetResponder={() => true}
        >
          <AppText variant="heading2">{title}</AppText>
          <AppText variant="body" style={{ color: palette.text.secondary }}>
            {body}
          </AppText>
          <View style={styles.actions}>
            <Button label={cancelLabel} onPress={onCancel} variant="secondary" />
            <Button label={confirmLabel} onPress={onConfirm} variant={variant === 'danger' ? 'danger' : 'primary'} />
          </View>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modal: {
    width: '100%',
    borderRadius: 16,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.md,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'flex-end',
  },
});
