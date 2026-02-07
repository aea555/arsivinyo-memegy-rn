import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/src/shared/theme/ThemeProvider';
import { typography } from '@/src/shared/theme/typography';
import { spacing } from '@/src/shared/theme/spacing';

type SegmentedOption = {
  label: string;
  value: string;
};

type SegmentedControlProps = {
  options: SegmentedOption[];
  value: string;
  onChange: (value: string) => void;
};

export function SegmentedControl({ options, value, onChange }: SegmentedControlProps) {
  const { palette } = useTheme();

  return (
    <View style={[styles.container, { borderColor: palette.border, backgroundColor: palette.surface }]}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            style={({ pressed, hovered }) => [
              styles.item,
              active ? { backgroundColor: palette.accent } : null,
              pressed && styles.pressed,
              hovered && styles.hovered,
            ]}
          >
            <Text style={[styles.label, { color: active ? palette.onAccent : palette.text.primary }]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderRadius: 14,
    borderWidth: 1,
    padding: 4,
    gap: spacing.xs,
  },
  item: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    ...typography.bodyBold,
    fontSize: 13,
  },
  pressed: {
    transform: [{ scale: 0.98 }],
  },
  hovered: {
    opacity: 0.96,
  },
});
