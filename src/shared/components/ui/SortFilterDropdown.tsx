import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { withAlpha } from '@/src/shared/theme/colorUtils';
import { spacing } from '@/src/shared/theme/spacing';
import { useTheme } from '@/src/shared/theme/ThemeProvider';
import { AppText } from '@/src/shared/components/ui/AppText';

export type SortFilterOption<T extends string> = {
  label: string;
  value: T;
};

type SortFilterDropdownProps<T extends string> = {
  triggerLabel: string;
  triggerA11yLabel: string;
  visible: boolean;
  onToggleVisible: () => void;
  options: readonly SortFilterOption<T>[];
  selectedValue: T;
  onSelect: (value: T) => void;
  quickToggleLabel: string;
  quickToggleEnabled: boolean;
  onQuickToggle: () => void;
  quickToggleA11yLabel?: string;
  triggerMaxWidth?: number;
  dropdownMinWidth?: number;
};

export function SortFilterDropdown<T extends string>({
  triggerLabel,
  triggerA11yLabel,
  visible,
  onToggleVisible,
  options,
  selectedValue,
  onSelect,
  quickToggleLabel,
  quickToggleEnabled,
  onQuickToggle,
  quickToggleA11yLabel,
  triggerMaxWidth = 220,
  dropdownMinWidth = 180,
}: SortFilterDropdownProps<T>) {
  const { palette } = useTheme();

  return (
    <View style={styles.root}>
      <Pressable
        onPress={onToggleVisible}
        style={({ pressed }) => [
          styles.trigger,
          {
            backgroundColor: withAlpha(palette.overlay, 0.9),
            borderColor: withAlpha(palette.border, 0.85),
            maxWidth: triggerMaxWidth,
          },
          pressed ? styles.pressed : null,
        ]}
        accessibilityRole="button"
        accessibilityLabel={triggerA11yLabel}
      >
        <Ionicons name="options-outline" size={16} color={palette.text.primary} />
        <AppText variant="caption" numberOfLines={1} style={styles.triggerLabel}>
          {triggerLabel}
        </AppText>
        <Ionicons
          name={visible ? 'chevron-up' : 'chevron-down'}
          size={14}
          color={palette.text.secondary}
        />
      </Pressable>
      {visible ? (
        <View
          style={[
            styles.dropdown,
            {
              backgroundColor: withAlpha(palette.surface, 0.98),
              borderColor: withAlpha(palette.border, 0.78),
              minWidth: dropdownMinWidth,
            },
          ]}
        >
          {options.map((option) => {
            const selected = selectedValue === option.value;
            return (
              <Pressable
                key={option.value}
                onPress={() => onSelect(option.value)}
                style={({ pressed }) => [
                  styles.dropdownOption,
                  {
                    backgroundColor: selected ? withAlpha(palette.accent, 0.16) : 'transparent',
                  },
                  pressed ? styles.pressed : null,
                ]}
              >
                <AppText style={{ color: palette.text.primary }}>{option.label}</AppText>
                {selected ? (
                  <Ionicons name="checkmark-circle" size={16} color={palette.accent} />
                ) : (
                  <Ionicons name="ellipse-outline" size={16} color={palette.text.secondary} />
                )}
              </Pressable>
            );
          })}
          <View style={[styles.dropdownDivider, { backgroundColor: withAlpha(palette.border, 0.8) }]} />
          <Pressable
            onPress={onQuickToggle}
            style={({ pressed }) => [
              styles.quickToggleRow,
              {
                borderColor: quickToggleEnabled
                  ? withAlpha(palette.accent, 0.42)
                  : withAlpha(palette.border, 0.78),
                backgroundColor: quickToggleEnabled
                  ? withAlpha(palette.accent, 0.14)
                  : withAlpha(palette.overlay, 0.5),
              },
              pressed ? styles.quickTogglePressed : null,
            ]}
            accessibilityRole="switch"
            accessibilityState={{ checked: quickToggleEnabled }}
            accessibilityLabel={quickToggleA11yLabel ?? quickToggleLabel}
          >
            <AppText style={{ color: palette.text.primary }}>{quickToggleLabel}</AppText>
            <View
              style={[
                styles.quickToggleTrack,
                {
                  justifyContent: quickToggleEnabled ? 'flex-end' : 'flex-start',
                  borderColor: quickToggleEnabled
                    ? withAlpha(palette.accent, 0.6)
                    : withAlpha(palette.border, 0.82),
                  backgroundColor: quickToggleEnabled
                    ? withAlpha(palette.accent, 0.36)
                    : withAlpha(palette.surface, 0.65),
                },
              ]}
            >
              <View
                style={[
                  styles.quickToggleThumb,
                  {
                    backgroundColor: quickToggleEnabled ? palette.accent : palette.text.secondary,
                  },
                ]}
              />
            </View>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'relative',
  },
  trigger: {
    minHeight: 36,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  triggerLabel: {
    flexShrink: 1,
  },
  dropdown: {
    marginTop: spacing.xs,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: spacing.xs,
  },
  dropdownOption: {
    minHeight: 38,
    paddingHorizontal: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  quickToggleRow: {
    minHeight: 42,
    paddingHorizontal: spacing.sm,
    marginHorizontal: spacing.xs,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  quickToggleTrack: {
    width: 38,
    height: 22,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 2,
    alignItems: 'center',
    flexDirection: 'row',
  },
  quickToggleThumb: {
    width: 14,
    height: 14,
    borderRadius: 999,
  },
  dropdownDivider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: spacing.xs,
  },
  quickTogglePressed: {
    opacity: 0.9,
  },
  pressed: {
    transform: [{ scale: 0.99 }],
  },
});
