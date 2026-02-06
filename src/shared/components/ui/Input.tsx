import React from 'react';
import { StyleSheet, TextInput, TextInputProps } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { useTheme } from '@/src/shared/theme/ThemeProvider';
import { typography } from '@/src/shared/theme/typography';

function InputComponent({ style, onFocus, onBlur, ...props }: TextInputProps) {
  const { palette } = useTheme();

  // Use shared value effectively bypasses React state updates, avoiding re-renders
  const isFocused = useSharedValue(false);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      borderColor: withTiming(isFocused.value ? palette.accent : palette.border, { duration: 200 }),
      backgroundColor: palette.surface,
    };
  }, [palette]);

  const handleFocus = (e: any) => {
    isFocused.value = true;
    onFocus?.(e);
  };

  const handleBlur = (e: any) => {
    isFocused.value = false;
    onBlur?.(e);
  };

  return (
    <Animated.View
      style={[
        styles.container,
        animatedStyle,
      ]}
    >
      <TextInput
        placeholderTextColor={palette.text.secondary}
        style={[styles.input, { color: palette.text.primary }, style]}
        onFocus={handleFocus}
        onBlur={handleBlur}
        blurOnSubmit={false}
        autoCorrect={false}
        underlineColorAndroid="transparent"
        {...props}
      />
    </Animated.View>
  );
}

export const Input = React.memo(InputComponent);

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  input: {
    ...typography.body,
    padding: 0,
    margin: 0,
  },
});
