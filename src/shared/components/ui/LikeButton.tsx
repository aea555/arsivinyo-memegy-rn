import { Ionicons } from '@expo/vector-icons';
import React, { useRef } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/src/shared/components/ui/AppText';
import { useTheme } from '@/src/shared/theme/ThemeProvider';
import { formatCount } from '@/src/shared/utils/formatters';

type LikeButtonProps = {
  liked: boolean;
  count: number;
  onPress: () => void;
  disabled?: boolean;
  variant?: 'default' | 'overlay';
  iconOnly?: boolean;
};

export function LikeButton({
  liked,
  count,
  onPress,
  disabled,
  variant = 'default',
  iconOnly = false,
}: LikeButtonProps) {
  const { palette } = useTheme();
  const scale = useRef(new Animated.Value(1)).current;
  const isOverlay = variant === 'overlay';
  const buttonStyle = isOverlay
    ? iconOnly
      ? styles.overlayIconButton
      : styles.overlayButton
    : iconOnly
      ? styles.iconButton
      : styles.button;

  const animatePop = () => {
    Animated.sequence([
      Animated.spring(scale, {
        toValue: 1.28,
        useNativeDriver: true,
        stiffness: 360,
        damping: 16,
        mass: 0.6,
      }),
      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: true,
        stiffness: 280,
        damping: 18,
      }),
    ]).start();
  };

  const handlePress = () => {
    if (disabled) return;
    animatePop();
    onPress();
  };

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled}
      style={({ pressed, hovered }) => [
        buttonStyle,
        {
          borderColor: liked ? palette.likeActive : palette.border,
          backgroundColor: liked
            ? palette.likeActiveBg
            : isOverlay
              ? palette.overlay
              : palette.surface,
          opacity: disabled ? 0.5 : 1,
          transform: pressed ? [{ scale: 0.98 }] : [{ scale: 1 }],
        },
        hovered && !disabled ? styles.hovered : null,
      ]}
      accessibilityRole="button"
      accessibilityLabel={liked ? 'Unlike' : 'Like'}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        <Ionicons
          name={liked ? 'heart' : 'heart-outline'}
          size={isOverlay ? (iconOnly ? 24 : 20) : iconOnly ? 20 : 18}
          color={liked ? palette.likeActive : palette.text.secondary}
        />
      </Animated.View>
      {!iconOnly ? (
        <View style={isOverlay ? styles.overlayCountWrapper : styles.countWrapper}>
          <AppText
            variant="caption"
            style={[
              isOverlay ? styles.overlayCount : styles.count,
              {
                color: liked ? palette.likeActive : palette.text.secondary,
              },
            ]}
          >
            {formatCount(count)}
          </AppText>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    minWidth: 72,
  },
  overlayButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 84,
    minHeight: 38,
  },
  iconButton: {
    height: 38,
    width: 38,
    borderWidth: 1,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlayIconButton: {
    height: 44,
    width: 44,
    borderWidth: 1,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hovered: {
    opacity: 0.92,
  },
  countWrapper: {
    width: 34,
    alignItems: 'flex-end',
  },
  count: {
    textAlign: 'right',
  },
  overlayCountWrapper: {
    width: 36,
    alignItems: 'flex-end',
  },
  overlayCount: {
    textAlign: 'right',
    fontSize: 12,
  },
});
