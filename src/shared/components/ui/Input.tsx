import React from 'react';
import { StyleSheet, TextInput, TextInputProps, View } from 'react-native';

import { useTheme } from '@/src/shared/theme/ThemeProvider';
import { typography } from '@/src/shared/theme/typography';

export function Input(props: TextInputProps) {
  const { palette } = useTheme();

  return (
    <View
      style={[
        styles.container,
        {
          borderColor: palette.border,
          backgroundColor: palette.surface,
        },
      ]}
    >
      <TextInput
        placeholderTextColor={palette.text.secondary}
        style={[styles.input, { color: palette.text.primary }]}
        {...props}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  input: {
    ...typography.body,
  },
});
